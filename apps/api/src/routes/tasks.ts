import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { enforcePlanLimits } from '../middleware/plan-limits'
import { metrics } from '../lib/metrics'
import { sanitizeText } from '../middleware/request-validator'
import { firewall } from '../lib/ai-firewall'

const createTaskSchema = z.object({
  goal: z.string().min(10).max(4000),
  templateId: z.string().optional(),
  workspaceId: z.string().optional(),
  visibility: z.enum(['private', 'workspace']).default('private'),
})

export async function taskRoutes(app: FastifyInstance) {
  // All task routes require auth
  app.addHook('preHandler', requireAuth)

  // ─── POST / — Create a new task ─────────────────────────────────────────────
  app.post('/', { preHandler: [enforcePlanLimits] }, async (request, reply) => {
    const body = createTaskSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const userId = request.user!.id

    // Sanitize user input before storing
    const rawGoal = sanitizeText(body.data.goal)

    // AI Firewall — scan user goal for PII, API keys, injections
    const fwResult = await firewall(rawGoal, { context: 'user_input', blockOnRiskScore: 90 })
    if (!fwResult.allowed) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'FIREWALL_BLOCKED',
          message: 'Your input was blocked for security reasons. Remove any API keys, personal data, or injection attempts.',
        },
      })
    }
    const sanitizedGoal = fwResult.sanitized  // PII redacted but task proceeds

    // Generate a short title from the goal (first 60 chars, clean)
    const title = sanitizedGoal.slice(0, 60).trim() + (sanitizedGoal.length > 60 ? '...' : '')

    const { templateId, workspaceId, visibility } = body.data

    // Verify workspace access if provided
    if (workspaceId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId, acceptedAt: { not: null } },
      })
      if (!membership) {
        return reply.status(403).send({
          success: false,
          error: { code: 'WORKSPACE_ACCESS_DENIED', message: 'You are not a member of this workspace' },
        })
      }
    }

    // Verify template exists if provided
    if (templateId) {
      const template = await prisma.roundtableTemplate.findUnique({ where: { id: templateId }, select: { id: true } })
      if (!template) {
        return reply.status(404).send({
          success: false,
          error: { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found' },
        })
      }
    }

    const task = await prisma.task.create({
      data: {
        userId,
        workspaceId: workspaceId || null,
        templateId: templateId || null,
        title,
        originalGoal: sanitizedGoal,
        status: 'PENDING',
        visibility: visibility || 'private',
        contextObject: {
          taskId: '',
          originalGoal: sanitizedGoal,
          templateId: templateId || null,
          userProfile: { language: 'en' },
          completedSubtasks: [],
          activeConstraints: [],
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
    })

    // Update contextObject with the real taskId
    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        contextObject: {
          taskId: task.id,
          originalGoal: sanitizedGoal,
          templateId: templateId || null,
          userProfile: { language: 'en' },
          completedSubtasks: [],
          activeConstraints: [],
        },
      },
    })

    // Update usage stats
    await prisma.usageStats.upsert({
      where: { userId },
      update: { totalTasksCreated: { increment: 1 } },
      create: { userId, totalTasksCreated: 1 },
    })

    metrics.tasksCreated.inc()

    return reply.status(201).send({
      success: true,
      data: { task: updatedTask },
    })
  })

  // ─── GET / — List user's tasks ───────────────────────────────────────────────
  app.get('/', async (request, reply) => {
    const query = z.object({
      page:   z.coerce.number().min(1).default(1),
      limit:  z.coerce.number().min(1).max(50).default(20),
      status: z.string().optional(),
    }).safeParse(request.query)

    if (!query.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' },
      })
    }

    const { page, limit, status } = query.data
    const userId = request.user!.id

    const where = {
      userId,
      ...(status ? { status: status as any } : {}),
    }

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

  // ─── GET /:id — Get task detail ───────────────────────────────────────────────
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const userId = request.user!.id

    const task = await prisma.task.findFirst({
      where: { id, userId }, // userId scoping = security
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

    return reply.send({ success: true, data: { task } })
  })

  // ─── DELETE /:id — Cancel a task ──────────────────────────────────────────────
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const userId = request.user!.id

    const task = await prisma.task.findFirst({
      where: { id, userId },
    })

    if (!task) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      })
    }

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status)) {
      return reply.status(409).send({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Cannot cancel a task that is already finished' },
      })
    }

    await prisma.task.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    return reply.send({ success: true, data: { message: 'Task cancelled' } })
  })
}
