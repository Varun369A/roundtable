import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { verifyWebhookSignature, createOrder } from '../lib/razorpay'
import {
  getOrCreateWallet,
  creditWallet,
  generateReferralCode,
  applyReferralCode,
  InsufficientCreditsError,
} from '../lib/credit-manager'

// ─── Signup bonus ─────────────────────────────────────────────────────────────

export async function grantSignupBonus(userId: string): Promise<void> {
  await creditWallet(userId, 50, 'SIGNUP_BONUS', 'Welcome bonus — thanks for joining Sabha!')
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function creditsRoutes(app: FastifyInstance) {

  // ─── GET /credits/wallet ─────────────────────────────────────────────────
  // Returns current balance and lifetime stats for the authenticated user.
  app.get(
    '/credits/wallet',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id
      const wallet = await getOrCreateWallet(userId)
      return reply.send({ success: true, data: { wallet } })
    }
  )

  // ─── GET /credits/transactions ───────────────────────────────────────────
  // Paginated transaction history. Query: ?limit=50&offset=0&type=TASK_USAGE
  app.get(
    '/credits/transactions',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = z
        .object({
          limit: z.coerce.number().int().min(1).max(200).default(50),
          offset: z.coerce.number().int().min(0).default(0),
          type: z
            .enum([
              'PURCHASE',
              'TASK_USAGE',
              'REFERRAL_BONUS',
              'REFERRAL_REWARD',
              'SIGNUP_BONUS',
              'PROMOTION',
              'EXPIRY',
              'REFUND',
              'MARKETPLACE_EARN',
            ])
            .optional(),
        })
        .safeParse(request.query)

      if (!query.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: query.error.issues[0].message },
        })
      }

      const { limit, offset, type } = query.data
      const userId = request.user!.id

      const [transactions, total] = await Promise.all([
        prisma.creditTransaction.findMany({
          where: {
            userId,
            ...(type ? { type } : {}),
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
          select: {
            id: true,
            type: true,
            amount: true,
            balanceAfter: true,
            description: true,
            taskId: true,
            referralId: true,
            expiresAt: true,
            createdAt: true,
          },
        }),
        prisma.creditTransaction.count({
          where: {
            userId,
            ...(type ? { type } : {}),
          },
        }),
      ])

      return reply.send({
        success: true,
        data: { transactions, total, limit, offset },
      })
    }
  )

  // ─── GET /credits/referral ────────────────────────────────────────────────
  // Returns the user's referral code, creating one automatically if none exists.
  app.get(
    '/credits/referral',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      })

      const code = await generateReferralCode(userId, user?.name ?? 'USER')

      const referralCode = await prisma.referralCode.findUnique({
        where: { userId },
        select: {
          code: true,
          usageCount: true,
          maxUses: true,
          bonusCredits: true,
          rewardCredits: true,
          isActive: true,
          createdAt: true,
          referrals: {
            select: {
              refereeId: true,
              bonusPaid: true,
              rewardPaid: true,
              firstTaskAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      })

      return reply.send({ success: true, data: { referral: referralCode } })
    }
  )

  // ─── POST /credits/referral/apply ────────────────────────────────────────
  // Apply a referral code (body: { code }).
  app.post(
    '/credits/referral/apply',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = z
        .object({ code: z.string().min(1).max(20) })
        .safeParse(request.body)

      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        })
      }

      try {
        await applyReferralCode(request.user!.id, body.data.code)
      } catch (err: unknown) {
        const e = err as Error & { statusCode?: number }
        return reply.status(e.statusCode ?? 400).send({
          success: false,
          error: { code: 'REFERRAL_ERROR', message: e.message },
        })
      }

      return reply.send({
        success: true,
        data: { message: 'Referral code applied — bonus credits have been added to your wallet' },
      })
    }
  )

  // ─── GET /credits/packs ───────────────────────────────────────────────────
  // Lists all active credit packs (public — no auth required).
  app.get('/credits/packs', async (_request: FastifyRequest, reply: FastifyReply) => {
    const packs = await prisma.creditPack.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        credits: true,
        priceInr: true,
        bonusCredits: true,
        isPopular: true,
        sortOrder: true,
      },
    })
    return reply.send({ success: true, data: { packs } })
  })

  // ─── POST /credits/packs/:id/purchase ────────────────────────────────────
  // Creates a Razorpay order for the selected credit pack. Returns orderId.
  app.post(
    '/credits/packs/:id/purchase',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: packId } = request.params as { id: string }
      const userId = request.user!.id

      const pack = await prisma.creditPack.findUnique({
        where: { id: packId },
        select: { id: true, name: true, credits: true, priceInr: true, bonusCredits: true, isActive: true },
      })

      if (!pack || !pack.isActive) {
        return reply.status(404).send({
          success: false,
          error: { code: 'PACK_NOT_FOUND', message: 'Credit pack not found or no longer available' },
        })
      }

      let order: { id: string; amount: number; currency: string; status: string }
      try {
        order = await createOrder({
          amountPaise: pack.priceInr,
          currency: 'INR',
          receipt: `credit_pack_${userId}_${packId}`,
          notes: {
            packId,
            userId,
            packName: pack.name,
          },
        })
      } catch (err) {
        app.log.error({ err }, 'Razorpay order creation failed')
        return reply.status(502).send({
          success: false,
          error: { code: 'PAYMENT_GATEWAY_ERROR', message: 'Could not create payment order — please try again' },
        })
      }

      return reply.send({
        success: true,
        data: {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          pack: {
            id: pack.id,
            name: pack.name,
            credits: pack.credits,
            bonusCredits: pack.bonusCredits,
          },
        },
      })
    }
  )

  // ─── POST /credits/webhook/razorpay ──────────────────────────────────────
  // Razorpay webhook: verify signature, then credit wallet on payment.captured.
  // No JWT auth — Razorpay calls this server-to-server.
  app.post(
    '/credits/webhook/razorpay',
    {
      config: {
        // Disable global rate limit for Razorpay (Razorpay may send bursts)
        rateLimit: { max: 500, timeWindow: '1 minute' },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['x-razorpay-signature'] as string | undefined
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

      if (!signature || !webhookSecret) {
        return reply.status(400).send({
          success: false,
          error: { code: 'MISSING_SIGNATURE', message: 'Webhook signature missing' },
        })
      }

      // Raw body is required for HMAC verification.
      // Fastify stores the raw body on request.rawBody when configured,
      // otherwise fall back to JSON-serialising the parsed body.
      const rawBody: string =
        typeof (request as FastifyRequest & { rawBody?: string | Buffer }).rawBody === 'string'
          ? ((request as FastifyRequest & { rawBody?: string | Buffer }).rawBody as string)
          : typeof (request as FastifyRequest & { rawBody?: string | Buffer }).rawBody === 'object' &&
            Buffer.isBuffer((request as FastifyRequest & { rawBody?: string | Buffer }).rawBody)
          ? ((request as FastifyRequest & { rawBody?: string | Buffer }).rawBody as Buffer).toString('utf8')
          : JSON.stringify(request.body)

      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        app.log.warn({ url: request.url }, 'Razorpay webhook signature verification failed')
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature invalid' },
        })
      }

      const payload = request.body as {
        event: string
        payload?: {
          payment?: {
            entity?: {
              order_id?: string
              notes?: Record<string, string>
            }
          }
        }
      }

      if (payload.event !== 'payment.captured') {
        // Acknowledge non-targeted events without processing
        return reply.send({ success: true })
      }

      const notes = payload.payload?.payment?.entity?.notes ?? {}
      const { packId, userId } = notes

      if (!packId || !userId) {
        app.log.error({ payload }, 'Razorpay webhook: missing packId or userId in notes')
        // Return 200 so Razorpay does not retry; log for manual investigation
        return reply.send({ success: true })
      }

      const pack = await prisma.creditPack.findUnique({
        where: { id: packId },
        select: { id: true, name: true, credits: true, bonusCredits: true, isActive: true },
      })

      if (!pack) {
        app.log.error({ packId, userId }, 'Razorpay webhook: credit pack not found')
        return reply.send({ success: true })
      }

      const totalCredits = pack.credits + (pack.bonusCredits ?? 0)

      try {
        await creditWallet(
          userId,
          totalCredits,
          'PURCHASE',
          `Purchased ${pack.name} — ${pack.credits} credits${pack.bonusCredits > 0 ? ` + ${pack.bonusCredits} bonus` : ''}`
        )
        app.log.info({ userId, packId, totalCredits }, 'Credits purchased via Razorpay webhook')
      } catch (err) {
        app.log.error({ err, userId, packId }, 'Failed to credit wallet after Razorpay payment')
        // Return 500 so Razorpay retries — crediting on retry is safe (idempotency is on Razorpay's side via payment ID, not ours here)
        return reply.status(500).send({ success: false })
      }

      return reply.send({ success: true })
    }
  )
}
