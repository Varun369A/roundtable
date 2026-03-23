import { FastifyInstance } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/require-admin'
import { connectorRegistry } from '../../connectors/registry'

export async function adminConnectorsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireAdmin)

  // ─── GET /admin/connectors ───────────────────────────────────────────────────
  app.get('/', async (_request, reply) => {
    const allModels = connectorRegistry.listAll()
    const availableModels = await connectorRegistry.getAvailableModels()
    const availableSet = new Set(availableModels)

    // Get performance stats from billing events (last 7 days)
    const since = new Date(Date.now() - 7 * 86400000)
    const stats = await prisma.$queryRaw<Array<{
      model: string
      calls: bigint
      total_cost: number
      avg_latency: number
    }>>`
      SELECT
        ai_model::text as model,
        COUNT(*) as calls,
        SUM(cost_usd)::float as total_cost,
        AVG((metadata->>'latencyMs')::float) as avg_latency
      FROM billing_events
      WHERE created_at >= ${since}
        AND ai_model IS NOT NULL
        AND event_type = 'api_call'
      GROUP BY ai_model
    `

    const statsMap = new Map(stats.map((s) => [s.model, s]))

    const connectors = allModels.map((model) => {
      const s = statsMap.get(model)
      return {
        model,
        isAvailable: availableSet.has(model),
        stats7d: s ? {
          calls: Number(s.calls),
          totalCostUsd: Number(s.total_cost || 0),
          avgLatencyMs: Math.round(Number(s.avg_latency || 0)),
        } : null,
      }
    })

    return reply.send({
      success: true,
      data: {
        connectors,
        summary: {
          total: allModels.length,
          available: availableModels.length,
          unavailable: allModels.length - availableModels.length,
        },
      },
    })
  })

  // ─── POST /admin/connectors/:model/health ────────────────────────────────────
  // Ping a specific connector
  app.post<{ Params: { model: string } }>('/:model/health', async (request, reply) => {
    const start = Date.now()
    try {
      const connector = connectorRegistry.get(request.params.model as any)
      const available = await connector.isAvailable()
      return reply.send({
        success: true,
        data: {
          model: request.params.model,
          available,
          latencyMs: Date.now() - start,
        },
      })
    } catch (err) {
      return reply.send({
        success: false,
        data: {
          model: request.params.model,
          available: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          latencyMs: Date.now() - start,
        },
      })
    }
  })
}
