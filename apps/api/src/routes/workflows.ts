/**
 * Workflow CRUD + execution routes.
 *
 * Routes:
 *   GET    /workflows                              — list paginated workflows
 *   POST   /workflows                              — create workflow + steps
 *   GET    /workflows/:id                          — workflow detail + last 5 runs
 *   PATCH  /workflows/:id                          — update workflow (steps replaced atomically)
 *   DELETE /workflows/:id                          — cascade-delete workflow
 *   POST   /workflows/:id/run                      — trigger manual execution
 *   GET    /workflows/:id/runs                     — paginated run history
 *   GET    /workflows/:id/runs/:runId              — full run detail with step runs
 *   POST   /webhooks/workflow/:workflowId/trigger  — webhook-triggered execution (public, HMAC-signed)
 *
 * Rate limiting notes:
 *   - POST /workflows/:id/run        → 10 req/min per user (enforced upstream)
 *   - POST /webhooks/.../trigger     → 60 req/min per workflowId (enforced upstream)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { runWorkflow, generateWebhookSecret, validateWebhookSignature } from '../lib/workflow-executor'

// ─── Shared validation ────────────────────────────────────────────────────────

const VALID_TRIGGER_TYPES = ['manual', 'webhook', 'scheduled'] as const
const VALID_STATUSES = ['ACTIVE', 'INACTIVE', 'DRAFT'] as const

type TriggerType = typeof VALID_TRIGGER_TYPES[number]
type WorkflowStatus = typeof VALID_STATUSES[number]

interface StepInput {
  name: string
  goalTemplate: string
  templateId?: string
  assignedModel?: string
  dependsOnStepOrder?: number
  outputMapping?: Record<string, string>
}

function validateSteps(steps: unknown): { error: string } | { steps: StepInput[] } {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { error: 'steps must be a non-empty array' }
  }
  if (steps.length > 50) {
    return { error: 'workflows may not exceed 50 steps' }
  }

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    if (!s || typeof s !== 'object') {
      return { error: `step[${i}] must be an object` }
    }
    if (!s.name || typeof s.name !== 'string' || !s.name.trim()) {
      return { error: `step[${i}].name is required` }
    }
    if (s.name.trim().length > 120) {
      return { error: `step[${i}].name must be 120 characters or fewer` }
    }
    if (!s.goalTemplate || typeof s.goalTemplate !== 'string' || !s.goalTemplate.trim()) {
      return { error: `step[${i}].goalTemplate is required` }
    }
    if (s.goalTemplate.trim().length > 4000) {
      return { error: `step[${i}].goalTemplate must be 4000 characters or fewer` }
    }
    if (s.dependsOnStepOrder !== undefined) {
      if (
        typeof s.dependsOnStepOrder !== 'number' ||
        !Number.isInteger(s.dependsOnStepOrder) ||
        s.dependsOnStepOrder < 1
      ) {
        return { error: `step[${i}].dependsOnStepOrder must be a positive integer` }
      }
      // A step cannot depend on itself (1-based order = i+1)
      if (s.dependsOnStepOrder === i + 1) {
        return { error: `step[${i}] cannot depend on itself (circular dependency)` }
      }
      // Forward dependency would be circular
      if (s.dependsOnStepOrder > i + 1) {
        return { error: `step[${i}] has a forward dependency on step[${s.dependsOnStepOrder - 1}] — circular` }
      }
    }
    if (s.outputMapping !== undefined && (typeof s.outputMapping !== 'object' || Array.isArray(s.outputMapping))) {
      return { error: `step[${i}].outputMapping must be an object` }
    }
  }

  return { steps: steps as StepInput[] }
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function workflowsRoutes(app: FastifyInstance) {

  // ─── GET /workflows ──────────────────────────────────────────────────────────
  app.get<{ Querystring: { status?: string; page?: string; limit?: string } }>(
    '/workflows',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.user!.id
      const query = request.query as { status?: string; page?: string; limit?: string }

      const page  = Math.max(1, parseInt(query.page  ?? '1',  10) || 1)
      const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '20', 10) || 20))

      if (query.status && !VALID_STATUSES.includes(query.status as WorkflowStatus)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
          },
        })
      }

      const where: Record<string, unknown> = { userId }
      if (query.status) where.status = query.status

      const [total, workflows] = await Promise.all([
        prisma.workflow.count({ where }),
        prisma.workflow.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            triggerType: true,
            createdAt: true,
            _count: { select: { steps: true } },
            runs: {
              orderBy: { startedAt: 'desc' },
              take: 1,
              select: { status: true, startedAt: true, completedAt: true },
            },
          },
        }),
      ])

      const result = workflows.map(({ _count, runs, ...wf }) => ({
        ...wf,
        stepCount: _count.steps,
        lastRun: runs[0] ?? null,
      }))

      return reply.send({
        success: true,
        data: { workflows: result },
        meta: { page, limit, total },
      })
    },
  )

  // ─── POST /workflows ─────────────────────────────────────────────────────────
  app.post<{
    Body: { name: string; description?: string; steps: StepInput[]; triggerType?: TriggerType; status?: WorkflowStatus }
  }>(
    '/workflows',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.user!.id
      const body = (request.body ?? {}) as {
        name: string
        description?: string
        steps: StepInput[]
        triggerType?: TriggerType
        status?: WorkflowStatus
      }

      // Name validation
      if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'name is required' },
        })
      }
      if (body.name.trim().length > 120) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'name must be 120 characters or fewer' },
        })
      }
      if (body.description !== undefined && typeof body.description !== 'string') {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'description must be a string' },
        })
      }
      if (body.description && body.description.length > 1000) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'description must be 1000 characters or fewer' },
        })
      }
      if (body.triggerType && !VALID_TRIGGER_TYPES.includes(body.triggerType)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `triggerType must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`,
          },
        })
      }
      if (body.status && !VALID_STATUSES.includes(body.status)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
          },
        })
      }

      const stepsResult = validateSteps(body.steps)
      if ('error' in stepsResult) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: stepsResult.error },
        })
      }

      // Generate webhook secret when trigger is webhook
      const webhookSecret =
        body.triggerType === 'webhook' ? await generateWebhookSecret() : null

      const workflow = await prisma.$transaction(async (tx) => {
        const wf = await tx.workflow.create({
          data: {
            userId,
            name: body.name.trim(),
            description: body.description?.trim() ?? null,
            triggerType: body.triggerType ?? 'manual',
            status: (body.status ?? 'DRAFT') as any,
            webhookSecret,
          },
        })

        // Pass 1: create steps without cross-references
        const steps = await Promise.all(
          stepsResult.steps.map((step, idx) =>
            tx.workflowStep.create({
              data: {
                workflowId: wf.id,
                stepOrder: idx + 1,
                name: step.name.trim(),
                goalTemplate: step.goalTemplate.trim(),
                templateId: step.templateId ?? null,
                assignedModel: step.assignedModel ?? null,
                outputMapping: step.outputMapping ?? {},
              },
            }),
          ),
        )

        // Pass 2: link dependsOnStepId by resolving dependsOnStepOrder → step ID
        await Promise.all(
          stepsResult.steps.map((step, idx) => {
            if (step.dependsOnStepOrder == null) return Promise.resolve()
            const depStep = steps[step.dependsOnStepOrder - 1]
            if (!depStep) return Promise.resolve()
            return tx.workflowStep.update({
              where: { id: steps[idx].id },
              data:  { dependsOnStepId: depStep.id },
            })
          }),
        )

        return { ...wf, steps }
      })

      return reply.status(201).send({
        success: true,
        data: { workflow },
      })
    },
  )

  // ─── GET /workflows/:id ──────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/workflows/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id

      const workflow = await prisma.workflow.findFirst({
        where: { id, userId },
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
          runs: {
            orderBy: { startedAt: 'desc' },
            take: 5,
            include: {
              stepRuns: {
                select: {
                  id: true,
                  stepId: true,
                  status: true,
                  startedAt: true,
                  completedAt: true,
                  taskId: true,
                },
              },
            },
          },
        },
      })

      if (!workflow) {
        return reply.status(404).send({
          success: false,
          error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found' },
        })
      }

      return reply.send({ success: true, data: { workflow } })
    },
  )

  // ─── PATCH /workflows/:id ────────────────────────────────────────────────────
  app.patch<{
    Params: { id: string }
    Body: { name?: string; description?: string; status?: WorkflowStatus; triggerType?: TriggerType; steps?: StepInput[] }
  }>(
    '/workflows/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id
      const body = (request.body ?? {}) as {
        name?: string
        description?: string
        status?: WorkflowStatus
        triggerType?: TriggerType
        steps?: StepInput[]
      }

      // Ownership check
      const existing = await prisma.workflow.findFirst({
        where: { id, userId },
        select: { id: true, triggerType: true },
      })
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found' },
        })
      }

      // Validate fields that were provided
      if (body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
          return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'name must be a non-empty string' },
          })
        }
        if (body.name.trim().length > 120) {
          return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'name must be 120 characters or fewer' },
          })
        }
      }
      if (body.description !== undefined && typeof body.description !== 'string') {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'description must be a string' },
        })
      }
      if (body.status && !VALID_STATUSES.includes(body.status)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
          },
        })
      }
      if (body.triggerType && !VALID_TRIGGER_TYPES.includes(body.triggerType)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `triggerType must be one of: ${VALID_TRIGGER_TYPES.join(', ')}`,
          },
        })
      }

      let stepsResult: { steps: StepInput[] } | null = null
      if (body.steps !== undefined) {
        const result = validateSteps(body.steps)
        if ('error' in result) {
          return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: result.error },
          })
        }
        stepsResult = result
      }

      // Generate new webhook secret if trigger type is changing to webhook
      let webhookSecret: string | undefined
      if (body.triggerType === 'webhook' && existing.triggerType !== 'webhook') {
        webhookSecret = await generateWebhookSecret()
      }

      const workflow = await prisma.$transaction(async (tx) => {
        const updateData: Record<string, unknown> = {}
        if (body.name !== undefined)        updateData.name = body.name!.trim()
        if (body.description !== undefined) updateData.description = body.description?.trim() ?? null
        if (body.status !== undefined)      updateData.status = body.status
        if (body.triggerType !== undefined) updateData.triggerType = body.triggerType
        if (webhookSecret)                  updateData.webhookSecret = webhookSecret

        const wf = await tx.workflow.update({
          where: { id },
          data: updateData,
        })

        // Replace all steps atomically if provided
        if (stepsResult) {
          await tx.workflowStep.deleteMany({ where: { workflowId: id } })
          const newSteps = await Promise.all(
            stepsResult.steps.map((step, idx) =>
              tx.workflowStep.create({
                data: {
                  workflowId: id,
                  stepOrder: idx + 1,
                  name: step.name.trim(),
                  goalTemplate: step.goalTemplate.trim(),
                  templateId: step.templateId ?? null,
                  assignedModel: step.assignedModel ?? null,
                  outputMapping: step.outputMapping ?? {},
                },
              }),
            ),
          )
          await Promise.all(
            stepsResult.steps.map((step, idx) => {
              if (step.dependsOnStepOrder == null) return Promise.resolve()
              const depStep = newSteps[step.dependsOnStepOrder - 1]
              if (!depStep) return Promise.resolve()
              return tx.workflowStep.update({
                where: { id: newSteps[idx].id },
                data:  { dependsOnStepId: depStep.id },
              })
            }),
          )
        }

        return tx.workflow.findUnique({
          where: { id },
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        })
      })

      return reply.send({ success: true, data: { workflow } })
    },
  )

  // ─── DELETE /workflows/:id ───────────────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/workflows/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id

      const existing = await prisma.workflow.findFirst({
        where: { id, userId },
        select: { id: true },
      })
      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found' },
        })
      }

      // WorkflowRun and WorkflowStepRun cascade-delete via onDelete: Cascade in schema.
      // We only need to explicitly delete steps (no cascade from Workflow to WorkflowStep needed here).
      await prisma.workflow.delete({ where: { id } })

      return reply.status(204).send()
    },
  )

  // ─── POST /workflows/:id/run ─────────────────────────────────────────────────
  app.post<{ Params: { id: string }; Body: { triggerPayload?: Record<string, string> } }>(
    '/workflows/:id/run',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id
      const body = (request.body ?? {}) as { triggerPayload?: Record<string, string> }

      // Validate optional triggerPayload
      if (
        body.triggerPayload !== undefined &&
        (typeof body.triggerPayload !== 'object' ||
          Array.isArray(body.triggerPayload) ||
          Object.values(body.triggerPayload).some((v) => typeof v !== 'string'))
      ) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'triggerPayload must be an object with string values',
          },
        })
      }

      const workflow = await prisma.workflow.findFirst({
        where: { id, userId },
        select: { id: true, status: true },
      })
      if (!workflow) {
        return reply.status(404).send({
          success: false,
          error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found' },
        })
      }
      if (workflow.status !== 'ACTIVE') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'WORKFLOW_NOT_ACTIVE',
            message: 'Workflow must be ACTIVE to run — update its status first',
          },
        })
      }

      const { runId, status } = await runWorkflow(id, 'manual', body.triggerPayload ?? {})

      return reply.status(202).send({
        success: true,
        data: {
          runId,
          status,
          message: 'Workflow run started',
        },
      })
    },
  )

  // ─── GET /workflows/:id/runs ─────────────────────────────────────────────────
  app.get<{ Params: { id: string }; Querystring: { page?: string; limit?: string } }>(
    '/workflows/:id/runs',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params
      const userId = request.user!.id
      const query = request.query as { page?: string; limit?: string }

      const page  = Math.max(1, parseInt(query.page  ?? '1',  10) || 1)
      const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '20', 10) || 20))

      const workflow = await prisma.workflow.findFirst({
        where: { id, userId },
        select: { id: true },
      })
      if (!workflow) {
        return reply.status(404).send({
          success: false,
          error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found' },
        })
      }

      const [total, runs] = await Promise.all([
        prisma.workflowRun.count({ where: { workflowId: id } }),
        prisma.workflowRun.findMany({
          where: { workflowId: id },
          orderBy: { startedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            status: true,
            triggerType: true,
            startedAt: true,
            completedAt: true,
            stepRuns: {
              select: {
                id: true,
                stepId: true,
                status: true,
                startedAt: true,
                completedAt: true,
                taskId: true,
              },
            },
          },
        }),
      ])

      return reply.send({
        success: true,
        data: { runs },
        meta: { page, limit, total },
      })
    },
  )

  // ─── GET /workflows/:id/runs/:runId ──────────────────────────────────────────
  app.get<{ Params: { id: string; runId: string } }>(
    '/workflows/:id/runs/:runId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id, runId } = request.params
      const userId = request.user!.id

      // Ownership via workflow
      const workflow = await prisma.workflow.findFirst({
        where: { id, userId },
        select: { id: true },
      })
      if (!workflow) {
        return reply.status(404).send({
          success: false,
          error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found' },
        })
      }

      const run = await prisma.workflowRun.findFirst({
        where: { id: runId, workflowId: id },
        include: {
          stepRuns: {
            orderBy: { startedAt: 'asc' },
          },
        },
      })

      if (!run) {
        return reply.status(404).send({
          success: false,
          error: { code: 'RUN_NOT_FOUND', message: 'Workflow run not found' },
        })
      }

      return reply.send({ success: true, data: { run } })
    },
  )

  // ─── POST /webhooks/workflow/:workflowId/trigger ──────────────────────────────
  // Public route — authenticated by HMAC signature in x-sabha-signature header.
  // Expects header: x-sabha-signature: sha256={hex_hmac}
  app.post(
    '/webhooks/workflow/:workflowId/trigger',
    async (
      request: FastifyRequest<{
        Params: { workflowId: string }
        Body: Record<string, unknown>
      }>,
      reply: FastifyReply,
    ) => {
      const { workflowId } = request.params
      const signature = request.headers['x-sabha-signature'] as string | undefined

      if (!signature || typeof signature !== 'string' || !signature.startsWith('sha256=')) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'MISSING_SIGNATURE',
            message: 'x-sabha-signature header is required (format: sha256={hmac})',
          },
        })
      }

      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        select: { id: true, status: true, triggerType: true, webhookSecret: true },
      })

      if (!workflow) {
        return reply.status(404).send({
          success: false,
          error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found' },
        })
      }

      if (workflow.status !== 'ACTIVE') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'WORKFLOW_NOT_ACTIVE',
            message: 'This workflow is not active',
          },
        })
      }

      if (workflow.triggerType !== 'webhook') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'INVALID_TRIGGER_TYPE',
            message: 'This workflow is not configured for webhook triggers',
          },
        })
      }

      if (!workflow.webhookSecret) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'WEBHOOK_NOT_CONFIGURED',
            message: 'Webhook secret is not configured for this workflow',
          },
        })
      }

      // Validate HMAC signature
      const rawBody = JSON.stringify(request.body ?? {})
      const isValid = await validateWebhookSignature(signature, rawBody, workflow.webhookSecret)
      if (!isValid) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Webhook signature verification failed',
          },
        })
      }

      const triggerPayload = (request.body ?? {}) as Record<string, string>
      const { runId, status } = await runWorkflow(workflowId, 'webhook', triggerPayload)

      return reply.status(202).send({
        success: true,
        data: { runId, status },
      })
    },
  )
}
