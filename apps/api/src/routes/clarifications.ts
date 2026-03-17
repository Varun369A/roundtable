import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { orchestrateTask } from '../orchestration/orchestrator'

export async function clarificationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // ─── GET /tasks/:taskId/clarifications ───────────────────────────────────────
  app.get(
    '/tasks/:taskId/clarifications',
    async (
      request: FastifyRequest<{ Params: { taskId: string } }>,
      reply: FastifyReply,
    ) => {
      const { taskId } = request.params
      const userId = request.user!.id

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

      const clarifications = await prisma.taskClarification.findMany({
        where: { taskId },
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          question: true,
          orderIndex: true,
          answer: true,
          skipped: true,
          createdAt: true,
        },
      })

      return reply.send({
        success: true,
        data: {
          clarifications,
          taskStatus: task.status,
        },
      })
    },
  )

  // ─── POST /tasks/:taskId/clarifications/answer ────────────────────────────────
  app.post(
    '/tasks/:taskId/clarifications/answer',
    async (
      request: FastifyRequest<{
        Params: { taskId: string }
        Body: { answers: Array<{ id: string; answer: string }>; skip?: boolean }
      }>,
      reply: FastifyReply,
    ) => {
      const { taskId } = request.params
      const userId = request.user!.id
      const body = request.body as {
        answers: Array<{ id: string; answer: string }>
        skip?: boolean
      }

      if (!body || !Array.isArray(body.answers)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'answers must be an array' },
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

      if (task.status !== 'WAITING_CLARIFICATION') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Task is not waiting for clarification (current status: ${task.status})`,
          },
        })
      }

      // Save each provided answer
      for (const { id, answer } of body.answers) {
        await prisma.taskClarification.updateMany({
          where: { id, taskId },
          data: { answer: answer.trim() },
        })
      }

      // If skip=true, mark all unanswered (no answer, not yet skipped) as skipped
      if (body.skip) {
        await prisma.taskClarification.updateMany({
          where: { taskId, answer: null, skipped: false },
          data: { skipped: true },
        })
      }

      // Resume orchestration
      orchestrateTask(taskId).catch((err) => {
        app.log.error({ err, taskId }, 'orchestrateTask failed after clarification answer')
      })

      return reply.send({
        success: true,
        data: { success: true, taskId },
      })
    },
  )

  // ─── POST /tasks/:taskId/clarifications/skip ──────────────────────────────────
  app.post(
    '/tasks/:taskId/clarifications/skip',
    async (
      request: FastifyRequest<{ Params: { taskId: string } }>,
      reply: FastifyReply,
    ) => {
      const { taskId } = request.params
      const userId = request.user!.id

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

      // Mark all unanswered clarifications as skipped
      await prisma.taskClarification.updateMany({
        where: { taskId, answer: null, skipped: false },
        data: { skipped: true },
      })

      // Reset task status to PENDING so orchestrator can resume
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'PENDING' },
      })

      // Resume orchestration
      orchestrateTask(taskId).catch((err) => {
        app.log.error({ err, taskId }, 'orchestrateTask failed after clarification skip')
      })

      return reply.send({
        success: true,
        data: { success: true, taskId },
      })
    },
  )
}
