import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { redis } from '../lib/redis'

export async function steeringRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // ─── POST /tasks/:taskId/steer ────────────────────────────────────────────────
  app.post(
    '/tasks/:taskId/steer',
    async (
      request: FastifyRequest<{
        Params: { taskId: string }
        Body: { message: string; priority?: number }
      }>,
      reply: FastifyReply,
    ) => {
      const { taskId } = request.params
      const userId = request.user!.id
      const body = request.body as { message: string; priority?: number }

      // Validate message
      if (!body?.message || typeof body.message !== 'string' || !body.message.trim()) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'message is required' },
        })
      }

      if (body.message.trim().length > 500) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'message must be 500 characters or fewer' },
        })
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, userId: true, status: true },
      })

      if (!task) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Task not found' },
        })
      }

      if (task.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have access to this task' },
        })
      }

      if (task.status !== 'IN_PROGRESS') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'TASK_NOT_IN_PROGRESS',
            message: `Cannot steer a task that is not IN_PROGRESS (current status: ${task.status})`,
          },
        })
      }

      // Rate-limit: prevent steering spam — max 5 unapplied steerings
      const unappliedCount = await prisma.taskSteeringMessage.count({
        where: { taskId, appliedAt: null },
      })

      if (unappliedCount >= 5) {
        return reply.status(429).send({
          success: false,
          error: {
            code: 'TOO_MANY_STEERINGS',
            message: 'You have 5 pending steering instructions. Wait for them to be applied before adding more.',
          },
        })
      }

      const priority = typeof body.priority === 'number' ? body.priority : 0

      const msg = await prisma.taskSteeringMessage.create({
        data: {
          taskId,
          userId: request.user!.id,
          message: body.message.trim(),
          priority,
        },
      })

      // Publish to Redis pub/sub channel so the running subtask worker can pick it up
      await redis.publish(
        `arivarangam:task:${taskId}`,
        JSON.stringify({
          event: 'steering_received',
          taskId,
          steeringId: msg.id,
          message: msg.message,
          createdAt: msg.createdAt,
        }),
      )

      return reply.send({
        success: true,
        data: {
          steeringId: msg.id,
          message: 'Steering instruction queued. Will be applied to the next AI step.',
        },
      })
    },
  )

  // ─── GET /tasks/:taskId/steerings ─────────────────────────────────────────────
  app.get(
    '/tasks/:taskId/steerings',
    async (
      request: FastifyRequest<{ Params: { taskId: string } }>,
      reply: FastifyReply,
    ) => {
      const { taskId } = request.params
      const userId = request.user!.id

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, userId: true },
      })

      if (!task) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Task not found' },
        })
      }

      if (task.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have access to this task' },
        })
      }

      const steerings = await prisma.taskSteeringMessage.findMany({
        where: { taskId },
        orderBy: { createdAt: 'asc' },
      })

      return reply.send({
        success: true,
        data: { steerings },
      })
    },
  )
}
