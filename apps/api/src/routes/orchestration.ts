import { FastifyInstance } from 'fastify'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { orchestrateTask, getReadySubtasks } from '../orchestration/orchestrator'

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
}
