import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/require-admin'
import { revokeAllUserTokens } from '../../lib/tokens'
import { creditWallet, debitWallet } from '../../lib/credit-manager'

export async function adminUsersRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireAdmin)

  // ─── GET /admin/users ────────────────────────────────────────────────────────
  app.get<{ Querystring: { page?: string; limit?: string; search?: string; tier?: string } }>(
    '/',
    async (request, reply) => {
      const page   = Math.max(1, parseInt(request.query.page  || '1',  10))
      const limit  = Math.min(50, parseInt(request.query.limit || '25', 10))
      const search = request.query.search
      const tier   = request.query.tier

      const where: Record<string, unknown> = { isAdmin: false }
      if (tier)   where.tier = tier
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name:  { contains: search, mode: 'insensitive' } },
        ]
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            email: true,
            name: true,
            tier: true,
            status: true,
            createdAt: true,
            lastActiveAt: true,
            _count: { select: { tasks: true } },
            usageStats: { select: { totalCostUsd: true, totalTasksCompleted: true } },
          },
        }),
        prisma.user.count({ where }),
      ])

      return reply.send({
        success: true,
        data: { users },
        meta: { page, limit, total },
      })
    }
  )

  // ─── GET /admin/users/:id ────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
      include: {
        subscription: true,
        usageStats: true,
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, title: true, status: true, totalCostUsd: true, createdAt: true },
        },
        billingEvents: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, eventType: true, costUsd: true, createdAt: true, aiModel: true },
        },
      },
    })

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      })
    }

    return reply.send({ success: true, data: { user } })
  })

  // ─── PATCH /admin/users/:id ──────────────────────────────────────────────────
  // Override tier, suspend/unsuspend, make admin
  app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = z.object({
      tier:             z.enum(['FREE', 'BUILDER', 'STUDIO', 'ENTERPRISE']).optional(),
      status:           z.enum(['ACTIVE', 'SUSPENDED']).optional(),
      isAdmin:          z.boolean().optional(),
      isEmailVerified:  z.boolean().optional(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const updated = await prisma.user.update({
      where: { id: request.params.id },
      data: body.data,
      select: { id: true, email: true, tier: true, status: true, isAdmin: true },
    })

    // If suspending, revoke all tokens
    if (body.data.status === 'SUSPENDED') {
      await revokeAllUserTokens(request.params.id)
    }

    return reply.send({ success: true, data: { user: updated } })
  })

  // ─── DELETE /admin/users/:id/sessions ────────────────────────────────────────
  app.delete<{ Params: { id: string } }>('/:id/sessions', async (request, reply) => {
    await revokeAllUserTokens(request.params.id)
    return reply.send({ success: true, data: { message: 'All sessions revoked' } })
  })

  // ─── POST /admin/users/:id/credits ───────────────────────────────────────────
  // Manually add or subtract credits from a user's wallet
  app.post<{ Params: { id: string } }>('/:id/credits', async (request, reply) => {
    const body = z.object({
      amount: z.number().int().refine((n) => n !== 0, { message: 'Amount cannot be zero' }),
      reason: z.string().min(1).max(200).default('Admin adjustment'),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const amount: number = body.data.amount
    const reason: string = body.data.reason
    const userId = request.params.id

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      })
    }

    let newBalance: number
    if (amount > 0) {
      const result = await creditWallet(userId, amount, 'PROMOTION', reason)
      newBalance = result.newBalance
    } else {
      const result = await debitWallet(userId, Math.abs(amount), 'EXPIRY', reason)
      newBalance = result.newBalance
    }

    return reply.send({ success: true, data: { newBalance, adjustment: amount } })
  })
}
