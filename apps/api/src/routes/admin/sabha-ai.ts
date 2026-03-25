/**
 * Arivarangam AI Admin Routes
 *
 * Covers:
 *   GET  /status           — global learning status + knowledge count
 *   GET  /confidence       — per-domain confidence scores + stages
 *   GET  /knowledge        — browse knowledge records (paginated)
 *   PATCH /knowledge/:id/rate — rate a record (0–1), marks fine-tune ready
 *   GET  /export/readiness — how many records ready for fine-tuning
 *   POST /export           — trigger JSONL fine-tune dataset export
 *   GET  /exports          — list past exports
 *   POST /enable           — enable Arivarangam AI globally
 *   POST /disable          — disable
 *   PATCH /threshold       — update knowledge readiness threshold
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/require-admin'
import { createNotification } from '../../lib/notifications'
import { getAllDomainConfidence } from '../../lib/confidence-tracker'
import { exportFineTuneDataset, getExportReadiness } from '../../lib/dataset-exporter'
import { rateKnowledgeRecord } from '../../lib/learning-pipeline'
import { getFineTuneStatus, triggerManualFineTune, rollbackModel } from '../../lib/fine-tune-manager'

export async function sabhaAIRoutes(app: FastifyInstance) {

  // ── GET /status ─────────────────────────────────────────────────────────────
  app.get(
    '/status',
    { preHandler: [requireAuth, requireAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const [state, knowledgeCount, categoryBreakdown] = await Promise.all([
          prisma.arivarangamAIState.upsert({
            where:  { id: 'singleton' },
            update: {},
            create: { id: 'singleton' },
            select: { status: true, knowledgeCount: true, readyThreshold: true, enabledAt: true, lastLearnedAt: true },
          }),
          prisma.arivarangamKnowledge.count(),
          prisma.arivarangamKnowledge.groupBy({
            by:     ['category'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
          }),
        ])

        return reply.send({
          success: true,
          data: {
            status:           state.status,
            knowledgeCount,
            readyThreshold:   state.readyThreshold,
            progressPercent:  Math.min(100, Math.round((knowledgeCount / state.readyThreshold) * 100)),
            enabledAt:        state.enabledAt,
            lastLearnedAt:    state.lastLearnedAt,
            categoryBreakdown: categoryBreakdown.map((c) => ({ category: c.category, count: c._count.id })),
          },
        })
      } catch {
        return reply.send({
          success: true,
          data: { status: 'LEARNING', knowledgeCount: 0, readyThreshold: 50, progressPercent: 0, enabledAt: null, lastLearnedAt: null, categoryBreakdown: [] },
        })
      }
    }
  )

  // ── GET /confidence ─────────────────────────────────────────────────────────
  // Per-domain confidence scores and learning stages
  app.get(
    '/confidence',
    { preHandler: [requireAuth, requireAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const domains = await getAllDomainConfidence()
      return reply.send({ success: true, data: { domains } })
    }
  )

  // ── GET /knowledge ──────────────────────────────────────────────────────────
  app.get<{ Querystring: { page?: string; category?: string; minQuality?: string } }>(
    '/knowledge',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest<{ Querystring: { page?: string; category?: string; minQuality?: string } }>, reply: FastifyReply) => {
      const page       = Math.max(1, parseInt(request.query.page     || '1',   10))
      const minQuality =             parseFloat(request.query.minQuality || '0')
      const limit      = 20
      const skip       = (page - 1) * limit

      const where: any = {}
      if (request.query.category) where.category    = request.query.category
      if (minQuality > 0)         where.qualityScore = { gte: minQuality }

      const [items, total] = await Promise.all([
        prisma.arivarangamKnowledge.findMany({
          where,
          skip,
          take:    limit,
          orderBy: { qualityScore: 'desc' },
          select: {
            id:               true,
            category:         true,
            inputSummary:     true,
            outputSummary:    true,
            specialistsUsed:  true,
            complexityLevel:  true,
            qualityScore:     true,
            isFineTuneReady:  true,
            model:            true,
            createdAt:        true,
          },
        }),
        prisma.arivarangamKnowledge.count({ where }),
      ])

      return reply.send({
        success: true,
        data: { items, total, page, limit, pages: Math.ceil(total / limit) },
      })
    }
  )

  // ── PATCH /knowledge/:id/rate ───────────────────────────────────────────────
  // Rate a knowledge record and optionally mark it as fine-tune ready
  app.patch<{ Params: { id: string }; Body: { score: number; isFineTuneReady?: boolean } }>(
    '/knowledge/:id/rate',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { score: number; isFineTuneReady?: boolean } }>, reply: FastifyReply) => {
      const { id }    = request.params
      const { score, isFineTuneReady } = request.body

      if (typeof score !== 'number' || score < 0 || score > 1) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'score must be 0–1' } })
      }

      await rateKnowledgeRecord(id, score, isFineTuneReady)

      return reply.send({ success: true })
    }
  )

  // ── GET /export/readiness ───────────────────────────────────────────────────
  app.get<{ Querystring: { minQuality?: string } }>(
    '/export/readiness',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest<{ Querystring: { minQuality?: string } }>, reply: FastifyReply) => {
      const minQuality = parseFloat(request.query.minQuality || '0.7')
      const readiness  = await getExportReadiness(minQuality)
      return reply.send({ success: true, data: readiness })
    }
  )

  // ── POST /export ────────────────────────────────────────────────────────────
  // Trigger a fine-tune dataset export
  app.post<{ Body: { minQuality?: number; categories?: string[]; notes?: string } }>(
    '/export',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest<{ Body: { minQuality?: number; categories?: string[]; notes?: string } }>, reply: FastifyReply) => {
      const { minQuality = 0.7, categories, notes } = request.body || {}

      try {
        const result = await exportFineTuneDataset({
          minQuality,
          categories: categories as any,
          notes,
          triggeredBy: request.user!.id,
        })

        app.log.info({ adminId: request.user!.id, sampleCount: result.sampleCount }, '[sabha-ai] Fine-tune dataset exported')

        return reply.send({ success: true, data: result })
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: { code: 'EXPORT_FAILED', message: err.message } })
      }
    }
  )

  // ── GET /exports ────────────────────────────────────────────────────────────
  app.get(
    '/exports',
    { preHandler: [requireAuth, requireAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const exports = await prisma.fineTuneExport.findMany({
        orderBy: { createdAt: 'desc' },
        take:    20,
      })
      return reply.send({ success: true, data: { exports } })
    }
  )

  // ── GET /fine-tune/status ─────────────────────────────────────────────────────
  // Current model version, training progress, job history
  app.get(
    '/fine-tune/status',
    { preHandler: [requireAuth, requireAdmin] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const status = await getFineTuneStatus()
      return reply.send({ success: true, data: status })
    }
  )

  // ── POST /fine-tune/trigger ───────────────────────────────────────────────────
  // Manually kick off a fine-tune (don't wait for milestone)
  app.post(
    '/fine-tune/trigger',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const jobId = await triggerManualFineTune(request.user!.id)
        app.log.info({ adminId: request.user!.id, jobId }, '[sabha-ai] Manual fine-tune triggered')
        return reply.send({ success: true, data: { jobId } })
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: { code: 'FINETUNE_ERROR', message: err.message } })
      }
    }
  )

  // ── POST /fine-tune/rollback ──────────────────────────────────────────────────
  // Revert to the previous model version if the new one has issues
  app.post(
    '/fine-tune/rollback',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await rollbackModel()
        app.log.warn({ adminId: request.user!.id }, '[sabha-ai] Model rolled back by admin')
        return reply.send({ success: true })
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: { code: 'ROLLBACK_ERROR', message: err.message } })
      }
    }
  )

  // ── POST /enable ─────────────────────────────────────────────────────────────
  app.post(
    '/enable',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const state = await prisma.arivarangamAIState.upsert({
        where:  { id: 'singleton' },
        update: { status: 'ENABLED', enabledAt: new Date() },
        create: { id: 'singleton', status: 'ENABLED', enabledAt: new Date() },
      })
      app.log.info({ adminId: request.user!.id }, 'Arivarangam enabled by admin')
      return reply.send({ success: true, data: { status: state.status } })
    }
  )

  // ── POST /disable ─────────────────────────────────────────────────────────────
  app.post(
    '/disable',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const state = await prisma.arivarangamAIState.upsert({
        where:  { id: 'singleton' },
        update: { status: 'DISABLED' },
        create: { id: 'singleton', status: 'DISABLED' },
      })
      app.log.info({ adminId: request.user!.id }, 'Arivarangam disabled by admin')
      return reply.send({ success: true, data: { status: state.status } })
    }
  )

  // ── PATCH /threshold ──────────────────────────────────────────────────────────
  app.patch<{ Body: { threshold: number } }>(
    '/threshold',
    { preHandler: [requireAuth, requireAdmin] },
    async (request: FastifyRequest<{ Body: { threshold: number } }>, reply: FastifyReply) => {
      const { threshold } = request.body
      if (!threshold || threshold < 10) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'threshold must be >= 10' } })
      }
      await prisma.arivarangamAIState.upsert({
        where:  { id: 'singleton' },
        update: { readyThreshold: threshold },
        create: { id: 'singleton', readyThreshold: threshold },
      })
      return reply.send({ success: true })
    }
  )
}
