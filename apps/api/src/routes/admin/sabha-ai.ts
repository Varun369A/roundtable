/**
 * Arivarangam Admin Routes
 * View learning status, enable/disable Arivarangam, see knowledge base stats.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/require-admin'
import { createNotification } from '../../lib/notifications'

export async function sabhaAIRoutes(app: FastifyInstance) {
  // GET /admin/sabha-ai/status
  app.get(
    '/status',
    { preHandler: [requireAuth, requireAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const [state, knowledgeCount, categoryBreakdown] = await Promise.all([
        prisma.arivarangamAIState.upsert({
          where: { id: 'singleton' },
          update: {},
          create: { id: 'singleton' },
          select: { status: true, knowledgeCount: true, readyThreshold: true, enabledAt: true, lastLearnedAt: true },
        }),
        prisma.arivarangamKnowledge.count(),
        prisma.arivarangamKnowledge.groupBy({
          by: ['category'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        }),
      ])

      return reply.send({
        success: true,
        data: {
          status: state.status,
          knowledgeCount,
          readyThreshold: state.readyThreshold,
          progressPercent: Math.min(100, Math.round((knowledgeCount / state.readyThreshold) * 100)),
          enabledAt: state.enabledAt,
          lastLearnedAt: state.lastLearnedAt,
          categoryBreakdown: categoryBreakdown.map((c) => ({ category: c.category, count: c._count.id })),
        },
      })
    }
  )

  // POST /admin/sabha-ai/enable
  app.post(
    '/enable',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const state = await prisma.arivarangamAIState.upsert({
        where: { id: 'singleton' },
        update: { status: 'ENABLED', enabledAt: new Date() },
        create: { id: 'singleton', status: 'ENABLED', enabledAt: new Date() },
      })

      app.log.info({ adminId: request.user!.id }, 'Arivarangam enabled by admin')
      return reply.send({ success: true, data: { status: state.status } })
    }
  )

  // POST /admin/sabha-ai/disable
  app.post(
    '/disable',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const state = await prisma.arivarangamAIState.upsert({
        where: { id: 'singleton' },
        update: { status: 'DISABLED' },
        create: { id: 'singleton', status: 'DISABLED' },
      })

      app.log.info({ adminId: request.user!.id }, 'Arivarangam disabled by admin')
      return reply.send({ success: true, data: { status: state.status } })
    }
  )

  // PATCH /admin/sabha-ai/threshold
  app.patch<{ Body: { threshold: number } }>(
    '/threshold',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest<{ Body: { threshold: number } }>, reply: FastifyReply) => {
      const { threshold } = request.body
      if (!threshold || threshold < 10) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'threshold must be >= 10' } })
      }

      await prisma.arivarangamAIState.upsert({
        where: { id: 'singleton' },
        update: { readyThreshold: threshold },
        create: { id: 'singleton', readyThreshold: threshold },
      })

      return reply.send({ success: true })
    }
  )

  // GET /admin/sabha-ai/knowledge
  // Browse knowledge base examples (paginated)
  app.get<{ Querystring: { page?: string; category?: string } }>(
    '/knowledge',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest<{ Querystring: { page?: string; category?: string } }>, reply: FastifyReply) => {
      const page  = Math.max(1, parseInt(request.query.page || '1', 10))
      const limit = 20
      const skip  = (page - 1) * limit

      const where = request.query.category ? { category: request.query.category as any } : {}

      const [items, total] = await Promise.all([
        prisma.arivarangamKnowledge.findMany({
          where,
          skip,
          take: limit,
          orderBy: { qualityScore: 'desc' },
          select: { id: true, category: true, inputSummary: true, outputSummary: true, model: true, qualityScore: true, createdAt: true },
        }),
        prisma.arivarangamKnowledge.count({ where }),
      ])

      return reply.send({
        success: true,
        data: { items, total, page, limit, pages: Math.ceil(total / limit) },
      })
    }
  )
}
