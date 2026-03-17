/**
 * Project Environment Variables
 * Secure storage for user-provided env vars for code projects.
 * Values are AES-256-GCM encrypted at rest.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { encrypt } from '../lib/encrypt'

export async function envVarsRoutes(app: FastifyInstance) {
  // GET /code-projects/:projectId/env-vars
  // Returns variable names + hints, NOT decrypted values
  app.get<{ Params: { projectId: string } }>(
    '/code-projects/:projectId/env-vars',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) => {
      const { projectId } = request.params
      const userId = request.user!.id

      const project = await prisma.codeProject.findFirst({ where: { id: projectId, userId } })
      if (!project) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } })
      }

      const vars = await prisma.projectEnvVar.findMany({
        where: { projectId },
        select: { id: true, name: true, hint: true, createdAt: true },
        orderBy: { name: 'asc' },
      })

      return reply.send({ success: true, data: { vars } })
    }
  )

  // POST /code-projects/:projectId/env-vars
  // Add or update an env var (upsert by name)
  app.post<{
    Params: { projectId: string }
    Body: { name: string; value: string; hint?: string }
  }>(
    '/code-projects/:projectId/env-vars',
    { preHandler: [requireAuth] },
    async (
      request: FastifyRequest<{ Params: { projectId: string }; Body: { name: string; value: string; hint?: string } }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params
      const { name, value, hint } = request.body
      const userId = request.user!.id

      if (!name || !value) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name and value required' } })
      }

      const nameNormalized = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')

      const project = await prisma.codeProject.findFirst({ where: { id: projectId, userId } })
      if (!project) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } })
      }

      const { encryptedValue, iv, authTag } = encrypt(value)

      const envVar = await prisma.projectEnvVar.upsert({
        where: { projectId_name: { projectId, name: nameNormalized } },
        update: { encryptedValue, iv, authTag, hint: hint ?? null },
        create: { projectId, name: nameNormalized, encryptedValue, iv, authTag, hint: hint ?? null },
        select: { id: true, name: true, hint: true, createdAt: true },
      })

      return reply.status(201).send({ success: true, data: { envVar } })
    }
  )

  // DELETE /code-projects/:projectId/env-vars/:id
  app.delete<{ Params: { projectId: string; id: string } }>(
    '/code-projects/:projectId/env-vars/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { projectId: string; id: string } }>, reply: FastifyReply) => {
      const { projectId, id } = request.params
      const userId = request.user!.id

      const project = await prisma.codeProject.findFirst({ where: { id: projectId, userId } })
      if (!project) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } })
      }

      await prisma.projectEnvVar.deleteMany({ where: { id, projectId } })
      return reply.send({ success: true })
    }
  )

  // GET /code-projects/:projectId/env-vars/export
  // Returns .env.example content (names only, no values)
  app.get<{ Params: { projectId: string } }>(
    '/code-projects/:projectId/env-vars/export',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { projectId: string } }>, reply: FastifyReply) => {
      const { projectId } = request.params
      const userId = request.user!.id

      const project = await prisma.codeProject.findFirst({ where: { id: projectId, userId } })
      if (!project) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } })
      }

      const vars = await prisma.projectEnvVar.findMany({
        where: { projectId },
        orderBy: { name: 'asc' },
        select: { name: true, hint: true },
      })

      const lines = vars.map((v) => {
        const comment = v.hint ? `# ${v.hint}\n` : ''
        return `${comment}${v.name}=`
      })

      reply.header('Content-Type', 'text/plain')
      reply.header('Content-Disposition', 'attachment; filename=".env.example"')
      return reply.send(lines.join('\n'))
    }
  )
}
