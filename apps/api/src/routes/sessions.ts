/**
 * Multiplayer roundtable session routes.
 *
 * Routes:
 *   POST   /tasks/:taskId/session           — create or return existing session
 *   GET    /sessions/:code                  — public: resolve session by access code
 *   POST   /sessions/:code/join             — join session (auth optional, guests supported)
 *   POST   /sessions/:sessionId/leave       — leave session
 *   POST   /sessions/:sessionId/heartbeat   — lightweight presence heartbeat
 *   GET    /sessions/:sessionId/participants — list online participants
 *   POST   /tasks/:taskId/reactions         — add reaction (auth or guest with participantId)
 *   GET    /tasks/:taskId/reactions         — list all reactions for task's session
 *   PATCH  /sessions/:sessionId/settings    — update session settings (owner only)
 *
 * Rate limiting notes:
 *   - /join         → rate-limited to 10 req/min per IP by upstream middleware
 *   - /heartbeat    → rate-limited to 120 req/min per IP (every 30s client cadence)
 *   - /reactions    → rate-limited to 30 req/min per IP
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import {
  createSession,
  getSessionByCode,
  joinSession,
  leaveSession,
  heartbeat,
  getOnlineParticipants,
  addReaction,
  getReactions,
  pruneStaleParticipants,
} from '../lib/session-manager'

// ─── Validation helpers ───────────────────────────────────────────────────────

function isPositiveInt(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val > 0
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function sessionsRoutes(app: FastifyInstance) {

  // ─── POST /tasks/:taskId/session ────────────────────────────────────────────
  // requireAuth — create a multiplayer session for a task the caller owns.
  // Returns the existing session unchanged if one already exists.
  app.post(
    '/tasks/:taskId/session',
    { preHandler: [requireAuth] },
    async (
      request: FastifyRequest<{
        Params: { taskId: string }
        Body: { isPublic?: boolean; allowSteering?: boolean; expiresInHours?: number }
      }>,
      reply: FastifyReply,
    ) => {
      const { taskId } = request.params
      const userId = request.user!.id
      const body = (request.body ?? {}) as {
        isPublic?: boolean
        allowSteering?: boolean
        expiresInHours?: number
      }

      // Type-check optional body fields
      if (body.isPublic !== undefined && typeof body.isPublic !== 'boolean') {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'isPublic must be a boolean' },
        })
      }
      if (body.allowSteering !== undefined && typeof body.allowSteering !== 'boolean') {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'allowSteering must be a boolean' },
        })
      }
      if (
        body.expiresInHours !== undefined &&
        (!isPositiveInt(body.expiresInHours) || body.expiresInHours > 168)
      ) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'expiresInHours must be a positive integer ≤ 168 (1 week)',
          },
        })
      }

      // Ownership check
      const task = await prisma.task.findFirst({
        where: { id: taskId, userId },
        select: { id: true },
      })
      if (!task) {
        return reply.status(404).send({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: 'Task not found or access denied' },
        })
      }

      // Return existing session if one already exists for this task
      const existing = await (prisma as any).roundtableSession?.findFirst({
        where: { taskId },
        select: {
          id: true,
          accessCode: true,
          isPublic: true,
          allowSteering: true,
          expiresAt: true,
        },
      })

      if (existing) {
        const shareUrl = `${process.env.WEB_URL}/roundtable/${taskId}?code=${existing.accessCode}`
        return reply.send({
          success: true,
          data: { session: { ...existing, shareUrl } },
        })
      }

      const session = await createSession(taskId, {
        isPublic: body.isPublic ?? false,
        allowSteering: body.allowSteering ?? false,
        expiresInHours: body.expiresInHours ?? 24,
      })

      const shareUrl = `${process.env.WEB_URL}/roundtable/${taskId}?code=${session.accessCode}`

      return reply.status(201).send({
        success: true,
        data: {
          session: {
            id: session.id,
            accessCode: session.accessCode,
            shareUrl,
            isPublic: session.isPublic,
            allowSteering: session.allowSteering,
            expiresAt: session.expiresAt,
          },
        },
      })
    },
  )

  // ─── GET /sessions/:code ─────────────────────────────────────────────────────
  // Public — no auth required. Resolves session metadata by its short access code.
  app.get(
    '/sessions/:code',
    async (
      request: FastifyRequest<{ Params: { code: string } }>,
      reply: FastifyReply,
    ) => {
      const { code } = request.params

      if (!code || typeof code !== 'string' || code.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'code is required' },
        })
      }

      const session = await getSessionByCode(code.trim().toUpperCase())

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or has expired' },
        })
      }

      // Expired sessions are logically absent
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        return reply.status(404).send({
          success: false,
          error: { code: 'SESSION_EXPIRED', message: 'This session has expired' },
        })
      }

      return reply.send({
        success: true,
        data: {
          session: {
            id: session.id,
            taskId: session.taskId,
            task: session.task,
            isPublic: session.isPublic,
            allowSteering: session.allowSteering,
            participantCount: session.participantCount,
          },
        },
      })
    },
  )

  // ─── POST /sessions/:code/join ───────────────────────────────────────────────
  // Auth optional. Authenticated users supply nothing extra; guests supply displayName.
  app.post(
    '/sessions/:code/join',
    async (
      request: FastifyRequest<{
        Params: { code: string }
        Body: { displayName?: string }
      }>,
      reply: FastifyReply,
    ) => {
      const { code } = request.params
      const body = (request.body ?? {}) as { displayName?: string }

      // Attempt to verify JWT — soft auth (ignore failure)
      let authenticatedUser: { id: string; email: string; tier: string; status: string } | null = null
      try {
        const payload = await request.jwtVerify<{ sub: string }>()
        authenticatedUser = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, tier: true, status: true, name: true, avatarUrl: true } as any,
        }) as any
        if (authenticatedUser?.status !== 'ACTIVE') authenticatedUser = null
      } catch {
        // No token or invalid — guest path
      }

      // Guest validation
      if (!authenticatedUser) {
        if (!body.displayName || typeof body.displayName !== 'string' || !body.displayName.trim()) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'DISPLAY_NAME_REQUIRED',
              message: 'displayName is required for guest participants',
            },
          })
        }
        if (body.displayName.trim().length > 30) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'displayName must be 30 characters or fewer',
            },
          })
        }
      }

      const session = await getSessionByCode(code.trim().toUpperCase())
      if (!session) {
        return reply.status(404).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or has expired' },
        })
      }

      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        return reply.status(404).send({
          success: false,
          error: { code: 'SESSION_EXPIRED', message: 'This session has expired' },
        })
      }

      const participant = await joinSession(session.id, {
        userId: (authenticatedUser as any)?.id ?? null,
        displayName: authenticatedUser
          ? ((authenticatedUser as any).name ?? (authenticatedUser as any).email)
          : body.displayName!.trim(),
        avatarUrl: authenticatedUser ? ((authenticatedUser as any).avatarUrl ?? null) : null,
        isGuest: !authenticatedUser,
      })

      return reply.status(201).send({
        success: true,
        data: {
          participantId: participant.id,
          role: participant.role,
          sessionId: session.id,
        },
      })
    },
  )

  // ─── POST /sessions/:sessionId/leave ─────────────────────────────────────────
  // Auth optional. Participant identified by participantId in body.
  app.post(
    '/sessions/:sessionId/leave',
    async (
      request: FastifyRequest<{
        Params: { sessionId: string }
        Body: { participantId: string }
      }>,
      reply: FastifyReply,
    ) => {
      const { sessionId } = request.params
      const body = (request.body ?? {}) as { participantId: string }

      if (!body.participantId || typeof body.participantId !== 'string' || !body.participantId.trim()) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'participantId is required' },
        })
      }

      await leaveSession(sessionId, body.participantId.trim())

      return reply.status(204).send()
    },
  )

  // ─── POST /sessions/:sessionId/heartbeat ─────────────────────────────────────
  // Lightweight keep-alive — no auth required. Clients call every ~30s.
  app.post(
    '/sessions/:sessionId/heartbeat',
    async (
      request: FastifyRequest<{
        Params: { sessionId: string }
        Body: { participantId: string }
      }>,
      reply: FastifyReply,
    ) => {
      const { sessionId } = request.params
      const body = (request.body ?? {}) as { participantId: string }

      if (!body.participantId || typeof body.participantId !== 'string') {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'participantId is required' },
        })
      }

      await heartbeat(sessionId, body.participantId)

      return reply.status(200).send({ success: true, data: {} })
    },
  )

  // ─── GET /sessions/:sessionId/participants ───────────────────────────────────
  // Returns currently online participants for the session.
  app.get(
    '/sessions/:sessionId/participants',
    async (
      request: FastifyRequest<{ Params: { sessionId: string } }>,
      reply: FastifyReply,
    ) => {
      const { sessionId } = request.params

      const participants = await getOnlineParticipants(sessionId)

      return reply.send({
        success: true,
        data: { participants },
      })
    },
  )

  // ─── POST /tasks/:taskId/reactions ───────────────────────────────────────────
  // Auth required for logged-in users; guests may use participantId instead.
  // Rate limiting notes: throttled to 30/min per IP by upstream middleware.
  app.post(
    '/tasks/:taskId/reactions',
    async (
      request: FastifyRequest<{
        Params: { taskId: string }
        Body: { subtaskId?: string; reaction: string; participantId?: string }
      }>,
      reply: FastifyReply,
    ) => {
      const { taskId } = request.params
      const body = (request.body ?? {}) as {
        subtaskId?: string
        reaction: string
        participantId?: string
      }

      // Attempt soft auth
      let userId: string | null = null
      try {
        const payload = await request.jwtVerify<{ sub: string }>()
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, status: true },
        })
        if (user?.status === 'ACTIVE') userId = user.id
      } catch {
        // Guest path — participantId required
      }

      if (!userId && !body.participantId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Must be authenticated or provide a participantId',
          },
        })
      }

      // Validate reaction
      if (!body.reaction || typeof body.reaction !== 'string' || !body.reaction.trim()) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'reaction is required' },
        })
      }
      if (body.reaction.trim().length > 10) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'reaction must be 10 characters or fewer' },
        })
      }

      // Verify session exists for task
      const session = await (prisma as any).roundtableSession?.findFirst({
        where: { taskId },
        select: { id: true },
      })
      if (!session) {
        return reply.status(404).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'No active session found for this task' },
        })
      }

      const result = await addReaction(session.id, {
        taskId,
        subtaskId: body.subtaskId ?? null,
        reaction: body.reaction.trim(),
        userId,
        participantId: body.participantId ?? null,
      })

      return reply.status(201).send({
        success: true,
        data: { reactionId: result.id },
      })
    },
  )

  // ─── GET /tasks/:taskId/reactions ────────────────────────────────────────────
  // Returns all reactions attached to the task's session.
  app.get(
    '/tasks/:taskId/reactions',
    async (
      request: FastifyRequest<{ Params: { taskId: string } }>,
      reply: FastifyReply,
    ) => {
      const { taskId } = request.params

      const session = await (prisma as any).roundtableSession?.findFirst({
        where: { taskId },
        select: { id: true },
      })
      if (!session) {
        return reply.status(404).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'No active session found for this task' },
        })
      }

      const reactions = await getReactions(session.id)

      return reply.send({
        success: true,
        data: { reactions },
      })
    },
  )

  // ─── PATCH /sessions/:sessionId/settings ─────────────────────────────────────
  // requireAuth — only the session owner may update settings.
  app.patch(
    '/sessions/:sessionId/settings',
    { preHandler: [requireAuth] },
    async (
      request: FastifyRequest<{
        Params: { sessionId: string }
        Body: { allowSteering?: boolean; isPublic?: boolean }
      }>,
      reply: FastifyReply,
    ) => {
      const { sessionId } = request.params
      const userId = request.user!.id
      const body = (request.body ?? {}) as { allowSteering?: boolean; isPublic?: boolean }

      if (body.allowSteering !== undefined && typeof body.allowSteering !== 'boolean') {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'allowSteering must be a boolean' },
        })
      }
      if (body.isPublic !== undefined && typeof body.isPublic !== 'boolean') {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'isPublic must be a boolean' },
        })
      }

      // Fetch session + verify ownership via task
      const session = await (prisma as any).roundtableSession?.findUnique({
        where: { id: sessionId },
        include: { task: { select: { userId: true } } },
      })

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
        })
      }

      if (session.task?.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the session owner can update settings' },
        })
      }

      const updateData: Record<string, unknown> = {}
      if (body.allowSteering !== undefined) updateData.allowSteering = body.allowSteering
      if (body.isPublic !== undefined) updateData.isPublic = body.isPublic

      const updated = await (prisma as any).roundtableSession?.update({
        where: { id: sessionId },
        data: updateData,
        select: {
          id: true,
          isPublic: true,
          allowSteering: true,
          expiresAt: true,
          accessCode: true,
        },
      })

      return reply.send({
        success: true,
        data: { session: updated },
      })
    },
  )
}
