import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@sabha/db'
import { isAccessTokenBlacklisted } from '../lib/tokens'
import { metrics } from '../lib/metrics'
import Redis from 'ioredis'

/**
 * GET /api/v1/stream/task/:id
 *
 * Server-Sent Events endpoint.
 * Subscribes to Redis pub/sub for live task updates.
 * Also sends current task state on connection so UI can restore mid-execution.
 *
 * Auth accepts token via Authorization header OR ?token= query param,
 * because the browser EventSource API cannot set custom headers.
 */
export async function streamRoutes(app: FastifyInstance) {

  // Custom auth preHandler that accepts token from query string as well as header.
  // Required because the browser's native EventSource API cannot set Authorization headers.
  async function streamAuth(
    request: FastifyRequest<{ Params: { id: string }; Querystring: { token?: string } }>,
    reply: FastifyReply,
  ) {
    const token =
      request.headers.authorization?.replace('Bearer ', '') ||
      (request.query as { token?: string }).token

    if (!token) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No token provided' },
      })
    }

    // Check blacklist (logout case)
    if (await isAccessTokenBlacklisted(token)) {
      return reply.status(401).send({
        success: false,
        error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked' },
      })
    }

    try {
      const payload = await app.jwt.verify<{ sub: string; email: string; tier: string }>(token)

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, tier: true, status: true },
      })

      if (!user || user.status !== 'ACTIVE') {
        return reply.status(401).send({
          success: false,
          error: { code: 'USER_INACTIVE', message: 'User account is inactive' },
        })
      }

      request.user = user
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
      })
    }
  }

  app.get<{ Params: { id: string }; Querystring: { token?: string } }>(
    '/task/:id',
    {
      preHandler: [streamAuth],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { token?: string } }>,
      reply: FastifyReply,
    ) => {
      const { id: taskId } = request.params
      const userId = request.user!.id

      // Verify ownership and load current state
      const task = await prisma.task.findFirst({
        where: { id: taskId, userId },
        include: {
          subtasks: {
            include: { output: true },
            orderBy: { executionOrder: 'asc' },
          },
        },
      })

      if (!task) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Task not found' },
        })
      }

      // Track active SSE connections for metrics
      metrics.sseConnectionsActive.inc()

      // ── Set SSE headers ────────────────────────────────────────────────────────
      reply.raw.writeHead(200, {
        'Content-Type':                     'text/event-stream',
        'Cache-Control':                    'no-cache, no-transform',
        'Connection':                       'keep-alive',
        'X-Accel-Buffering':               'no', // disable nginx buffering
        'Access-Control-Allow-Origin':     process.env.WEB_URL || 'http://localhost:3000',
        'Access-Control-Allow-Credentials': 'true',
      })

      // Helper — write a named SSE event
      const send = (eventName: string, data: unknown) => {
        if (reply.raw.writableEnded) return
        reply.raw.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`)
      }

      // ── Send snapshot of current state so the UI can restore mid-execution ────
      send('connected', {
        taskId:       task.id,
        status:       task.status,
        title:        task.title,
        originalGoal: task.originalGoal,
      })

      // Replay already-completed / active subtasks
      for (const subtask of task.subtasks) {
        if (subtask.status === 'COMPLETED' && subtask.output) {
          send('subtask_completed', {
            subtaskId: subtask.id,
            title:     subtask.title,
            model:     subtask.assignedModel,
            output: {
              type:    subtask.output.type,
              content: subtask.output.content,
              fileUrl: subtask.output.fileUrl,
            },
          })
        } else if (subtask.status === 'IN_PROGRESS') {
          send('subtask_started', {
            subtaskId: subtask.id,
            title:     subtask.title,
            model:     subtask.assignedModel,
          })
        } else if (subtask.status === 'FAILED') {
          send('subtask_failed', {
            subtaskId: subtask.id,
            error:     'Subtask failed',
          })
        }
      }

      // If task already in a terminal state, send the final event and close
      if (
        task.status === 'COMPLETED' ||
        task.status === 'FAILED' ||
        task.status === 'CANCELLED'
      ) {
        send('task_' + task.status.toLowerCase(), { taskId: task.id })
        reply.raw.end()
        return
      }

      // ── Subscribe to Redis pub/sub for live updates ────────────────────────────
      // Each SSE connection gets its own Redis subscriber instance —
      // this is required by the Redis pub/sub protocol (a subscribed client
      // can only issue subscribe/unsubscribe commands, not regular commands).
      const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      const channel    = `sabha:task:${taskId}`

      await subscriber.subscribe(channel)

      subscriber.on('message', (_channel: string, message: string) => {
        try {
          const payload = JSON.parse(message) as { event: string; [key: string]: unknown }
          send(payload.event, payload)

          // Close connection when task reaches a terminal state
          if (
            payload.event === 'task_completed' ||
            payload.event === 'task_failed' ||
            payload.event === 'task_cancelled'
          ) {
            cleanup()
          }
        } catch (err) {
          app.log.error({ err }, '[SSE] Failed to parse Redis message')
        }
      })

      subscriber.on('error', (err) => {
        app.log.error({ err }, '[SSE] Redis subscriber error')
      })

      // ── Heartbeat — keeps connection alive through proxies / load balancers ───
      const heartbeat = setInterval(() => {
        if (reply.raw.writableEnded) {
          clearInterval(heartbeat)
          return
        }
        reply.raw.write(': heartbeat\n\n')
      }, 20_000)

      // ── Cleanup on client disconnect ───────────────────────────────────────────
      const cleanup = () => {
        clearInterval(heartbeat)
        subscriber.unsubscribe(channel).catch(() => {})
        subscriber.quit().catch(() => {})
        metrics.sseConnectionsActive.dec()
        if (!reply.raw.writableEnded) reply.raw.end()
      }

      request.raw.on('close',   cleanup)
      request.raw.on('aborted', cleanup)
    },
  )
}
