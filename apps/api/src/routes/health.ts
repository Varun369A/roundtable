import { FastifyInstance } from 'fastify'
import { prisma } from '@sabha/db'
import { redis } from '../lib/redis'
import { getQueueStats } from '../jobs/queue'
import { circuitBreakerRegistry } from '../lib/circuit-breaker'
import { metrics } from '../lib/metrics'

export async function healthRoutes(app: FastifyInstance) {
  // ─── Shallow health check — for load balancers ──────────────────────────────
  // Returns 200 immediately unless the process is shutting down.
  app.get('/live', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' })
  })

  // ─── Readiness probe — checks all critical dependencies ─────────────────────
  app.get('/ready', async (_request, reply) => {
    const checks: Record<string, string> = {
      api: 'ok',
      db: 'unknown',
      redis: 'unknown',
    }

    await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`
        .then(() => { checks.db = 'ok' })
        .catch(() => { checks.db = 'error' }),

      redis.ping()
        .then(() => { checks.redis = 'ok' })
        .catch(() => { checks.redis = 'error' }),
    ])

    const allOk = Object.values(checks).every((v) => v === 'ok')
    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    })
  })

  // ─── Deep health — includes queue stats, circuit breakers, metrics summary ──
  app.get('/', async (_request, reply) => {
    const checks: Record<string, string> = {
      api: 'ok',
      db: 'unknown',
      redis: 'unknown',
      queues: 'unknown',
    }

    let queueStats: Awaited<ReturnType<typeof getQueueStats>> | null = null

    await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`
        .then(() => { checks.db = 'ok' })
        .catch(() => { checks.db = 'error' }),

      redis.ping()
        .then(() => { checks.redis = 'ok' })
        .catch(() => { checks.redis = 'error' }),

      getQueueStats()
        .then((s) => { queueStats = s; checks.queues = 'ok' })
        .catch(() => { checks.queues = 'error' }),
    ])

    const circuitBreakers = circuitBreakerRegistry.getAllStats()
    const openBreakers = Object.entries(circuitBreakers)
      .filter(([, s]) => s.state === 'OPEN')
      .map(([name]) => name)

    const allOk = Object.values(checks).every((v) => v === 'ok')

    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'healthy' : 'degraded',
      checks,
      queues: queueStats,
      circuitBreakers: {
        total: Object.keys(circuitBreakers).length,
        open: openBreakers,
      },
      activeConnections: {
        sse: metrics.sseConnectionsActive.get(),
      },
      timestamp: new Date().toISOString(),
    })
  })
}
