/**
 * Feedback routes.
 *
 * POST /api/v1/feedback          — submit feedback (auth optional)
 * GET  /api/v1/feedback          — admin: list feedback with filters
 * GET  /api/v1/feedback/summary  — admin: counts by type and rating dist
 */

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { requireAdmin } from '../middleware/require-admin'
import { sanitizeText } from '../middleware/request-validator'

const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature_request', 'general', 'praise']).default('general'),
  message: z.string().min(1).max(2000),
  rating: z.number().int().min(1).max(5).optional(),
  page: z.string().max(200).optional(),
})

export async function feedbackRoutes(app: FastifyInstance) {

  // ─── POST / — submit feedback ────────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const body = feedbackSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    // Auth is optional — anonymous feedback is fine
    let userId: string | undefined
    const authHeader = request.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = await request.jwtVerify<{ sub: string }>()
        userId = decoded.sub
      } catch {
        // ignore invalid token — allow anonymous
      }
    }

    const fb = await prisma.feedback.create({
      data: {
        userId: userId || null,
        type: body.data.type,
        message: sanitizeText(body.data.message),
        rating: body.data.rating || null,
        page: body.data.page || null,
        metadata: {
          userAgent: request.headers['user-agent'] || '',
          ip: request.ip,
        },
      },
    })

    return reply.status(201).send({ success: true, data: { id: fb.id } })
  })

  // ─── GET / — admin: list feedback ───────────────────────────────────────────
  app.get('/', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const query = z.object({
      type: z.enum(['bug', 'feature_request', 'general', 'praise', 'all']).default('all'),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query)

    const where = query.type !== 'all' ? { type: query.type as any } : {}

    const [items, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.feedback.count({ where }),
    ])

    return reply.send({ success: true, data: { items, total } })
  })

  // ─── GET /summary — admin: aggregated stats ──────────────────────────────────
  app.get('/summary', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const [byType, avgRating, total, recent] = await Promise.all([
      prisma.feedback.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
      prisma.feedback.aggregate({
        _avg: { rating: true },
        where: { rating: { not: null } },
      }),
      prisma.feedback.count(),
      prisma.feedback.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
      }),
    ])

    const ratingDist = await Promise.all(
      [1, 2, 3, 4, 5].map(async (r) => ({
        rating: r,
        count: await prisma.feedback.count({ where: { rating: r } }),
      }))
    )

    return reply.send({
      success: true,
      data: {
        total,
        lastWeek: recent,
        avgRating: avgRating._avg.rating ? Number(avgRating._avg.rating.toFixed(2)) : null,
        byType: Object.fromEntries(byType.map((b) => [b.type, b._count.id])),
        ratingDistribution: ratingDist,
      },
    })
  })
}
