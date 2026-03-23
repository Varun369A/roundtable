/**
 * BYOAI — Bring Your Own AI
 * Users connect their own API keys. Keys encrypted with AES-256-GCM.
 * When a user's own key exists, Arivarangam uses it (free for the user, no credits consumed).
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { encryptByoai, decryptByoai } from '../lib/encrypt'
import { PROVIDER_REGISTRY } from '../lib/provider-registry'
import { testApiKey } from '../lib/key-tester'

export async function aiConnectionsRoutes(app: FastifyInstance) {
  // GET /ai-connections — list all providers + user's connection status
  app.get('/', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id

    const connections = await prisma.userAIConnection.findMany({
      where: { userId },
      select: { provider: true, displayName: true, isVerified: true, isActive: true, lastUsedAt: true, createdAt: true },
    })

    const connectedMap = new Map(connections.map((c) => [c.provider, c]))

    const providers = PROVIDER_REGISTRY.map((p) => {
      const conn = connectedMap.get(p.key)
      return {
        ...p,
        connected: !!conn?.isActive,
        verified: conn?.isVerified ?? false,
        lastUsedAt: conn?.lastUsedAt ?? null,
        connectedAt: conn?.createdAt ?? null,
      }
    })

    return reply.send({ success: true, data: { providers } })
  })

  // POST /ai-connections — connect a new AI provider
  app.post<{ Body: { provider: string; apiKey: string; displayName?: string } }>(
    '/',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Body: { provider: string; apiKey: string; displayName?: string } }>, reply: FastifyReply) => {
      const { provider, apiKey, displayName } = request.body
      const userId = request.user!.id

      const providerDef = PROVIDER_REGISTRY.find((p) => p.key === provider)
      if (!providerDef) {
        return reply.status(400).send({ success: false, error: { code: 'UNKNOWN_PROVIDER', message: `Unknown provider: ${provider}` } })
      }

      if (!apiKey?.trim()) {
        return reply.status(400).send({ success: false, error: { code: 'MISSING_KEY', message: 'API key is required' } })
      }

      // Verify the key works
      const testResult = await testApiKey(provider, apiKey.trim())
      if (!testResult.valid) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_KEY', message: testResult.error || 'API key verification failed. Please check your key and try again.' },
        })
      }

      const { encryptedValue, iv, authTag } = encryptByoai(apiKey.trim())

      const connection = await prisma.userAIConnection.upsert({
        where: { userId_provider: { userId, provider } },
        update: {
          encryptedKey: encryptedValue, iv, authTag,
          displayName: displayName ?? providerDef.displayName,
          isVerified: true, isActive: true,
          verifiedAt: new Date(),
        },
        create: {
          userId, provider,
          encryptedKey: encryptedValue, iv, authTag,
          displayName: displayName ?? providerDef.displayName,
          isVerified: true, isActive: true,
          verifiedAt: new Date(),
        },
        select: { provider: true, displayName: true, isVerified: true, createdAt: true },
      })

      return reply.status(201).send({ success: true, data: { connection } })
    }
  )

  // DELETE /ai-connections/:provider — disconnect
  app.delete<{ Params: { provider: string } }>(
    '/:provider',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { provider: string } }>, reply: FastifyReply) => {
      const { provider } = request.params
      const userId = request.user!.id

      await prisma.userAIConnection.deleteMany({ where: { userId, provider } })
      return reply.send({ success: true })
    }
  )

  // POST /ai-connections/:provider/verify — re-verify existing key
  app.post<{ Params: { provider: string } }>(
    '/:provider/verify',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { provider: string } }>, reply: FastifyReply) => {
      const { provider } = request.params
      const userId = request.user!.id

      const conn = await prisma.userAIConnection.findUnique({ where: { userId_provider: { userId, provider } } })
      if (!conn) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } })

      const decryptedKey = decryptByoai(conn.encryptedKey, conn.iv, conn.authTag)
      const testResult = await testApiKey(provider, decryptedKey)

      await prisma.userAIConnection.update({
        where: { userId_provider: { userId, provider } },
        data: { isVerified: testResult.valid, verifiedAt: testResult.valid ? new Date() : undefined },
      })

      return reply.send({ success: true, data: { verified: testResult.valid, error: testResult.error } })
    }
  )
}
