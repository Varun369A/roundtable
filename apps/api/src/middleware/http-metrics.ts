import { FastifyInstance } from 'fastify'
import { metrics } from '../lib/metrics'

/**
 * Registers Fastify hooks that record HTTP request metrics automatically.
 * Must be registered early (before routes) so all requests are captured.
 */
export async function registerHttpMetrics(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request) => {
    ;(request as { _startMs?: number })._startMs = Date.now()
    metrics.httpRequestsInFlight.inc()
  })

  app.addHook('onResponse', async (request, reply) => {
    const startMs = (request as { _startMs?: number })._startMs ?? Date.now()
    const durationMs = Date.now() - startMs

    // Normalize route: use routeOptions.url if available to avoid high cardinality
    const route =
      (request.routeOptions?.url as string | undefined) ||
      request.url.split('?')[0].replace(/\/[a-z0-9]{20,}/gi, '/:id') // coarse fallback

    metrics.httpRequestsInFlight.dec()
    metrics.recordHttpRequest(request.method, route, reply.statusCode, durationMs)
  })
}
