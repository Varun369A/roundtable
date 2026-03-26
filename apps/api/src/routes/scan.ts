/**
 * scan.ts — Error Detection & Auto-Fix scan route (Phase 4)
 *
 * POST /api/v1/code-projects/:taskId/scan
 * Scans all project files for common code issues.
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { detectErrors } from '../lib/error-detector'

interface ScanIssue {
  filePath: string
  errors: string[]
  correctionPrompt: string
}

export async function scanRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth)

  app.post<{ Params: { taskId: string } }>('/:taskId/scan', async (request, reply) => {
    const { taskId } = request.params
    const userId = request.user!.id

    const project = await prisma.codeProject.findFirst({
      where: { taskId, userId },
      select: { id: true, files: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } })

    const files = project.files as Array<{ path: string; content: string; language: string }>

    const issues: ScanIssue[] = []

    for (const file of files) {
      // detectErrors expects (content, category) — use 'code' for all code files
      const detection = detectErrors(file.content, 'code')
      if (detection.hasErrors && detection.errors.length > 0) {
        issues.push({
          filePath: file.path,
          errors: detection.errors,
          correctionPrompt: `Fix the following issues in ${file.path}: ${detection.errors.join(', ')}`,
        })
      }
    }

    return reply.send({
      success: true,
      data: {
        scannedFiles: files.length,
        issueCount: issues.length,
        issues,
      },
    })
  })
}
