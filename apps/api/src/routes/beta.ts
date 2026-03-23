/**
 * Beta invite management routes.
 *
 * POST /api/v1/beta/validate       — check if a code is valid (public, pre-signup)
 * POST /api/v1/beta/generate       — admin: generate N invite codes
 * GET  /api/v1/beta/list           — admin: list all codes + stats
 * POST /api/v1/beta/send-email     — admin: email a code to someone
 * GET  /api/v1/beta/stats          — admin: beta launch overview
 */

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { requireAdmin } from '../middleware/require-admin'
import { sendBetaInviteEmail } from '../lib/email'

function generateCode(): string {
  const part = () => crypto.randomBytes(2).toString('hex').toUpperCase()
  return `ARIVARANGAM-${part()}${part()}`
}

export async function betaRoutes(app: FastifyInstance) {

  // ─── POST /validate ──────────────────────────────────────────────────────────
  app.post('/validate', async (request, reply) => {
    const body = z.object({ code: z.string().min(1) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'code required' } })

    const invite = await prisma.betaInvite.findUnique({ where: { code: body.data.code.toUpperCase() } })

    if (!invite) return reply.send({ success: true, data: { valid: false, reason: 'invalid_code' } })
    if (invite.usedById) return reply.send({ success: true, data: { valid: false, reason: 'already_used' } })
    if (invite.expiresAt && invite.expiresAt < new Date()) return reply.send({ success: true, data: { valid: false, reason: 'expired' } })

    return reply.send({ success: true, data: { valid: true, email: invite.email } })
  })

  // ─── POST /generate (admin) ──────────────────────────────────────────────────
  app.post('/generate', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const body = z.object({
      count: z.number().int().min(1).max(200).default(10),
      note: z.string().optional(),
      email: z.string().email().optional(),
      expiresInDays: z.number().int().min(1).max(365).optional(),
    }).safeParse(request.body)

    if (!body.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message } })

    const { count, note, email, expiresInDays } = body.data
    const adminId = request.user!.id
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400_000) : null

    const codes: string[] = []
    for (let i = 0; i < count; i++) {
      codes.push(generateCode())
    }

    await prisma.betaInvite.createMany({
      data: codes.map((code) => ({
        code,
        note: note || null,
        email: count === 1 ? (email || null) : null, // only assign email for single-code gen
        createdById: adminId,
        expiresAt,
      })),
    })

    return reply.status(201).send({ success: true, data: { codes, count } })
  })

  // ─── GET /list (admin) ───────────────────────────────────────────────────────
  app.get('/list', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const query = z.object({
      used: z.enum(['true', 'false', 'all']).default('all'),
      limit: z.coerce.number().int().min(1).max(500).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query)

    const where = query.used === 'true'
      ? { usedById: { not: null } }
      : query.used === 'false'
        ? { usedById: null }
        : {}

    const [invites, total] = await Promise.all([
      prisma.betaInvite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.betaInvite.count({ where }),
    ])

    return reply.send({ success: true, data: { invites, total } })
  })

  // ─── POST /send-email (admin) ────────────────────────────────────────────────
  app.post('/send-email', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const body = z.object({
      email: z.string().email(),
      code: z.string().optional(), // if omitted, generate a new one
    }).safeParse(request.body)

    if (!body.success) return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message } })

    const admin = await prisma.user.findUnique({ where: { id: request.user!.id }, select: { name: true } })

    let code = body.data.code?.toUpperCase()
    if (!code) {
      code = generateCode()
      await prisma.betaInvite.create({
        data: { code, email: body.data.email, createdById: request.user!.id },
      })
    }

    await sendBetaInviteEmail({
      to: body.data.email,
      fromName: admin?.name || 'Arivarangam Team',
      code,
    })

    return reply.send({ success: true, data: { code, sent: true } })
  })

  // ─── GET /stats (admin) ──────────────────────────────────────────────────────
  app.get('/stats', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const [total, used, betaUsers, signupsToday, signupsThisWeek] = await Promise.all([
      prisma.betaInvite.count(),
      prisma.betaInvite.count({ where: { usedById: { not: null } } }),
      prisma.user.count({ where: { isBeta: true } }),
      prisma.user.count({
        where: {
          isBeta: true,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.user.count({
        where: {
          isBeta: true,
          createdAt: { gte: new Date(Date.now() - 7 * 86400_000) },
        },
      }),
    ])

    // Activation rate: % of beta users who created at least one task
    const activated = await prisma.user.count({
      where: {
        isBeta: true,
        tasks: { some: {} },
      },
    })

    // D1 retention: users who logged in the day after signup
    // (approximate: lastActiveAt > createdAt + 1 day)
    const d1Retained = await prisma.user.count({
      where: {
        isBeta: true,
        lastActiveAt: {
          gte: new Date(Date.now() - 2 * 86400_000),
        },
      },
    })

    return reply.send({
      success: true,
      data: {
        codes: { total, used, available: total - used },
        users: {
          betaUsers,
          signupsToday,
          signupsThisWeek,
          activationRate: betaUsers > 0 ? Math.round((activated / betaUsers) * 100) : 0,
          d1RetentionApprox: betaUsers > 0 ? Math.round((d1Retained / betaUsers) * 100) : 0,
        },
      },
    })
  })
}
