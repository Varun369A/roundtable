import { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '@sabha/db'
import { verifyWebhookSignature } from '../lib/razorpay'
import type { PlanId, UserTier } from '@sabha/types'

const PLAN_TO_TIER: Record<string, UserTier> = {
  starter:    'STARTER',
  pro:        'PRO',
  power:      'POWER',
  enterprise: 'ENTERPRISE',
}

// Map Razorpay plan IDs back to our plan keys
function getPlanFromRazorpayPlanId(razorpayPlanId: string): PlanId | null {
  const mapping: Record<string, PlanId> = {
    [process.env.RAZORPAY_PLAN_STARTER    || '']: 'starter',
    [process.env.RAZORPAY_PLAN_PRO        || '']: 'pro',
    [process.env.RAZORPAY_PLAN_POWER      || '']: 'power',
    [process.env.RAZORPAY_PLAN_ENTERPRISE || '']: 'enterprise',
  }
  return mapping[razorpayPlanId] || null
}

export async function webhookRoutes(app: FastifyInstance) {
  // Razorpay requires raw body for signature verification
  // Fastify gives us raw body when we parse it ourselves
  app.post(
    '/razorpay',
    {
      config: { rawBody: true },
    },
    async (request: FastifyRequest, reply) => {
      const signature = request.headers['x-razorpay-signature'] as string
      const secret    = process.env.RAZORPAY_WEBHOOK_SECRET || ''

      if (!signature || !secret) {
        app.log.warn('[Webhook] Missing signature or webhook secret')
        return reply.status(400).send({ error: 'Missing signature' })
      }

      // Get raw body for verification
      const rawBody = JSON.stringify(request.body)

      const isValid = verifyWebhookSignature(rawBody, signature, secret)
      if (!isValid) {
        app.log.warn('[Webhook] Invalid Razorpay signature')
        return reply.status(400).send({ error: 'Invalid signature' })
      }

      const event = request.body as {
        event: string
        payload: {
          subscription?: {
            entity: {
              id: string
              plan_id: string
              status: string
              current_start: number
              current_end: number
              notes: { userId?: string; planId?: string }
            }
          }
          payment?: {
            entity: {
              id: string
              amount: number
              subscription_id?: string
              notes: { userId?: string }
            }
          }
        }
      }

      app.log.info({ webhookEvent: event.event }, '[Webhook] Received Razorpay event')

      try {
        await handleWebhookEvent(event)
      } catch (err) {
        app.log.error({ err, event: event.event }, '[Webhook] Handler error')
        // Return 200 anyway to prevent Razorpay retries on our bugs
      }

      return reply.status(200).send({ received: true })
    }
  )
}

async function handleWebhookEvent(event: {
  event: string
  payload: {
    subscription?: { entity: Record<string, unknown> }
    payment?: { entity: Record<string, unknown> }
  }
}) {
  const sub   = event.payload.subscription?.entity
  const payment = event.payload.payment?.entity

  switch (event.event) {

    case 'subscription.activated':
    case 'subscription.charged': {
      if (!sub) break
      const notes = sub.notes as { userId?: string; planId?: string }
      const userId = notes?.userId
      if (!userId) break

      const planId = (notes?.planId as PlanId) ||
        getPlanFromRazorpayPlanId(sub.plan_id as string)
      if (!planId) break

      const newTier = PLAN_TO_TIER[planId]
      if (!newTier) break

      // Upgrade user tier
      await prisma.user.update({
        where: { id: userId },
        data: { tier: newTier },
      })

      // Update subscription
      await prisma.subscription.upsert({
        where: { userId },
        update: {
          status: 'active',
          planId,
          razorpaySubscriptionId: sub.id as string,
          currentPeriodStart: new Date((sub.current_start as number) * 1000),
          currentPeriodEnd:   new Date((sub.current_end   as number) * 1000),
        },
        create: {
          userId,
          planId,
          status: 'active',
          razorpaySubscriptionId: sub.id as string,
          currentPeriodStart: new Date((sub.current_start as number) * 1000),
          currentPeriodEnd:   new Date((sub.current_end   as number) * 1000),
        },
      })

      // Log billing event
      if (payment) {
        const amountInr = (payment.amount as number) / 100
        const amountUsd = amountInr / 84 // approximate conversion
        await prisma.billingEvent.create({
          data: {
            userId,
            eventType: 'subscription_charge',
            costUsd: amountUsd,
            metadata: {
              planId,
              amountInr,
              razorpayPaymentId: payment.id as string,
              razorpaySubscriptionId: sub.id as string,
            },
          },
        })
      }
      break
    }

    case 'subscription.cancelled':
    case 'subscription.completed': {
      if (!sub) break
      const notes = sub.notes as { userId?: string }
      const userId = notes?.userId
      if (!userId) break

      await prisma.subscription.update({
        where: { userId },
        data: { status: 'cancelled' },
      }).catch(() => {})

      // Downgrade to free
      await prisma.user.update({
        where: { id: userId },
        data: { tier: 'FREE' },
      })
      break
    }

    case 'subscription.halted': {
      if (!sub) break
      const notes = sub.notes as { userId?: string }
      const userId = notes?.userId
      if (!userId) break

      await prisma.subscription.update({
        where: { userId },
        data: { status: 'past_due' },
      }).catch(() => {})
      break
    }

    case 'payment.failed': {
      // Log but don't downgrade yet — Razorpay will retry
      if (payment) {
        const notes = payment.notes as { userId?: string }
        if (notes?.userId) {
          await prisma.billingEvent.create({
            data: {
              userId: notes.userId,
              eventType: 'payment_failed',
              costUsd: 0,
              metadata: { razorpayPaymentId: payment.id as string },
            },
          })
        }
      }
      break
    }
  }
}
