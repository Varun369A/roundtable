import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { getMemoryContext, saveOnboardingMemory } from '../lib/memory-manager'

export async function memoryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // ─── GET /memory ──────────────────────────────────────────────────────────────
  app.get(
    '/memory',
    async (
      request: FastifyRequest<{
        Querystring: { category?: string; activeOnly?: string }
      }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id
      const { category, activeOnly } = request.query as {
        category?: string
        activeOnly?: string
      }

      const where: Record<string, unknown> = { userId }
      if (category) where.category = category
      if (activeOnly === 'true') where.isActive = true

      const memories = await prisma.userMemory.findMany({
        where,
        orderBy: [{ category: 'asc' }, { usageCount: 'desc' }],
      })

      // Group by category
      const grouped: Record<string, typeof memories> = {}
      for (const m of memories) {
        if (!grouped[m.category]) grouped[m.category] = []
        grouped[m.category].push(m)
      }

      return reply.send({
        success: true,
        data: {
          memories: grouped,
          totalCount: memories.length,
        },
      })
    },
  )

  // ─── GET /memory/context ──────────────────────────────────────────────────────
  // Must be registered before /memory/:key to avoid route shadowing
  app.get('/memory/context', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id
    const context = await getMemoryContext(userId)

    return reply.send({
      success: true,
      data: { context },
    })
  })

  // ─── GET /memory/facts ────────────────────────────────────────────────────────
  app.get('/memory/facts', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id

    const facts = await prisma.userMemoryFact.findMany({
      where: { userId },
      orderBy: { confidence: 'desc' },
    })

    return reply.send({
      success: true,
      data: { facts },
    })
  })

  // ─── POST /memory/onboarding ──────────────────────────────────────────────────
  app.post(
    '/memory/onboarding',
    async (
      request: FastifyRequest<{
        Body: { answers: Record<string, string> }
      }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id
      const body = request.body as { answers: Record<string, string> }

      if (!body?.answers || typeof body.answers !== 'object') {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'answers must be an object' },
        })
      }

      const ALLOWED_KEYS = [
        'business_name',
        'business_type',
        'primary_audience',
        'writing_tone',
        'main_use_case',
      ]

      // Filter to only allowed onboarding keys
      const filtered: Record<string, string> = {}
      for (const key of ALLOWED_KEYS) {
        if (body.answers[key]) filtered[key] = body.answers[key]
      }

      await saveOnboardingMemory(userId, filtered)

      return reply.send({
        success: true,
        data: { saved: Object.keys(filtered).length },
      })
    },
  )

  // ─── PUT /memory/:key ─────────────────────────────────────────────────────────
  app.put(
    '/memory/:key',
    async (
      request: FastifyRequest<{
        Params: { key: string }
        Body: { value: string; category?: string }
      }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id
      const { key } = request.params
      const body = request.body as { value: string; category?: string }

      if (!body?.value || typeof body.value !== 'string' || !body.value.trim()) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'value is required' },
        })
      }

      const category = body.category?.trim() || 'preferences'

      const memory = await prisma.userMemory.upsert({
        where: { userId_key: { userId, key } },
        update: {
          value: body.value.trim(),
          source: 'user_set',
          confidence: 1.0,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          userId,
          key,
          value: body.value.trim(),
          category,
          source: 'user_set',
          confidence: 1.0,
        },
      })

      return reply.send({
        success: true,
        data: { memory },
      })
    },
  )

  // ─── DELETE /memory ───────────────────────────────────────────────────────────
  // Must be registered before /memory/:key to avoid route shadowing
  app.delete('/memory', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id

    const result = await prisma.userMemory.deleteMany({ where: { userId } })

    return reply.send({
      success: true,
      data: { deleted: result.count },
    })
  })

  // ─── DELETE /memory/:key ──────────────────────────────────────────────────────
  app.delete(
    '/memory/:key',
    async (
      request: FastifyRequest<{ Params: { key: string } }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id
      const { key } = request.params

      await prisma.userMemory.updateMany({
        where: { userId, key },
        data: { isActive: false },
      })

      return reply.status(204).send()
    },
  )
}
