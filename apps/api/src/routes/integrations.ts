/**
 * Integrations Routes
 *
 * Integration management:
 *   GET    /integrations              — list user's integrations (no tokens in response)
 *   POST   /integrations              — connect integration
 *   DELETE /integrations/:id          — disconnect
 *   PUT    /integrations/:id/activate — toggle isActive
 *
 * Execution action management:
 *   GET    /actions                   — list pending actions for user (paginated)
 *   GET    /actions/:id               — get action detail
 *   POST   /actions/:id/approve       — approve + execute
 *   POST   /actions/:id/reject        — reject (body: { reason })
 *   GET    /tasks/:taskId/actions     — get all actions for a task
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { encryptByoai } from '../lib/encrypt'
import { approveAction, rejectAction } from '../lib/integration-executor'

export async function integrationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // ─── GET /integrations ────────────────────────────────────────────────────────
  app.get(
    '/integrations',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id

      const integrations = await prisma.userIntegration.findMany({
        where: { userId },
        select: {
          id: true,
          provider: true,
          displayName: true,
          isActive: true,
          scopes: true,
          metadata: true,
          connectedAt: true,
          lastUsedAt: true,
          tokenExpiresAt: true,
          // Intentionally exclude: encryptedToken, tokenIv, tokenAuthTag, refreshToken, etc.
        },
        orderBy: { connectedAt: 'desc' },
      })

      return reply.send({ success: true, data: { integrations } })
    },
  )

  // ─── POST /integrations ───────────────────────────────────────────────────────
  app.post(
    '/integrations',
    async (
      request: FastifyRequest<{
        Body: {
          provider: string
          displayName: string
          accessToken: string
          refreshToken?: string
          scopes?: string[]
          metadata?: Record<string, unknown>
        }
      }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id
      const body = request.body as {
        provider: string
        displayName: string
        accessToken: string
        refreshToken?: string
        scopes?: string[]
        metadata?: Record<string, unknown>
      }

      if (!body?.provider || !body?.accessToken || !body?.displayName) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'provider, displayName and accessToken are required' },
        })
      }

      // Validate provider is a known enum value
      const validProviders = ['GITHUB', 'GMAIL', 'NOTION', 'SLACK', 'JIRA', 'LINEAR', 'WEBHOOK']
      if (!validProviders.includes(body.provider.toUpperCase())) {
        return reply.status(400).send({
          success: false,
          error: { code: 'UNKNOWN_PROVIDER', message: `Unknown provider: ${body.provider}` },
        })
      }

      const provider = body.provider.toUpperCase() as
        'GITHUB' | 'GMAIL' | 'NOTION' | 'SLACK' | 'JIRA' | 'LINEAR' | 'WEBHOOK'

      // Encrypt the access token
      const { encryptedValue: encryptedToken, iv: tokenIv, authTag: tokenAuthTag } =
        encryptByoai(body.accessToken)

      // Encrypt refresh token if provided
      let refreshTokenData: {
        refreshToken?: string
        refreshIv?: string
        refreshAuthTag?: string
      } = {}

      if (body.refreshToken) {
        const { encryptedValue, iv, authTag } = encryptByoai(body.refreshToken)
        refreshTokenData = {
          refreshToken: encryptedValue,
          refreshIv: iv,
          refreshAuthTag: authTag,
        }
      }

      try {
        const integration = await prisma.userIntegration.create({
          data: {
            userId,
            provider,
            displayName: body.displayName,
            encryptedToken,
            tokenIv,
            tokenAuthTag,
            ...refreshTokenData,
            scopes: body.scopes || [],
            metadata: (body.metadata || {}) as any,
            isActive: true,
          },
          select: {
            id: true,
            provider: true,
            displayName: true,
            isActive: true,
            scopes: true,
            connectedAt: true,
          },
        })

        return reply.status(201).send({ success: true, data: { integration } })
      } catch (err: unknown) {
        // Handle unique constraint violation (userId + provider + displayName)
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'DUPLICATE_INTEGRATION',
              message: `An integration named "${body.displayName}" already exists for provider ${provider}`,
            },
          })
        }
        throw err
      }
    },
  )

  // ─── DELETE /integrations/:id ─────────────────────────────────────────────────
  app.delete(
    '/integrations/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const userId = request.user!.id

      const integration = await prisma.userIntegration.findFirst({
        where: { id, userId },
        select: { id: true },
      })

      if (!integration) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Integration not found' },
        })
      }

      await prisma.userIntegration.delete({ where: { id } })

      return reply.send({ success: true, data: { message: 'Integration disconnected' } })
    },
  )

  // ─── PUT /integrations/:id/activate ──────────────────────────────────────────
  app.put(
    '/integrations/:id/activate',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { isActive?: boolean } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const userId = request.user!.id
      const body = request.body as { isActive?: boolean } | undefined

      const integration = await prisma.userIntegration.findFirst({
        where: { id, userId },
        select: { id: true, isActive: true },
      })

      if (!integration) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Integration not found' },
        })
      }

      // Toggle isActive if no explicit value provided, otherwise use the provided value
      const newIsActive = typeof body?.isActive === 'boolean' ? body.isActive : !integration.isActive

      const updated = await prisma.userIntegration.update({
        where: { id },
        data: { isActive: newIsActive },
        select: { id: true, provider: true, displayName: true, isActive: true },
      })

      return reply.send({ success: true, data: { integration: updated } })
    },
  )

  // ─── GET /actions ─────────────────────────────────────────────────────────────
  app.get(
    '/actions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id
      const query = request.query as { page?: string; limit?: string; status?: string }

      const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
      const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20', 10) || 20))
      const status = (query.status as string | undefined) || 'PENDING_APPROVAL'

      const where = {
        userId,
        status: status as 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'EXPIRED',
      }

      const [actions, total] = await Promise.all([
        prisma.executionAction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            type: true,
            status: true,
            requiresApproval: true,
            createdAt: true,
            expiresAt: true,
            approvedAt: true,
            rejectedAt: true,
            executedAt: true,
            task: { select: { id: true, title: true } },
            subtask: { select: { id: true, title: true } },
            integration: { select: { id: true, provider: true, displayName: true } },
          },
        }),
        prisma.executionAction.count({ where }),
      ])

      return reply.send({
        success: true,
        data: { actions },
        meta: { page, limit, total },
      })
    },
  )

  // ─── GET /actions/:id ─────────────────────────────────────────────────────────
  app.get(
    '/actions/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const userId = request.user!.id

      const action = await prisma.executionAction.findFirst({
        where: { id, userId },
        include: {
          task: { select: { id: true, title: true } },
          subtask: { select: { id: true, title: true } },
          integration: { select: { id: true, provider: true, displayName: true } },
        },
      })

      if (!action) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Action not found' },
        })
      }

      return reply.send({ success: true, data: { action } })
    },
  )

  // ─── POST /actions/:id/approve ────────────────────────────────────────────────
  app.post(
    '/actions/:id/approve',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const userId = request.user!.id

      const action = await prisma.executionAction.findFirst({
        where: { id, userId },
        select: { id: true, status: true, expiresAt: true },
      })

      if (!action) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Action not found' },
        })
      }

      if (action.status !== 'PENDING_APPROVAL') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: `Action cannot be approved from status: ${action.status}`,
          },
        })
      }

      if (action.expiresAt && action.expiresAt < new Date()) {
        return reply.status(410).send({
          success: false,
          error: { code: 'ACTION_EXPIRED', message: 'This action has expired' },
        })
      }

      // Approve and execute (non-blocking)
      approveAction(id, userId).catch((err) => {
        app.log.error({ err, actionId: id }, 'Action approval/execution failed')
      })

      return reply.send({
        success: true,
        data: { message: 'Action approved and execution started', actionId: id },
      })
    },
  )

  // ─── POST /actions/:id/reject ─────────────────────────────────────────────────
  app.post(
    '/actions/:id/reject',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const userId = request.user!.id
      const body = request.body as { reason?: string } | undefined
      const reason = body?.reason?.trim() || 'Rejected by user'

      const action = await prisma.executionAction.findFirst({
        where: { id, userId },
        select: { id: true, status: true },
      })

      if (!action) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Action not found' },
        })
      }

      if (action.status !== 'PENDING_APPROVAL') {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: `Action cannot be rejected from status: ${action.status}`,
          },
        })
      }

      await rejectAction(id, userId, reason)

      return reply.send({
        success: true,
        data: { message: 'Action rejected', actionId: id },
      })
    },
  )

  // ─── GET /tasks/:taskId/actions ───────────────────────────────────────────────
  app.get(
    '/tasks/:taskId/actions',
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

      const actions = await prisma.executionAction.findMany({
        where: { taskId },
        include: {
          subtask: { select: { id: true, title: true } },
          integration: { select: { id: true, provider: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return reply.send({ success: true, data: { actions } })
    },
  )
}
