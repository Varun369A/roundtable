import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { validateCronExpression, getNextRunTime } from '../lib/cron-expression'
import { enqueueTask } from '../jobs/queue'

export async function scheduledTasksRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // ─── GET /scheduled-tasks ─────────────────────────────────────────────────────
  app.get(
    '/scheduled-tasks',
    async (
      request: FastifyRequest<{
        Querystring: { isActive?: string; page?: string; limit?: string }
      }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id
      const query = request.query as {
        isActive?: string
        page?: string
        limit?: string
      }

      const page  = Math.max(1, parseInt(query.page  ?? '1', 10)  || 1)
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20))

      const where: Record<string, unknown> = { userId }
      if (query.isActive !== undefined) {
        where.isActive = query.isActive === 'true'
      }

      const [total, scheduledTasks] = await Promise.all([
        prisma.scheduledTask.count({ where }),
        prisma.scheduledTask.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            name: true,
            goal: true,
            cronExpression: true,
            timezone: true,
            isActive: true,
            nextRunAt: true,
            lastRunAt: true,
            runCount: true,
            failCount: true,
            runs: {
              orderBy: { startedAt: 'desc' },
              take: 1,
              select: {
                status: true,
                startedAt: true,
                completedAt: true,
              },
            },
          },
        }),
      ])

      // Flatten last run onto each task
      const result = scheduledTasks.map(({ runs, ...task }) => ({
        ...task,
        lastRun: runs[0] ?? null,
      }))

      return reply.send({
        success: true,
        data: { scheduledTasks: result, total, page, limit },
      })
    },
  )

  // ─── POST /scheduled-tasks ────────────────────────────────────────────────────
  app.post(
    '/scheduled-tasks',
    async (
      request: FastifyRequest<{
        Body: {
          name: string
          goal: string
          cronExpression: string
          timezone?: string
          templateId?: string
          maxRuns?: number
          notifyOnFail?: boolean
          notifyOnComplete?: boolean
        }
      }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id
      const body = request.body as {
        name: string
        goal: string
        cronExpression: string
        timezone?: string
        templateId?: string
        maxRuns?: number
        notifyOnFail?: boolean
        notifyOnComplete?: boolean
      }

      if (!body?.name?.trim()) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'name is required' },
        })
      }

      if (!body?.goal?.trim()) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'goal is required' },
        })
      }

      if (!body?.cronExpression?.trim()) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'cronExpression is required' },
        })
      }

      const cronError = validateCronExpression(body.cronExpression)
      if (cronError) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_CRON', message: cronError },
        })
      }

      const nextRunAt = getNextRunTime(body.cronExpression)

      const scheduledTask = await prisma.scheduledTask.create({
        data: {
          userId,
          name: body.name.trim(),
          goal: body.goal.trim(),
          cronExpression: body.cronExpression.trim(),
          timezone: body.timezone?.trim() || 'UTC',
          templateId: body.templateId || null,
          maxRuns: body.maxRuns ?? null,
          notifyOnFail: body.notifyOnFail ?? true,
          notifyOnComplete: body.notifyOnComplete ?? false,
          nextRunAt,
          isActive: true,
        },
      })

      return reply.status(201).send({
        success: true,
        data: { scheduledTask },
      })
    },
  )

  // ─── GET /scheduled-tasks/:id ─────────────────────────────────────────────────
  app.get(
    '/scheduled-tasks/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const userId = request.user!.id

      const scheduledTask = await prisma.scheduledTask.findFirst({
        where: { id, userId },
        include: {
          runs: {
            orderBy: { startedAt: 'desc' },
            take: 20,
          },
        },
      })

      if (!scheduledTask) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled task not found' },
        })
      }

      return reply.send({
        success: true,
        data: { scheduledTask },
      })
    },
  )

  // ─── PATCH /scheduled-tasks/:id ───────────────────────────────────────────────
  app.patch(
    '/scheduled-tasks/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string }
        Body: {
          name?: string
          goal?: string
          cronExpression?: string
          timezone?: string
          isActive?: boolean
          maxRuns?: number
          notifyOnFail?: boolean
          notifyOnComplete?: boolean
        }
      }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const userId = request.user!.id
      const body = request.body as {
        name?: string
        goal?: string
        cronExpression?: string
        timezone?: string
        isActive?: boolean
        maxRuns?: number
        notifyOnFail?: boolean
        notifyOnComplete?: boolean
      }

      const existing = await prisma.scheduledTask.findFirst({
        where: { id, userId },
        select: { id: true },
      })

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled task not found' },
        })
      }

      const updateData: Record<string, unknown> = {}

      if (body.name !== undefined)             updateData.name = body.name.trim()
      if (body.goal !== undefined)             updateData.goal = body.goal.trim()
      if (body.timezone !== undefined)         updateData.timezone = body.timezone.trim()
      if (body.isActive !== undefined)         updateData.isActive = body.isActive
      if (body.maxRuns !== undefined)          updateData.maxRuns = body.maxRuns
      if (body.notifyOnFail !== undefined)     updateData.notifyOnFail = body.notifyOnFail
      if (body.notifyOnComplete !== undefined) updateData.notifyOnComplete = body.notifyOnComplete

      if (body.cronExpression !== undefined) {
        const cronError = validateCronExpression(body.cronExpression)
        if (cronError) {
          return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_CRON', message: cronError },
          })
        }
        updateData.cronExpression = body.cronExpression.trim()
        updateData.nextRunAt = getNextRunTime(body.cronExpression)
      }

      const scheduledTask = await prisma.scheduledTask.update({
        where: { id },
        data: updateData,
      })

      return reply.send({
        success: true,
        data: { scheduledTask },
      })
    },
  )

  // ─── DELETE /scheduled-tasks/:id ─────────────────────────────────────────────
  app.delete(
    '/scheduled-tasks/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const userId = request.user!.id

      const existing = await prisma.scheduledTask.findFirst({
        where: { id, userId },
        select: { id: true },
      })

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled task not found' },
        })
      }

      await prisma.scheduledTask.delete({ where: { id } })

      return reply.status(204).send()
    },
  )

  // ─── POST /scheduled-tasks/:id/run ───────────────────────────────────────────
  app.post(
    '/scheduled-tasks/:id/run',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const userId = request.user!.id

      const scheduledTask = await prisma.scheduledTask.findFirst({
        where: { id, userId },
        select: { id: true, goal: true, templateId: true },
      })

      if (!scheduledTask) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled task not found' },
        })
      }

      // Create the actual Task record
      const task = await prisma.task.create({
        data: {
          userId,
          title: scheduledTask.goal.slice(0, 60).trim() + (scheduledTask.goal.length > 60 ? '...' : ''),
          originalGoal: scheduledTask.goal,
          templateId: scheduledTask.templateId || null,
          status: 'PENDING',
          visibility: 'private',
          contextObject: {
            taskId: '',
            originalGoal: scheduledTask.goal,
            templateId: scheduledTask.templateId || null,
            userProfile: { language: 'en' },
            completedSubtasks: [],
            activeConstraints: [],
          },
        },
      })

      // Patch the contextObject with the real taskId
      await prisma.task.update({
        where: { id: task.id },
        data: {
          contextObject: {
            taskId: task.id,
            originalGoal: scheduledTask.goal,
            templateId: scheduledTask.templateId || null,
            userProfile: { language: 'en' },
            completedSubtasks: [],
            activeConstraints: [],
          },
        },
      })

      // Create a ScheduledTaskRun record
      const run = await prisma.scheduledTaskRun.create({
        data: {
          scheduledTaskId: id,
          taskId: task.id,
          triggerType: 'manual',
          status: 'RUNNING',
          startedAt: new Date(),
        },
      })

      // Enqueue for execution
      await enqueueTask(task.id)

      return reply.status(201).send({
        success: true,
        data: {
          taskId: task.id,
          runId: run.id,
          message: 'Task started manually',
        },
      })
    },
  )

  // ─── GET /scheduled-tasks/:id/runs ───────────────────────────────────────────
  app.get(
    '/scheduled-tasks/:id/runs',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const userId = request.user!.id

      const scheduledTask = await prisma.scheduledTask.findFirst({
        where: { id, userId },
        select: { id: true },
      })

      if (!scheduledTask) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled task not found' },
        })
      }

      const runs = await prisma.scheduledTaskRun.findMany({
        where: { scheduledTaskId: id },
        orderBy: { startedAt: 'desc' },
        take: 50,
      })

      return reply.send({
        success: true,
        data: { runs },
      })
    },
  )
}
