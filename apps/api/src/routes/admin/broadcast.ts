import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/require-admin'
import { createNotification } from '../../lib/notifications'

export async function adminBroadcastRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireAdmin)

  // ─── GET /admin/broadcast — list recent broadcasts ────────────────────────
  app.get('/', async (_request, reply) => {
    const broadcasts = await prisma.adminBroadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        message: true,
        targetTier: true,
        recipientCount: true,
        sentBy: true,
        createdAt: true,
      },
    })
    return reply.send({ success: true, data: { broadcasts } })
  })

  // ─── POST /admin/broadcast — send a message to all (or filtered) users ────
  app.post('/', async (request, reply) => {
    const body = z.object({
      title:      z.string().min(1).max(200),
      message:    z.string().min(1).max(2000),
      targetTier: z.enum(['ALL', 'FREE', 'BUILDER', 'STUDIO', 'ENTERPRISE']).default('ALL'),
      link:       z.string().optional(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const { title, message, targetTier, link } = body.data

    // Fetch all target users (active only, batch to avoid memory issues)
    const where = {
      status: 'ACTIVE' as const,
      ...(targetTier !== 'ALL' ? { tier: targetTier as any } : {}),
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true },
    })

    // Send notification to each user (non-blocking batch)
    const adminId = request.user!.id
    let sent = 0

    // Process in batches of 100 to avoid overwhelming Prisma
    const BATCH = 100
    for (let i = 0; i < users.length; i += BATCH) {
      const batch = users.slice(i, i + BATCH)
      await Promise.allSettled(
        batch.map((u) =>
          createNotification({
            userId: u.id,
            type:   'system_alert',
            title,
            body:   message,
            link:   link ?? undefined,
            metadata: { broadcastBy: adminId },
          })
        )
      )
      sent += batch.length
    }

    // Record the broadcast
    await prisma.adminBroadcast.create({
      data: {
        title,
        message,
        targetTier: targetTier === 'ALL' ? null : targetTier,
        recipientCount: sent,
        sentBy: adminId,
      },
    })

    return reply.send({
      success: true,
      data: { sent, message: `Broadcast sent to ${sent} users` },
    })
  })
}
