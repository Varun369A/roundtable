/**
 * Quality Verification Routes
 * GET  /subtasks/:subtaskId/verification  — get verification for a subtask
 * POST /subtasks/:subtaskId/verify        — trigger manual verification (async, 202)
 * GET  /tasks/:taskId/verifications       — get all verifications for a task
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { verifySubtaskOutput, verifyTaskOutputs } from '../lib/quality-verifier'

export async function verificationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // ─── GET /subtasks/:subtaskId/verification ────────────────────────────────────
  app.get(
    '/subtasks/:subtaskId/verification',
    async (
      request: FastifyRequest<{ Params: { subtaskId: string } }>,
      reply: FastifyReply,
    ) => {
      const { subtaskId } = request.params
      const userId = request.user!.id

      // Verify ownership via subtask → task → user
      const subtask = await prisma.subtask.findUnique({
        where: { id: subtaskId },
        select: {
          id: true,
          task: { select: { userId: true } },
          verification: true,
        },
      })

      if (!subtask) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Subtask not found' },
        })
      }

      if (subtask.task.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have access to this subtask' },
        })
      }

      if (!subtask.verification) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No verification found for this subtask' },
        })
      }

      return reply.send({
        success: true,
        data: { verification: subtask.verification },
      })
    },
  )

  // ─── POST /subtasks/:subtaskId/verify ────────────────────────────────────────
  app.post(
    '/subtasks/:subtaskId/verify',
    async (
      request: FastifyRequest<{ Params: { subtaskId: string } }>,
      reply: FastifyReply,
    ) => {
      const { subtaskId } = request.params
      const userId = request.user!.id

      // Verify ownership
      const subtask = await prisma.subtask.findUnique({
        where: { id: subtaskId },
        select: {
          id: true,
          status: true,
          task: { select: { userId: true } },
        },
      })

      if (!subtask) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Subtask not found' },
        })
      }

      if (subtask.task.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have access to this subtask' },
        })
      }

      if (subtask.status !== 'COMPLETED') {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_STATE', message: 'Only COMPLETED subtasks can be verified' },
        })
      }

      // Trigger async (non-blocking)
      verifySubtaskOutput(subtaskId).catch((err) => {
        app.log.error({ err, subtaskId }, 'Manual verification failed')
      })

      return reply.status(202).send({
        success: true,
        data: { message: 'Verification started', subtaskId },
      })
    },
  )

  // ─── GET /tasks/:taskId/verifications ─────────────────────────────────────────
  app.get(
    '/tasks/:taskId/verifications',
    async (
      request: FastifyRequest<{ Params: { taskId: string } }>,
      reply: FastifyReply,
    ) => {
      const { taskId } = request.params
      const userId = request.user!.id

      // Verify task ownership
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

      // Fetch all verifications for this task's subtasks
      const verifications = await prisma.subtaskVerification.findMany({
        where: {
          subtask: { taskId },
        },
        include: {
          subtask: {
            select: { id: true, title: true, role: true, status: true },
          },
        },
        orderBy: { verifiedAt: 'desc' },
      })

      return reply.send({
        success: true,
        data: { verifications },
      })
    },
  )
}
