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
 */

import type { FastifyInstance } from 'fastify'
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
} from '../lib/session-manager'

// ─── Validation helpers ───────────────────────────────────────────────────────

function isPositiveInt(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val > 0
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function sessionsRoutes(app: FastifyInstance) {

  // ─── POST /tasks/:taskId/session ────────────────────────────────────────────
  app.post<{
    Params: { taskId: string }
    Body: { isPublic?: boolean; allowSteering?: boolean; expiresInHours?: number }
  }>(
    '/tasks/:taskId/session',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { taskId } = request.params
      const userId = request.user!.id
      const body = (request.body ?? {}) as {
        isPublic?: boolean
        allowSteering?: boolean
        expiresInHours?: number
      }

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

      const existing = await prisma.roundtableSession.findFirst({
        where: { taskId },
        select: { id: true, accessCode: true, isPublic: true, allowSteering: true, expiresAt: true },
      })

      if (existing) {
        const shareUrl = `${process.env.WEB_URL}/roundtable/${taskId}?code=${existing.accessCode}`
        return reply.send({ success: true, data: { session: { ...existing, shareUrl } } })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, avatarUrl: true },
      })

      const session = await createSession({
        taskId,
        ownerId: userId,
        ownerName: user?.name ?? 'Owner',
        ownerAvatar: user?.avatarUrl ?? undefined,
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
  app.get<{ Params: { code: string } }>(
    '/sessions/:code',
    async (request, reply) => {
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
            participantCount: session.participants.length,
          },
        },
      })
    },
  )

  // ─── POST /sessions/:code/join ───────────────────────────────────────────────
  app.post<{
    Params: { code: string }
    Body: { displayName?: string }
  }>(
    '/sessions/:code/join',
    async (request, reply) => {
      const { code } = request.params
      const body = (request.body ?? {}) as { displayName?: string }

      let authenticatedUser: { id: string; email: string; tier: string; status: string; name?: string; avatarUrl?: string } | null = null
      try {
        const payload = await request.jwtVerify<{ sub: string }>()
        authenticatedUser = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, tier: true, status: true, name: true, avatarUrl: true } as any,
        }) as any
        if (authenticatedUser?.status !== 'ACTIVE') authenticatedUser = null
      } catch {
        // Guest path
      }

      if (!authenticatedUser) {
        if (!body.displayName || typeof body.displayName !== 'string' || !body.displayName.trim()) {
          return reply.status(400).send({
            success: false,
            error: { code: 'DISPLAY_NAME_REQUIRED', message: 'displayName is required for guest participants' },
          })
        }
        if (body.displayName.trim().length > 30) {
          return reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'displayName must be 30 characters or fewer' },
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

      const result = await joinSession(
        session.id,
        authenticatedUser?.id ?? null,
        authenticatedUser ? (authenticatedUser.name ?? authenticatedUser.email) : body.displayName!.trim(),
        authenticatedUser?.avatarUrl ?? undefined,
      )

      return reply.status(201).send({
        success: true,
        data: {
          participantId: result.participantId,
          role: result.role,
          sessionId: session.id,
        },
      })
    },
  )

  // ─── POST /sessions/:sessionId/leave ─────────────────────────────────────────
  app.post<{
    Params: { sessionId: string }
    Body: { participantId: string }
  }>(
    '/sessions/:sessionId/leave',
    async (request, reply) => {
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
  app.post<{
    Params: { sessionId: string }
    Body: { participantId: string }
  }>(
    '/sessions/:sessionId/heartbeat',
    async (request, reply) => {
      const body = (request.body ?? {}) as { participantId: string }

      if (!body.participantId || typeof body.participantId !== 'string') {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'participantId is required' },
        })
      }

      await heartbeat(body.participantId)

      return reply.status(200).send({ success: true, data: {} })
    },
  )

  // ─── GET /sessions/:sessionId/participants ───────────────────────────────────
  app.get<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId/participants',
    async (request, reply) => {
      const { sessionId } = request.params
      const participants = await getOnlineParticipants(sessionId)
      return reply.send({ success: true, data: { participants } })
    },
  )

  // ─── POST /tasks/:taskId/reactions ───────────────────────────────────────────
  app.post<{
    Params: { taskId: string }
    Body: { subtaskId?: string; reaction: string; participantId?: string }
  }>(
    '/tasks/:taskId/reactions',
    async (request, reply) => {
      const { taskId } = request.params
      const body = (request.body ?? {}) as {
        subtaskId?: string
        reaction: string
        participantId?: string
      }

      let userId: string | null = null
      try {
        const payload = await request.jwtVerify<{ sub: string }>()
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, status: true },
        })
        if (user?.status === 'ACTIVE') userId = user.id
      } catch {
        // Guest path
      }

      if (!userId && !body.participantId) {
        return reply.status(401).send({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Must be authenticated or provide a participantId' },
        })
      }

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

      const session = await prisma.roundtableSession.findFirst({
        where: { taskId },
        select: { id: true },
      })
      if (!session) {
        return reply.status(404).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'No active session found for this task' },
        })
      }

      await addReaction(session.id, body.subtaskId ?? null, userId, body.reaction.trim())

      return reply.status(201).send({ success: true, data: {} })
    },
  )

  // ─── GET /tasks/:taskId/reactions ────────────────────────────────────────────
  app.get<{ Params: { taskId: string } }>(
    '/tasks/:taskId/reactions',
    async (request, reply) => {
      const { taskId } = request.params

      const session = await prisma.roundtableSession.findFirst({
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
      return reply.send({ success: true, data: { reactions } })
    },
  )

  // ─── PATCH /sessions/:sessionId/settings ─────────────────────────────────────
  app.patch<{
    Params: { sessionId: string }
    Body: { allowSteering?: boolean; isPublic?: boolean }
  }>(
    '/sessions/:sessionId/settings',
    { preHandler: [requireAuth] },
    async (request, reply) => {
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

      const session = await prisma.roundtableSession.findUnique({
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

      const updated = await prisma.roundtableSession.update({
        where: { id: sessionId },
        data: updateData,
        select: { id: true, isPublic: true, allowSteering: true, expiresAt: true, accessCode: true },
      })

      return reply.send({ success: true, data: { session: updated } })
    },
  )
}
