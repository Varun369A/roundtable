/**
 * One-click deploy routes — Phase 2
 *
 * POST /api/v1/deploy/vercel/:taskId  — deploy assembled project to Vercel
 * GET  /api/v1/deploy/:taskId         — get deployment status/url for a task
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'

// ─── Vercel Deployment API ────────────────────────────────────────────────────

async function deployToVercel(
  files: { path: string; content: string }[],
  projectName: string,
  token: string,
): Promise<{ url: string; id: string }> {
  const safeName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50) || 'arivarangam-project'

  const body = {
    name:  safeName,
    files: files.map((f) => ({
      file: f.path,
      data: Buffer.from(f.content, 'utf8').toString('base64'),
      encoding: 'base64',
    })),
    projectSettings: { framework: null },
    target: 'production',
  }

  const res = await fetch('https://api.vercel.com/v13/deployments', {
    method:  'POST',
    headers: {
      'Authorization':  `Bearer ${token}`,
      'Content-Type':   'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any
    throw new Error(err?.error?.message || `Vercel API error ${res.status}`)
  }

  const data = await res.json() as any
  return {
    id:  data.id,
    url: `https://${data.url}`,
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function deployRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth)

  // ─── POST /deploy/vercel/:taskId ──────────────────────────────────────────
  app.post('/deploy/vercel/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const userId     = request.user!.id

    // Verify task ownership
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true, title: true },
    })
    if (!task) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }

    // Get assembled code project
    const project = await prisma.codeProject.findUnique({ where: { taskId } })
    if (!project || project.status !== 'READY') {
      return reply.status(400).send({
        success: false,
        error: { code: 'NOT_READY', message: 'Code project not assembled yet. Try again in a moment.' },
      })
    }

    const files = (project.files as Array<{ path: string; content: string }>) ?? []
    if (files.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_FILES', message: 'No files to deploy' },
      })
    }

    // Get Vercel token — first try user-supplied token in body, then stored integration
    const body = (request.body as any) ?? {}
    let vercelToken: string | null = body.token ?? null

    if (!vercelToken) {
      // Check stored integration
      const integration = await (prisma as any).integration?.findFirst({
        where: { userId, provider: 'VERCEL', isActive: true },
        select: { tokenEncrypted: true },
      }).catch(() => null)

      if (integration?.tokenEncrypted) {
        // Token is stored as plaintext for now (encryption can be added later)
        vercelToken = integration.tokenEncrypted
      }
    }

    if (!vercelToken) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_TOKEN', message: 'Vercel token required. Add it in Settings → Integrations or pass it in the request.' },
      })
    }

    // Deploy
    try {
      const deployment = await deployToVercel(files, project.name ?? task.title, vercelToken)

      // Store deployment URL in codeProject metadata
      await prisma.codeProject.update({
        where: { taskId },
        data:  {
          metadata: {
            ...(project.metadata as object ?? {}),
            vercelDeploymentId:  deployment.id,
            vercelDeploymentUrl: deployment.url,
            vercelDeployedAt:    new Date().toISOString(),
          },
        },
      })

      return reply.send({
        success: true,
        data: { deploymentUrl: deployment.url, deploymentId: deployment.id },
      })
    } catch (err: any) {
      return reply.status(502).send({
        success: false,
        error: { code: 'DEPLOY_FAILED', message: err.message || 'Deployment failed' },
      })
    }
  })

  // ─── GET /deploy/:taskId — get deployment info ────────────────────────────
  app.get('/deploy/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const userId     = request.user!.id

    const task = await prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true } })
    if (!task) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }

    const project = await prisma.codeProject.findUnique({ where: { taskId } })
    const meta    = (project?.metadata as any) ?? {}

    return reply.send({
      success: true,
      data: {
        vercelUrl:    meta.vercelDeploymentUrl ?? null,
        vercelId:     meta.vercelDeploymentId  ?? null,
        deployedAt:   meta.vercelDeployedAt    ?? null,
      },
    })
  })
}
