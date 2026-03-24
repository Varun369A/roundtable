/**
 * AI Connections — deprecated (BYOAI removed).
 * All tasks now run through Arivarangam AI using platform keys.
 * Route kept as stub so existing clients don't get 404 during migration.
 */
import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth'

export async function aiConnectionsRoutes(app: FastifyInstance) {
  // Return empty providers list — BYOAI no longer supported
  app.get('/', { preHandler: [requireAuth] }, async (_req, reply) => {
    return reply.send({
      success: true,
      data: {
        providers: [],
        message: 'API key management is no longer required. Arivarangam AI handles all model access.',
      },
    })
  })

  // Stub remaining endpoints to avoid 404s during migration
  app.post('/connect', { preHandler: [requireAuth] }, async (_req, reply) => {
    return reply.status(410).send({ success: false, error: { code: 'DEPRECATED', message: 'BYOAI is no longer supported. Use credits.' } })
  })

  app.delete('/:provider', { preHandler: [requireAuth] }, async (_req, reply) => {
    return reply.status(410).send({ success: false, error: { code: 'DEPRECATED', message: 'BYOAI is no longer supported.' } })
  })
}
