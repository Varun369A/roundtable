/**
 * edits.ts — Interactive Edit Mode routes
 *
 * POST   /:taskId/edit              — start a new edit session (plan)
 * GET    /:taskId/edits             — list edit sessions for a project
 * POST   /:taskId/edits/:sessionId/approve — approve + apply a plan
 * POST   /:taskId/edits/:sessionId/reject  — reject a plan
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { planEdits, applyEdits } from '../lib/edit-engine'

export async function editRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth)

  // ── POST /:taskId/edit — Start a new edit session ──────────────────────────
  app.post<{
    Params: { taskId: string }
    Body: { message: string }
  }>('/:taskId/edit', async (request, reply) => {
    const { taskId } = request.params
    const { message } = request.body
    const userId = request.user!.id

    if (!message?.trim()) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'message is required' },
      })
    }

    // Verify task ownership + get project
    const project = await prisma.codeProject.findFirst({
      where: { taskId, userId },
      select: { id: true },
    })
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Code project not found' },
      })
    }

    // Create the edit session
    const session = await prisma.editSession.create({
      data: {
        projectId: project.id,
        userId,
        message: message.trim(),
        status: 'PLANNING',
      },
    })

    // Fire off planning in the background (streams SSE events)
    planEdits(project.id, session.id, taskId).catch((err) => {
      app.log.error({ err, sessionId: session.id }, '[EditEngine] planEdits failed')
    })

    return reply.status(202).send({
      success: true,
      data: { sessionId: session.id, status: 'PLANNING' },
    })
  })

  // ── GET /:taskId/edits — List edit sessions ─────────────────────────────────
  app.get<{ Params: { taskId: string } }>('/:taskId/edits', async (request, reply) => {
    const { taskId } = request.params
    const userId = request.user!.id

    const project = await prisma.codeProject.findFirst({
      where: { taskId, userId },
      select: { id: true },
    })
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Code project not found' },
      })
    }

    const sessions = await prisma.editSession.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        message: true,
        status: true,
        plan: true,
        error: true,
        createdAt: true,
      },
    })

    return reply.send({ success: true, data: { sessions } })
  })

  // ── POST /:taskId/edits/:sessionId/approve — Approve + apply ───────────────
  app.post<{
    Params: { taskId: string; sessionId: string }
  }>('/:taskId/edits/:sessionId/approve', async (request, reply) => {
    const { taskId, sessionId } = request.params
    const userId = request.user!.id

    // Verify ownership
    const session = await prisma.editSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, status: true },
    })
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Edit session not found' },
      })
    }
    if (session.status !== 'AWAITING_APPROVAL') {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: `Session is in ${session.status} state, not AWAITING_APPROVAL` },
      })
    }

    // Apply in the background (streams SSE events)
    applyEdits(sessionId, taskId).catch((err) => {
      app.log.error({ err, sessionId }, '[EditEngine] applyEdits failed')
    })

    return reply.send({ success: true, data: { sessionId, status: 'APPLYING' } })
  })

  // ── POST /:taskId/edits/:sessionId/reject — Reject plan ────────────────────
  app.post<{
    Params: { taskId: string; sessionId: string }
  }>('/:taskId/edits/:sessionId/reject', async (request, reply) => {
    const { sessionId } = request.params
    const userId = request.user!.id

    const session = await prisma.editSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, status: true },
    })
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Edit session not found' },
      })
    }
    if (session.status !== 'AWAITING_APPROVAL') {
      return reply.status(409).send({
        success: false,
        error: { code: 'CONFLICT', message: `Session is in ${session.status} state, not AWAITING_APPROVAL` },
      })
    }

    await prisma.editSession.update({
      where: { id: sessionId },
      data: { status: 'FAILED', error: 'Rejected by user' },
    })

    return reply.send({ success: true, data: { sessionId, status: 'FAILED' } })
  })
}
