import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { orchestrateTask, getReadySubtasks } from '../orchestration/orchestrator'
import { subtaskQueue } from '../jobs/queue'
import { redis } from '../lib/redis'

export async function orchestrationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  /**
   * POST /api/v1/tasks/:id/start
   * Triggers intent parsing + task decomposition for a PENDING task.
   * Returns immediately — decomposition happens async.
   */
  app.post<{ Params: { id: string } }>('/:id/start', async (request, reply) => {
    const { id } = request.params
    const userId = request.user!.id

    const task = await prisma.task.findFirst({
      where: { id, userId },
      select: { id: true, status: true },
    })

    if (!task) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      })
    }

    if (task.status !== 'PENDING') {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Task is already in status: ${task.status}. Only PENDING tasks can be started.`,
        },
      })
    }

    // Trigger orchestration asynchronously — don't block the response
    orchestrateTask(id).catch((err) => {
      app.log.error({ err, taskId: id }, 'Orchestration failed')
    })

    return reply.status(202).send({
      success: true,
      data: {
        message: 'Task orchestration started',
        taskId: id,
        statusUrl: `/api/v1/tasks/${id}`,
      },
    })
  })

  /**
   * GET /api/v1/tasks/:id/ready-subtasks
   * Returns subtask IDs that are ready to execute (all deps complete).
   * Used by the execution engine in Month 3.
   */
  app.get<{ Params: { id: string } }>('/:id/ready-subtasks', async (request, reply) => {
    const { id } = request.params
    const userId = request.user!.id

    const task = await prisma.task.findFirst({
      where: { id, userId },
      select: { id: true },
    })

    if (!task) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      })
    }

    const readySubtaskIds = await getReadySubtasks(id)

    return reply.send({
      success: true,
      data: { readySubtaskIds },
    })
  })

  /**
   * POST /api/v1/tasks/:taskId/subtasks/:subtaskId/corrections
   *
   * Request an AI correction on a specific subtask output.
   * Rate limited: 10 corrections per hour per user-task pair — prevents
   * infinite retry loops and limits Sabha's API cost exposure on FREE tier.
   *
   * Body: { prompt: string } — specific correction instruction
   */
  const correctionSchema = z.object({
    prompt: z.string().min(5).max(2000),
  })

  app.post<{ Params: { id: string; subtaskId: string } }>(
    '/:id/subtasks/:subtaskId/corrections',
    async (request, reply) => {
      const { id: taskId, subtaskId } = request.params
      const userId = request.user!.id

      // ── Per-task-user correction rate limit: 10/hour ──────────────────────
      const rateLimitKey = `sabha:corrections:${userId}:${taskId}`
      const results = await redis
        .multi()
        .incr(rateLimitKey)
        .expire(rateLimitKey, 3600)   // 1 hour TTL
        .exec()

      const currentCount = (results?.[0]?.[1] as number) ?? 1
      if (currentCount > 10) {
        return reply.status(429).send({
          success: false,
          error: {
            code: 'CORRECTION_LIMIT_REACHED',
            message: 'You have reached the 10 corrections/hour limit for this task.',
            retryAfterSeconds: await redis.ttl(rateLimitKey),
          },
        })
      }

      // ── Validate body ──────────────────────────────────────────────────────
      const body = correctionSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        })
      }

      // ── Verify task + subtask ownership ───────────────────────────────────
      const [task, subtask] = await Promise.all([
        prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true } }),
        prisma.subtask.findFirst({
          where: { id: subtaskId, taskId },
          select: { id: true, title: true, assignedModel: true, executionOrder: true, category: true },
        }),
      ])

      if (!task || !subtask) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Task or subtask not found' },
        })
      }

      // ── Create correction subtask ──────────────────────────────────────────
      const correctionSubtask = await prisma.subtask.create({
        data: {
          taskId,
          title:          `Correction: ${subtask.title}`,
          category:       subtask.category,
          assignedModel:  subtask.assignedModel,
          status:         'PENDING',
          dependsOn:      [subtaskId],
          inputPrompt:    body.data.prompt,
          executionOrder: subtask.executionOrder + 0.1,
        },
      })

      await subtaskQueue.add(
        `subtask:${correctionSubtask.id}`,
        { subtaskId: correctionSubtask.id, taskId },
        { jobId: `subtask:${correctionSubtask.id}` }
      )

      return reply.status(202).send({
        success: true,
        data: {
          correctionSubtaskId: correctionSubtask.id,
          correctionsUsed:     currentCount,
          correctionsLimit:    10,
        },
      })
    }
  )
}
