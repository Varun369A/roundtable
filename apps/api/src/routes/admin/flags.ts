/**
 * Feature flag admin routes.
 *
 * GET    /api/v1/admin/flags        — list all flags
 * POST   /api/v1/admin/flags        — create flag
 * PATCH  /api/v1/admin/flags/:key   — update flag (enable/disable, config)
 * DELETE /api/v1/admin/flags/:key   — delete flag
 */

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sabha/db'
import { invalidateFlag } from '../../lib/feature-flags'

const flagSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
  enabled: z.boolean().default(false),
  description: z.string().max(500).optional(),
  config: z.object({
    allowlist: z.array(z.string()).optional(),
    rolloutPercent: z.number().int().min(0).max(100).optional(),
  }).optional(),
})

export async function adminFlagRoutes(app: FastifyInstance) {

  app.get('/', async (_request, reply) => {
    const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } })
    return reply.send({ success: true, data: flags })
  })

  app.post('/', async (request, reply) => {
    const body = flagSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message } })
    }

    const flag = await prisma.featureFlag.create({
      data: {
        key: body.data.key,
        enabled: body.data.enabled,
        description: body.data.description,
        config: body.data.config || {},
      },
    })

    return reply.status(201).send({ success: true, data: flag })
  })

  app.patch('/:key', async (request, reply) => {
    const { key } = request.params as { key: string }
    const body = flagSchema.partial().omit({ key: true }).safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message } })
    }

    const flag = await prisma.featureFlag.update({
      where: { key },
      data: {
        ...(body.data.enabled !== undefined && { enabled: body.data.enabled }),
        ...(body.data.description !== undefined && { description: body.data.description }),
        ...(body.data.config !== undefined && { config: body.data.config }),
      },
    })

    // Invalidate Redis cache
    await invalidateFlag(key)

    return reply.send({ success: true, data: flag })
  })

  app.delete('/:key', async (request, reply) => {
    const { key } = request.params as { key: string }
    await prisma.featureFlag.delete({ where: { key } }).catch(() => {})
    await invalidateFlag(key)
    return reply.send({ success: true, data: { deleted: true } })
  })
}
