/**
 * Code Workspace routes.
 *
 * GET  /api/v1/code-projects/:taskId          — get project (or 404 if not assembled)
 * POST /api/v1/code-projects/:taskId/assemble — manually trigger assembly
 * GET  /api/v1/code-projects/:taskId/download — stream ZIP file
 * POST /api/v1/code-projects/:taskId/push     — push to GitHub
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { assembleCodeProject } from '../lib/code-assembler'
import { buildZip } from '../lib/zip-builder'
import { pushFiles, createRepo, toRepoName } from '../lib/github'
import { decryptGithubToken } from './github-oauth'

export async function codeProjectRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth)

  // ─── GET /:taskId — get project ────────────────────────────────────────────
  app.get('/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const userId = request.user!.id

    // Verify task ownership
    const task = await prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true } })
    if (!task) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } })

    const project = await prisma.codeProject.findUnique({ where: { taskId } })

    return reply.send({
      success: true,
      data: { project: project ?? null },
    })
  })

  // ─── POST /:taskId/assemble — trigger assembly ──────────────────────────────
  app.post('/:taskId/assemble', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const userId = request.user!.id

    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true, title: true, status: true },
    })
    if (!task) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } })
    if (task.status !== 'COMPLETED') {
      return reply.status(400).send({ success: false, error: { code: 'TASK_NOT_COMPLETE', message: 'Task must be completed before assembling workspace' } })
    }

    // Mark as assembling (upsert)
    await prisma.codeProject.upsert({
      where: { taskId },
      update: { status: 'ASSEMBLING' },
      create: {
        taskId,
        userId,
        name:   task.title,
        files:  [],
        status: 'ASSEMBLING',
      },
    })

    // Run assembly (async — don't block response)
    assembleAndSave(taskId, userId, task.title).catch((err) => {
      app.log.error({ err, taskId }, '[code-projects] Assembly failed')
    })

    return reply.status(202).send({ success: true, data: { status: 'ASSEMBLING', message: 'Assembly started' } })
  })

  // ─── GET /:taskId/download — stream ZIP ────────────────────────────────────
  app.get('/:taskId/download', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const userId = request.user!.id

    const task = await prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true } })
    if (!task) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } })

    const project = await prisma.codeProject.findUnique({ where: { taskId } })
    if (!project || project.status !== 'READY') {
      return reply.status(400).send({ success: false, error: { code: 'NOT_READY', message: 'Workspace not ready yet' } })
    }

    const files = (project.files as Array<{ path: string; content: string }>) ?? []
    const zip   = buildZip(files.map((f) => ({ path: f.path, content: f.content })))

    const slug = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40)

    reply.raw.setHeader('Content-Type',        'application/zip')
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`)
    reply.raw.setHeader('Content-Length',      zip.length)
    reply.raw.end(zip)
  })

  // ─── POST /:taskId/push — push to GitHub ───────────────────────────────────
  app.post('/:taskId/push', async (request, reply) => {
    const { taskId }              = request.params as { taskId: string }
    const { repoName, isPrivate } = (request.body as any) ?? {}
    const userId = request.user!.id

    const task = await prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true, title: true } })
    if (!task) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } })

    const project = await prisma.codeProject.findUnique({ where: { taskId } })
    if (!project || project.status !== 'READY') {
      return reply.status(400).send({ success: false, error: { code: 'NOT_READY', message: 'Workspace not ready yet' } })
    }

    const ghConn = await prisma.gitHubConnection.findUnique({ where: { userId } })
    if (!ghConn) {
      return reply.status(400).send({ success: false, error: { code: 'GITHUB_NOT_CONNECTED', message: 'Connect your GitHub account first' } })
    }

    const name  = repoName ? toRepoName(repoName) : toRepoName(task.title)
    const files = (project.files as Array<{ path: string; content: string }>) ?? []

    // Decrypt token for in-memory use only — never log or store the plaintext
    const plaintextToken = decryptGithubToken(ghConn.accessToken)

    try {
      const repo = await createRepo(plaintextToken, name, {
        description: `Generated by Arivarangam — ${task.title}`,
        isPrivate:   isPrivate ?? false,
      })

      const repoUrl = await pushFiles(
        plaintextToken,
        ghConn.login,
        repo.name,
        files,
        `Initial commit — generated by Arivarangam`
      )

      await prisma.codeProject.update({
        where: { taskId },
        data:  { repoUrl, pushedAt: new Date() },
      })

      return reply.send({ success: true, data: { repoUrl, repoName: repo.name } })
    } catch (err: any) {
      request.log.error({ err, taskId }, '[code-projects] GitHub push failed')
      return reply.status(500).send({ success: false, error: { code: 'GITHUB_PUSH_FAILED', message: err.message } })
    }
  })
}

// ─── Internal: run assembly and update DB ─────────────────────────────────────

async function assembleAndSave(taskId: string, userId: string, name: string): Promise<void> {
  try {
    const files = await assembleCodeProject(taskId)
    await prisma.codeProject.update({
      where: { taskId },
      data:  { files: files as any, status: 'READY', name },
    })
  } catch (err) {
    await prisma.codeProject.update({
      where: { taskId },
      data:  { status: 'FAILED' },
    })
    throw err
  }
}

/** Called from queue.ts after a development task completes */
export async function triggerCodeAssembly(taskId: string, userId: string, taskTitle: string): Promise<void> {
  await prisma.codeProject.upsert({
    where:  { taskId },
    update: { status: 'ASSEMBLING' },
    create: { taskId, userId, name: taskTitle, files: [], status: 'ASSEMBLING' },
  })
  await assembleAndSave(taskId, userId, taskTitle)
}
