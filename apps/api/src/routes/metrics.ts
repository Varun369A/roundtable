import { FastifyInstance } from 'fastify'
import { metrics } from '../lib/metrics'
import { circuitBreakerRegistry } from '../lib/circuit-breaker'
import { getQueueStats } from '../jobs/queue'
import { env } from '@sabha/config'

/**
 * GET /metrics — Prometheus-compatible scrape endpoint.
 * Protected by the ADMIN_SECRET header (same as admin routes).
 * Mount this route WITHOUT a /api/v1 prefix to make scraping easier.
 */
export async function metricsRoutes(app: FastifyInstance) {
  app.get('/', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    // Auth: require ADMIN_SECRET header or internal IP
    const secret = request.headers['x-admin-secret']
    const internalIp = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip)

    if (!internalIp && secret !== env.ADMIN_SECRET) {
      return reply.status(403).send('Forbidden')
    }

    // Sync circuit-breaker stats into gauge
    const cbStats = circuitBreakerRegistry.getAllStats()
    for (const [model, stat] of Object.entries(cbStats)) {
      metrics.aiCircuitOpen.set({ model }, stat.state === 'OPEN' ? 1 : 0)
    }

    // Sync queue depths
    try {
      const qStats = await getQueueStats()
      metrics.queueDepth.set({ queue: 'tasks' }, qStats.tasks.waiting ?? 0)
      metrics.queueDepth.set({ queue: 'subtasks' }, qStats.subtasks.waiting ?? 0)
    } catch {
      // Non-fatal — queues might be briefly unavailable
    }

    const body = metrics.collect()
    return reply
      .status(200)
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(body)
  })
}
