import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { getCurrentUsage } from '../middleware/plan-limits'
import {
  createOrGetCustomer,
  createSubscription,
  cancelSubscription,
  createOrder,
  verifyPaymentSignature,
  RAZORPAY_PLAN_IDS,
} from '../lib/razorpay'
import { PLANS } from '@sabha/types'
import type { UserTier, PlanId } from '@sabha/types'

const TIER_TO_PLAN: Record<UserTier, PlanId> = {
  FREE:       'free',
  STARTER:    'starter',
  PRO:        'pro',
  POWER:      'power',
  ENTERPRISE: 'enterprise',
}

const PLAN_TO_TIER: Record<PlanId, UserTier> = {
  free:       'FREE',
  starter:    'STARTER',
  pro:        'PRO',
  power:      'POWER',
  enterprise: 'ENTERPRISE',
}

export async function billingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // ─── GET /api/v1/billing/status ───────────────────────────────────────────────
  // Current subscription, usage, and plan details
  app.get('/status', async (request, reply) => {
    const userId = request.user!.id
    const tier = request.user!.tier as UserTier

    const [user, subscription, usage] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { tier: true, email: true, name: true },
      }),
      prisma.subscription.findUnique({
        where: { userId },
        select: {
          planId: true,
          status: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          tasksUsed: true,
          roundtableTasksUsed: true,
          razorpaySubscriptionId: true,
        },
      }),
      getCurrentUsage(userId, tier),
    ])

    const planId = TIER_TO_PLAN[tier] || 'free'
    const plan   = PLANS[planId]

    return reply.send({
      success: true,
      data: {
        tier,
        plan: {
          id: planId,
          name: plan.name,
          priceInr: plan.priceInr,
          tasksPerMonth: plan.tasksPerMonth,
          features: plan.features,
        },
        subscription,
        usage,
        billing: {
          hasActiveSubscription: subscription?.status === 'active',
          canUpgrade: ['FREE', 'STARTER', 'PRO'].includes(tier),
          cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
        },
      },
    })
  })

  // ─── POST /api/v1/billing/create-subscription ────────────────────────────────
  // Creates a Razorpay subscription and returns the subscription ID for checkout
  app.post('/create-subscription', async (request, reply) => {
    const body = z.object({
      planId: z.enum(['starter', 'pro', 'power']),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid plan' },
      })
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return reply.status(503).send({
        success: false,
        error: { code: 'BILLING_UNAVAILABLE', message: 'Billing not configured' },
      })
    }

    const userId = request.user!.id
    const { planId } = body.data

    const razorpayPlanId = RAZORPAY_PLAN_IDS[planId]
    if (!razorpayPlanId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'PLAN_NOT_CONFIGURED', message: `Plan ${planId} not configured in Razorpay` },
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    if (!user) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } })

    // Create or retrieve Razorpay customer
    const customer = await createOrGetCustomer({
      name: user.name,
      email: user.email,
    })

    // Create subscription
    const subscription = await createSubscription({
      planId: razorpayPlanId,
      customerId: customer.id,
      notes: { userId, planId, env: process.env.NODE_ENV || 'development' },
    })

    // Store pending subscription in DB
    await prisma.subscription.upsert({
      where: { userId },
      update: {
        planId,
        status: 'active',
        razorpaySubscriptionId: subscription.id,
        razorpayCustomerId: customer.id,
        currentPeriodStart: new Date(subscription.current_start * 1000),
        currentPeriodEnd:   new Date(subscription.current_end   * 1000),
      },
      create: {
        userId,
        planId,
        status: 'active',
        razorpaySubscriptionId: subscription.id,
        razorpayCustomerId: customer.id,
        currentPeriodStart: new Date(subscription.current_start * 1000),
        currentPeriodEnd:   new Date(subscription.current_end   * 1000),
      },
    })

    return reply.send({
      success: true,
      data: {
        subscriptionId: subscription.id,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        shortUrl: subscription.short_url,
      },
    })
  })

  // ─── POST /api/v1/billing/verify-payment ─────────────────────────────────────
  // Verify payment after Razorpay checkout completes
  app.post('/verify-payment', async (request, reply) => {
    const body = z.object({
      razorpayPaymentId:    z.string(),
      razorpaySubscriptionId: z.string(),
      razorpaySignature:   z.string(),
      planId:              z.enum(['starter', 'pro', 'power']),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid payment data' },
      })
    }

    const { razorpayPaymentId, razorpaySubscriptionId, razorpaySignature, planId } = body.data
    const userId = request.user!.id

    // Verify signature
    const isValid = verifyPaymentSignature({
      orderId:   razorpaySubscriptionId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    })

    if (!isValid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Payment verification failed' },
      })
    }

    const newTier = PLAN_TO_TIER[planId as PlanId]

    // Upgrade user
    await prisma.user.update({
      where: { id: userId },
      data: { tier: newTier },
    })

    // Update subscription status
    await prisma.subscription.update({
      where: { userId },
      data: { status: 'active', planId },
    })

    return reply.send({
      success: true,
      data: {
        message: `Upgraded to ${planId} plan`,
        newTier,
      },
    })
  })

  // ─── POST /api/v1/billing/cancel ──────────────────────────────────────────────
  app.post('/cancel', async (request, reply) => {
    const userId = request.user!.id

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { razorpaySubscriptionId: true, status: true },
    })

    if (!subscription?.razorpaySubscriptionId || subscription.status !== 'active') {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No active subscription to cancel' },
      })
    }

    await cancelSubscription(subscription.razorpaySubscriptionId, true) // cancel at period end

    await prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    })

    return reply.send({
      success: true,
      data: { message: 'Subscription will cancel at end of current period' },
    })
  })

  // ─── GET /api/v1/billing/invoices ─────────────────────────────────────────────
  app.get('/invoices', async (request, reply) => {
    const userId = request.user!.id

    const events = await prisma.billingEvent.findMany({
      where: { userId, eventType: 'subscription_charge' },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: {
        id: true,
        costUsd: true,
        createdAt: true,
        metadata: true,
      },
    })

    return reply.send({ success: true, data: { invoices: events } })
  })

  // ─── POST /api/v1/billing/create-lifetime-order ───────────────────────────────
  // Lifetime deal — one-time payment for early adopters
  app.post('/create-lifetime-order', async (request, reply) => {
    if (!process.env.RAZORPAY_KEY_ID) {
      return reply.status(503).send({
        success: false,
        error: { code: 'BILLING_UNAVAILABLE', message: 'Billing not configured' },
      })
    }

    const userId = request.user!.id

    // ₹2,999 lifetime deal (first 100 users)
    const order = await createOrder({
      amountPaise: 299900, // ₹2,999 in paise
      receipt: `lifetime-${userId}`,
      notes: { userId, type: 'lifetime_deal' },
    })

    return reply.send({
      success: true,
      data: {
        orderId: order.id,
        amountPaise: order.amount,
        currency: order.currency,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      },
    })
  })
}
