/**
 * plan.ts — Plan Confirmation routes (Phase 2)
 *
 * GET  /api/v1/tasks/:taskId/plan         — get the pending plan from Redis
 * POST /api/v1/tasks/:taskId/plan/approve — approve plan (re-queue with skipUnderstanding)
 * POST /api/v1/tasks/:taskId/plan/reject  — cancel task
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { redis } from '../lib/redis'
import { understandingKey, orchestrateWithEngines } from '../orchestration/engine-orchestrator'
import { enqueueCodeGenAfterPlanApproval } from '../jobs/queue'

export async function planRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth)

  // ── GET /:taskId/plan — fetch current plan ─────────────────────────────────
  app.get<{ Params: { taskId: string } }>('/:taskId/plan', async (request, reply) => {
    const { taskId } = request.params
    const userId = request.user!.id

    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true, status: true, originalGoal: true },
    })
    if (!task) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } })

    if (task.status !== 'AWAITING_PLAN_APPROVAL') {
      return reply.send({ success: true, data: { plan: null, status: task.status } })
    }

    const saved = await redis.get(understandingKey(taskId))
    if (!saved) {
      return reply.send({ success: true, data: { plan: null, status: task.status } })
    }

    const understandingOutput = JSON.parse(saved)
    const intentOrch = understandingOutput?.orchestratorOutputs?.['IntentOrchestrator'] as Record<string, unknown> | undefined
    const intentBrain = intentOrch?.['IntentBrain'] as Record<string, unknown> | undefined
    const contextBrain = intentOrch?.['ContextBrain'] as Record<string, unknown> | undefined

    const plan = {
      goal: task.originalGoal.slice(0, 120),
      complexity: (intentBrain?.['complexity'] as string) ?? 'medium',
      domain: (contextBrain?.['domain'] as string) ?? 'general',
      detectedTech: (contextBrain?.['detectedTech'] as string[]) ?? [],
      estimatedFiles: intentBrain?.['complexity'] === 'low' ? 6 : intentBrain?.['complexity'] === 'high' ? 20 : 12,
      estimatedMinutes: intentBrain?.['complexity'] === 'low' ? 1 : intentBrain?.['complexity'] === 'high' ? 3 : 2,
    }

    return reply.send({ success: true, data: { plan, status: task.status } })
  })

  // ── POST /:taskId/plan/approve — approve plan, continue build ──────────────
  app.post<{
    Params: { taskId: string }
    Body: { modification?: string }
  }>('/:taskId/plan/approve', async (request, reply) => {
    const { taskId } = request.params
    const { modification } = request.body ?? {}
    const userId = request.user!.id

    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true, status: true },
    })
    if (!task) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } })
    if (task.status !== 'AWAITING_PLAN_APPROVAL') {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: `Task is ${task.status}, not AWAITING_PLAN_APPROVAL` },
      })
    }

    // Re-queue the build with skipUnderstanding
    await enqueueCodeGenAfterPlanApproval(taskId, modification?.trim() || undefined)

    return reply.send({ success: true, data: { taskId, status: 'queued' } })
  })

  // ── POST /:taskId/plan/reject — cancel task ────────────────────────────────
  app.post<{ Params: { taskId: string } }>('/:taskId/plan/reject', async (request, reply) => {
    const { taskId } = request.params
    const userId = request.user!.id

    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true, status: true },
    })
    if (!task) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } })

    await prisma.task.update({ where: { id: taskId }, data: { status: 'CANCELLED' } })

    // Clean up Redis
    await redis.del(understandingKey(taskId))

    // Notify via SSE
    redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
      event: 'task_cancelled', taskId,
    })).catch(() => {})

    return reply.send({ success: true, data: { taskId, status: 'CANCELLED' } })
  })
}
