import { FastifyInstance } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/require-admin'

export async function adminTasksRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireAdmin)

  // ─── GET /admin/tasks — live task feed ───────────────────────────────────────
  app.get<{ Querystring: { status?: string; page?: string } }>('/', async (request, reply) => {
    const page   = Math.max(1, parseInt(request.query.page || '1', 10))
    const limit  = 30
    const status = request.query.status

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          totalCostUsd: true,
          createdAt: true,
          completedAt: true,
          user: { select: { id: true, email: true, tier: true } },
          _count: { select: { subtasks: true } },
        },
      }),
      prisma.task.count({ where }),
    ])

    return reply.send({
      success: true,
      data: { tasks },
      meta: { page, limit, total },
    })
  })

  // ─── GET /admin/tasks/live — currently running tasks ────────────────────────
  app.get('/live', async (_request, reply) => {
    const liveTasks = await prisma.task.findMany({
      where: { status: { in: ['ROUTING', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: {
        user: { select: { email: true, tier: true } },
        subtasks: {
          select: {
            id: true,
            title: true,
            status: true,
            assignedModel: true,
            startedAt: true,
          },
        },
      },
    })

    return reply.send({
      success: true,
      data: {
        live: liveTasks,
        count: liveTasks.length,
      },
    })
  })

  // ─── GET /admin/tasks/:id — full task detail ─────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const task = await prisma.task.findUnique({
      where: { id: request.params.id },
      include: {
        user: { select: { id: true, email: true, tier: true } },
        subtasks: { include: { output: true }, orderBy: { executionOrder: 'asc' } },
        billingEvents: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!task) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      })
    }

    return reply.send({ success: true, data: { task } })
  })

  // ─── POST /admin/tasks/:id/cancel ────────────────────────────────────────────
  app.post<{ Params: { id: string } }>('/:id/cancel', async (request, reply) => {
    await prisma.task.update({
      where: { id: request.params.id },
      data: { status: 'CANCELLED' },
    })
    return reply.send({ success: true, data: { message: 'Task cancelled by admin' } })
  })
}
