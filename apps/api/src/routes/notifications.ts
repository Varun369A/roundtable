/**
 * User notification routes.
 * GET   /api/v1/notifications              — inbox (paginated, unread first)
 * GET   /api/v1/notifications/unread-count — quick badge count
 * GET   /api/v1/notifications/stream       — SSE for live delivery
 * PATCH /api/v1/notifications/:id/read     — mark one read
 * POST  /api/v1/notifications/read-all     — mark all read
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '@sabha/db'
import { redis } from '../lib/redis'
import { requireAuth } from '../middleware/auth'
import { markNotificationRead, getUnreadCount } from '../lib/notifications'

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth
  app.addHook('preHandler', requireAuth)

  // GET / — paginated inbox, unread first
  app.get('/', async (request, reply) => {
    try {
      const query = request.query as any
      const page  = Math.max(parseInt(query.page  ?? '1',  10), 1)
      const limit = Math.min(parseInt(query.limit ?? '20', 10), 100)
      const skip  = (page - 1) * limit
      const userId = request.user!.id

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
          skip,
          take: limit,
        }),
        prisma.notification.count({ where: { userId } }),
      ])

      return reply.send({
        success: true,
        data: { notifications },
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      })
    } catch (err) {
      request.log.error({ err }, '[notifications] GET / error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications' } })
    }
  })

  // GET /unread-count — quick badge count
  app.get('/unread-count', async (request, reply) => {
    try {
      const count = await getUnreadCount(request.user!.id)
      return reply.send({ success: true, data: { count } })
    } catch (err) {
      request.log.error({ err }, '[notifications] GET /unread-count error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get unread count' } })
    }
  })

  // GET /stream — SSE for live notification delivery
  app.get('/stream', async (request, reply) => {
    const userId  = request.user!.id
    const channel = `sabha:user:${userId}`

    // Set SSE headers and hijack the connection from Fastify
    reply.raw.setHeader('Content-Type',      'text/event-stream')
    reply.raw.setHeader('Cache-Control',     'no-cache')
    reply.raw.setHeader('Connection',        'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()
    reply.hijack()

    const sendEvent = (event: string, data: unknown) => {
      try {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      } catch {
        // client already disconnected
      }
    }

    // Send initial connected event with unread count
    try {
      const unreadCount = await getUnreadCount(userId)
      sendEvent('connected', { unreadCount })
    } catch {
      sendEvent('connected', { unreadCount: 0 })
    }

    // Subscribe to user's Valkey channel via a dedicated subscriber connection
    const subscriber = redis.duplicate()
    await subscriber.subscribe(channel)

    subscriber.on('message', (_chan: string, message: string) => {
      try {
        const parsed = JSON.parse(message)
        sendEvent(parsed.event ?? 'notification', parsed.data ?? parsed)
      } catch {
        try { reply.raw.write(`data: ${message}\n\n`) } catch {}
      }
    })

    // 30-second heartbeat to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      try { reply.raw.write(': heartbeat\n\n') } catch {}
    }, 30_000)

    const cleanup = async () => {
      clearInterval(heartbeat)
      try {
        await subscriber.unsubscribe(channel)
        await subscriber.disconnect()
      } catch {
        // ignore cleanup errors
      }
    }

    request.raw.on('close',   cleanup)
    request.raw.on('aborted', cleanup)
  })

  // PATCH /:id/read — mark one notification read
  app.patch('/:id/read', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await markNotificationRead(id, request.user!.id)
      return reply.send({ success: true })
    } catch (err) {
      request.log.error({ err }, '[notifications] PATCH /:id/read error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notification as read' } })
    }
  })

  // POST /read-all — mark all notifications read
  app.post('/read-all', async (request, reply) => {
    try {
      await prisma.notification.updateMany({
        where: { userId: request.user!.id, readAt: null },
        data:  { readAt: new Date() },
      })
      return reply.send({ success: true })
    } catch (err) {
      request.log.error({ err }, '[notifications] POST /read-all error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark all notifications as read' } })
    }
  })
}
