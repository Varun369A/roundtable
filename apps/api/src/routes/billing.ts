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
  BUILDER:    'builder',
  STUDIO:     'studio',
  ENTERPRISE: 'enterprise',
}

const PLAN_TO_TIER: Record<PlanId, UserTier> = {
  free:       'FREE',
  builder:    'BUILDER',
  studio:     'STUDIO',
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
          canUpgrade: ['FREE', 'BUILDER', 'STUDIO'].includes(tier),
          cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
        },
      },
    })
  })

  // ─── POST /api/v1/billing/create-subscription ────────────────────────────────
  // Creates a Razorpay subscription and returns the subscription ID for checkout
  app.post('/create-subscription', async (request, reply) => {
    const body = z.object({
      planId: z.enum(['builder', 'studio', 'enterprise']),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid plan. Must be builder, studio, or enterprise' },
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
      planId:              z.enum(['builder', 'studio', 'enterprise']),
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

  // ─── GET /api/v1/billing/payment-method ───────────────────────────────────────
  // Returns saved payment method details (last 4 digits, card type, expiry).
  app.get('/payment-method', async (request, reply) => {
    const userId = request.user!.id

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { razorpaySubscriptionId: true, razorpayCustomerId: true, status: true },
    })

    if (!subscription?.razorpaySubscriptionId) {
      return reply.send({
        success: true,
        data: { paymentMethod: null },
      })
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return reply.status(503).send({
        success: false,
        error: { code: 'BILLING_UNAVAILABLE', message: 'Billing not configured' },
      })
    }

    try {
      // Fetch subscription from Razorpay to get payment details
      const creds = Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
      ).toString('base64')

      const rzpSub = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${subscription.razorpaySubscriptionId}`,
        { headers: { Authorization: `Basic ${creds}` } }
      ).then((r) => r.json()) as Record<string, any>

      // Extract card details from payment method if available
      const paymentMethod = rzpSub?.payment_method ?? null

      return reply.send({
        success: true,
        data: {
          paymentMethod: paymentMethod
            ? {
                type: paymentMethod.type ?? 'card',
                last4: paymentMethod.card?.last4 ?? null,
                network: paymentMethod.card?.network ?? null,
                expiryMonth: paymentMethod.card?.expiry_month ?? null,
                expiryYear: paymentMethod.card?.expiry_year ?? null,
              }
            : null,
          subscriptionStatus: subscription.status,
        },
      })
    } catch (err) {
      // Razorpay API may not return payment method for all subscription states
      return reply.send({
        success: true,
        data: { paymentMethod: null, subscriptionStatus: subscription.status },
      })
    }
  })

  // ─── POST /api/v1/billing/update-payment ──────────────────────────────────────
  // Returns a Razorpay checkout URL for the user to update their card.
  app.post('/update-payment', async (request, reply) => {
    const userId = request.user!.id

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return reply.status(503).send({
        success: false,
        error: { code: 'BILLING_UNAVAILABLE', message: 'Billing not configured' },
      })
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { razorpaySubscriptionId: true, status: true },
    })

    if (!subscription?.razorpaySubscriptionId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription found.' },
      })
    }

    try {
      const creds = Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
      ).toString('base64')

      // Razorpay allows updating card via the subscription's checkout short_url
      const rzpSub = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${subscription.razorpaySubscriptionId}`,
        { headers: { Authorization: `Basic ${creds}` } }
      ).then((r) => r.json()) as Record<string, any>

      const checkoutUrl: string | null = rzpSub?.short_url ?? null

      if (!checkoutUrl) {
        return reply.status(502).send({
          success: false,
          error: { code: 'CHECKOUT_UNAVAILABLE', message: 'Could not retrieve payment update URL from Razorpay.' },
        })
      }

      return reply.send({
        success: true,
        data: {
          checkoutUrl,
          message: 'Open this URL to update your payment method.',
        },
      })
    } catch (err) {
      return reply.status(502).send({
        success: false,
        error: { code: 'RAZORPAY_ERROR', message: 'Failed to fetch payment update URL.' },
      })
    }
  })
}
