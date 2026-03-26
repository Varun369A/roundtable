/**
 * suggestions.ts — Proactive AI Suggestions routes (Phase 3)
 *
 * GET /api/v1/code-projects/:taskId/suggestions
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { getSuggestions, generateSuggestions } from '../lib/suggestion-engine'

export async function suggestionsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth)

  app.get<{ Params: { taskId: string } }>('/:taskId/suggestions', async (request, reply) => {
    const { taskId } = request.params
    const userId = request.user!.id

    const project = await prisma.codeProject.findFirst({
      where: { taskId, userId },
      select: { id: true, files: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } })

    // Return cached suggestions if available
    let suggestions = await getSuggestions(project.id)

    // Generate on-demand if not cached yet (e.g. older projects)
    if (!suggestions) {
      const files = project.files as Array<{ path: string; content: string; language: string }>
      suggestions = await generateSuggestions(project.id, files)
    }

    return reply.send({ success: true, data: { suggestions } })
  })
}
