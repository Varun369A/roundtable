import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { enforcePlanLimits } from '../middleware/plan-limits'
import { metrics } from '../lib/metrics'
import { sanitizeText } from '../middleware/request-validator'
import { firewall } from '../lib/ai-firewall'
import { orchestrateTask } from '../orchestration/orchestrator'

function truncateTitle(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text
  const truncated = text.substring(0, maxLen)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > maxLen * 0.6 ? truncated.substring(0, lastSpace) : truncated) + '...'
}

const createTaskSchema = z.object({
  goal: z.string().min(10).max(4000),
  templateId: z.string().optional(),
  workspaceId: z.string().optional(),
  visibility: z.enum(['private', 'workspace']).default('private'),
  maxCredits: z.number().int().min(20).max(2000).optional(),
  debateMode: z.boolean().optional(),
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

    // Generate a short title from the goal — truncate at word boundary
    const title = truncateTitle(sanitizedGoal, 80)

    const { templateId, workspaceId, visibility, maxCredits, debateMode } = body.data

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
          ...(maxCredits ? { maxCredits } : {}),
          ...(debateMode ? { debateMode } : {}),
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
          ...(maxCredits ? { maxCredits } : {}),
          ...(debateMode ? { debateMode } : {}),
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

    // Auto-start orchestration — fire-and-forget so response is immediate
    orchestrateTask(task.id).catch(() => {})

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

  // ─── POST /:id/continue — Create a continuation task from a completed one ─────
  // Allows iterative building: user says "add auth", new task gets full context
  // from the parent task's outputs injected into the goal.
  app.post('/:id/continue', { preHandler: [enforcePlanLimits] }, async (request, reply) => {
    const { id: parentTaskId } = request.params as { id: string }
    const userId = request.user!.id

    const bodySchema = z.object({
      message: z.string().min(5).max(2000),
    })
    const body = bodySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    // Fetch parent task — must be owned by user and COMPLETED or FAILED
    const parentTask = await prisma.task.findFirst({
      where: { id: parentTaskId, userId },
      include: {
        subtasks: {
          where: { status: 'COMPLETED' },
          include: { output: true },
          orderBy: { executionOrder: 'asc' },
        },
      },
    })

    if (!parentTask) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found' },
      })
    }

    if (!['COMPLETED', 'FAILED'].includes(parentTask.status)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'TASK_NOT_DONE', message: 'Task must be completed before continuing' },
      })
    }

    // Firewall scan the user continuation message
    const rawMessage = sanitizeText(body.data.message)
    const fwResult = await firewall(rawMessage, { context: 'user_input', blockOnRiskScore: 90 })
    if (!fwResult.allowed) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'FIREWALL_BLOCKED',
          message: 'Your input was blocked for security reasons.',
        },
      })
    }

    // Build context summary from parent task's completed outputs
    // Truncate each output to avoid overwhelming the context window
    const MAX_OUTPUT_CHARS = 800
    const outputSummaries = parentTask.subtasks
      .filter(s => s.output?.content)
      .slice(0, 8) // Max 8 specialist outputs to avoid token bloat
      .map(s => {
        const text = (s.output!.content ?? '').slice(0, MAX_OUTPUT_CHARS)
        const truncated = (s.output!.content ?? '').length > MAX_OUTPUT_CHARS
        return `### ${s.title}\n${text}${truncated ? '\n[...truncated]' : ''}`
      })
      .join('\n\n')

    // Compose the enriched continuation goal
    // The AI receives full context from the previous task + the new instruction
    const continuationGoal = [
      `[CONTINUATION OF PREVIOUS WORK]`,
      ``,
      `Original task: ${parentTask.originalGoal.slice(0, 300)}`,
      ``,
      `What was built previously:`,
      outputSummaries || '(No outputs available)',
      ``,
      `─────────────────────────`,
      `NEW INSTRUCTION: ${fwResult.sanitized}`,
      ``,
      `Build upon the previous work. Maintain consistency with what was already created. Focus entirely on the new instruction above.`,
    ].join('\n')

    const title = truncateTitle(`[Continued] ${fwResult.sanitized}`, 80)

    const newTask = await prisma.task.create({
      data: {
        userId,
        workspaceId: parentTask.workspaceId,
        templateId:  parentTask.templateId,
        title,
        originalGoal: continuationGoal,
        status: 'PENDING',
        visibility: parentTask.visibility as any,
        parentTaskId,
        contextObject: {
          taskId:            '',
          originalGoal:      continuationGoal,
          templateId:        parentTask.templateId,
          userProfile:       { language: 'en' },
          completedSubtasks: [],
          activeConstraints: [],
          parentTaskId,
          isContinuation:    true,
          continuationOf:    parentTask.originalGoal.slice(0, 200),
        },
        ipAddress: request.ip,
        userAgent:  request.headers['user-agent'],
      },
    })

    // Patch contextObject with the real taskId
    await prisma.task.update({
      where: { id: newTask.id },
      data: {
        contextObject: {
          ...(newTask.contextObject as object),
          taskId: newTask.id,
        },
      },
    })

    await prisma.usageStats.upsert({
      where:  { userId },
      update: { totalTasksCreated: { increment: 1 } },
      create: { userId, totalTasksCreated: 1 },
    })

    metrics.tasksCreated.inc()

    // Fire-and-forget orchestration
    orchestrateTask(newTask.id).catch(() => {})

    return reply.status(201).send({
      success: true,
      data: { task: newTask, parentTaskId },
    })
  })

  // ─── GET /:id/history — Version history chain for a task ────────────────────
  // Returns the full continuation chain: root → ... → current task
  // Used by the version history dropdown in the roundtable UI
  app.get('/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string }
    const userId = request.user!.id

    // Verify task belongs to user
    const task = await prisma.task.findFirst({
      where: { id, userId },
      select: { id: true, parentTaskId: true, title: true, status: true, createdAt: true, originalGoal: true },
    })
    if (!task) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }

    // Walk up to find root task
    const chain: { id: string; title: string; status: string; createdAt: Date; isRoot: boolean }[] = []
    let current: { id: string; parentTaskId: string | null; title: string; status: string; createdAt: Date } | null = task as any
    const visited = new Set<string>()

    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      chain.unshift({ id: current.id, title: current.title, status: current.status, createdAt: current.createdAt, isRoot: !current.parentTaskId })
      if (!current.parentTaskId) break
      current = await prisma.task.findFirst({
        where: { id: current.parentTaskId, userId },
        select: { id: true, parentTaskId: true, title: true, status: true, createdAt: true },
      })
    }

    // Also get direct children (newer versions)
    const children = await prisma.task.findMany({
      where: { parentTaskId: id, userId },
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    for (const child of children) {
      if (!visited.has(child.id)) {
        chain.push({ id: child.id, title: child.title, status: child.status, createdAt: child.createdAt, isRoot: false })
      }
    }

    return reply.send({ success: true, data: { history: chain, currentId: id } })
  })

  // ─── GET /:id/estimate — Estimate credit cost before running ─────────────────
  // Returns an estimate so users never get surprised by their bill (unlike Bolt)
  app.get('/:id/estimate', async (request, reply) => {
    // This endpoint is for NEW tasks — id here is actually the goal hash or templateId
    // but for simplicity we re-expose this as a standalone POST /estimate route below
    return reply.status(404).send({ success: false, error: { code: 'USE_POST_ESTIMATE' } })
  })

  // ─── POST /estimate — Estimate credits for a task before creating it ──────────
  app.post('/estimate', async (request, reply) => {
    const schema = z.object({
      goal:       z.string().min(5).max(4000),
      templateId: z.string().optional(),
    })
    const body = schema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    let subtaskCount = 4  // default auto-mode estimate
    let hasDiscussionEngine = true
    let templateName: string | null = null

    if (body.data.templateId) {
      const template = await prisma.roundtableTemplate.findUnique({
        where: { id: body.data.templateId },
        select: { name: true, agents: true },
      })
      if (template) {
        templateName = template.name
        const agents = template.agents as any[]
        subtaskCount = Array.isArray(agents) ? agents.length : 4
      }
    }

    // Credit formula: matches credit-manager.ts calculateTaskCredits
    const base = subtaskCount * 10
    const withDiscussion = hasDiscussionEngine ? Math.ceil(base * 1.5) : base
    const minimum = Math.max(withDiscussion, 10)

    return reply.send({
      success: true,
      data: {
        estimate: {
          credits:             minimum,
          subtaskCount,
          hasDiscussionEngine,
          templateName,
          breakdown: {
            base,
            discussionMultiplier: hasDiscussionEngine ? '×1.5' : '×1',
            total:                minimum,
          },
          label: `~${minimum} credits`,
        },
      },
    })
  })

  // ─── DELETE /:id — Delete a task (hard delete for user) ───────────────────────
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

    // Hard delete — cascade removes subtasks, outputs, clarifications
    await prisma.task.delete({ where: { id } })

    return reply.send({ success: true, data: { message: 'Task deleted' } })
  })
}
