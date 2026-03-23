/**
 * Corrections & Versioning Routes
 *
 * POST /api/v1/tasks/:taskId/correct          — Submit a correction request
 * GET  /api/v1/tasks/:taskId/corrections      — List all corrections for a task
 * GET  /api/v1/tasks/:taskId/versions         — List all build versions
 * GET  /api/v1/tasks/:taskId/versions/:v      — Get a specific version's full snapshot
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { startCorrection, createTaskVersion } from '../orchestration/correction-engine'

export async function correctionsRoutes(app: FastifyInstance) {

  // ─── POST /tasks/:taskId/correct ─────────────────────────────────────────────
  app.post<{
    Params: { taskId: string }
    Body:   { description: string }
  }>(
    '/tasks/:taskId/correct',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { taskId } = request.params
      const { description } = request.body ?? {} as { description?: string }

      if (!description || typeof description !== 'string' || description.trim().length < 5) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_DESCRIPTION', message: 'description must be at least 5 characters' },
        })
      }
      if (description.length > 2000) {
        return reply.status(400).send({
          success: false,
          error: { code: 'DESCRIPTION_TOO_LONG', message: 'description must be under 2000 characters' },
        })
      }

      const result = await startCorrection({
        taskId,
        userId:   request.user!.id,
        userTier: request.user!.tier as any,
        description: description.trim(),
      })

      return reply.status(202).send({
        success: true,
        data: {
          ...result,
          message: 'Correction queued. Subscribe to the task SSE stream for live updates.',
        },
      })
    },
  )

  // ─── GET /tasks/:taskId/corrections ──────────────────────────────────────────
  app.get<{ Params: { taskId: string } }>(
    '/tasks/:taskId/corrections',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { taskId } = request.params
      const userId = request.user!.id

      const task = await prisma.task.findFirst({
        where:  { id: taskId, userId },
        select: { id: true },
      })
      if (!task) {
        return reply.status(404).send({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: 'Task not found' },
        })
      }

      const corrections = await prisma.taskCorrection.findMany({
        where:   { taskId },
        orderBy: { createdAt: 'asc' },
        select: {
          id:                 true,
          description:        true,
          affectedCategories: true,
          status:             true,
          githubCommitUrl:    true,
          createdAt:          true,
          completedAt:        true,
          resultVersion: { select: { versionNumber: true } },
        },
      })

      return reply.send({ success: true, data: { corrections } })
    },
  )

  // ─── GET /tasks/:taskId/versions ─────────────────────────────────────────────
  app.get<{ Params: { taskId: string } }>(
    '/tasks/:taskId/versions',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { taskId } = request.params
      const userId = request.user!.id

      const task = await prisma.task.findFirst({
        where:  { id: taskId, userId },
        select: { id: true },
      })
      if (!task) {
        return reply.status(404).send({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: 'Task not found' },
        })
      }

      const versions = await prisma.taskVersion.findMany({
        where:   { taskId },
        orderBy: { versionNumber: 'asc' },
        select: {
          id:            true,
          versionNumber: true,
          description:   true,
          githubCommit:  true,
          createdAt:     true,
        },
      })

      return reply.send({ success: true, data: { versions } })
    },
  )

  // ─── GET /tasks/:taskId/versions/:version ─────────────────────────────────────
  app.get<{ Params: { taskId: string; version: string } }>(
    '/tasks/:taskId/versions/:version',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { taskId, version } = request.params
      const userId = request.user!.id
      const versionNumber = Number(version)

      if (!Number.isInteger(versionNumber) || versionNumber < 1) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_VERSION', message: 'Invalid version number' },
        })
      }

      const task = await prisma.task.findFirst({
        where:  { id: taskId, userId },
        select: { id: true },
      })
      if (!task) {
        return reply.status(404).send({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: 'Task not found' },
        })
      }

      const taskVersion = await prisma.taskVersion.findUnique({
        where: { taskId_versionNumber: { taskId, versionNumber } },
        select: {
          id:            true,
          versionNumber: true,
          description:   true,
          snapshot:      true,
          githubCommit:  true,
          createdAt:     true,
        },
      })

      if (!taskVersion) {
        return reply.status(404).send({
          success: false,
          error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionNumber} not found` },
        })
      }

      return reply.send({ success: true, data: { version: taskVersion } })
    },
  )

  // ─── POST /tasks/:taskId/snapshot ────────────────────────────────────────────
  // Manually create a version snapshot (e.g. user wants to save current state)
  app.post<{ Params: { taskId: string }; Body: { description?: string } }>(
    '/tasks/:taskId/snapshot',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { taskId } = request.params
      const userId = request.user!.id
      const description = (request.body as any)?.description?.trim() || 'Manual snapshot'

      const task = await prisma.task.findFirst({
        where:  { id: taskId, userId },
        select: { id: true, status: true },
      })
      if (!task) {
        return reply.status(404).send({
          success: false,
          error: { code: 'TASK_NOT_FOUND', message: 'Task not found' },
        })
      }
      if (task.status !== 'COMPLETED') {
        return reply.status(400).send({
          success: false,
          error: { code: 'TASK_NOT_COMPLETED', message: 'Can only snapshot completed tasks' },
        })
      }

      const version = await createTaskVersion(taskId, description)

      return reply.status(201).send({
        success: true,
        data: { versionNumber: version.versionNumber, id: version.id },
      })
    },
  )
}
