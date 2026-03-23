import { FastifyInstance } from 'fastify'
import { prisma as db } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { checkAccountStatus } from '../middleware/account-status'

export async function termsRoutes(app: FastifyInstance): Promise<void> {

  app.get('/terms/latest', async (_req, reply) => {
    const terms = await db.termsVersion.findFirst({
      orderBy: { effectiveAt: 'desc' },
      select: { id: true, version: true, content: true, effectiveAt: true, createdAt: true }
    })
    if (!terms) return reply.status(404).send({ success: false, message: 'No terms found' })
    return reply.send({ success: true, data: terms })
  })

  app.post('/terms/accept', { preHandler: [requireAuth, checkAccountStatus] }, async (req: any, reply) => {
    const userId = req.user.id
    const ipAddress = String(req.ip ?? req.headers['x-forwarded-for'] ?? 'unknown').slice(0, 45)
    const userAgent = String(req.headers['user-agent'] ?? 'unknown').slice(0, 500)

    const latest = await db.termsVersion.findFirst({ orderBy: { effectiveAt: 'desc' } })
    if (!latest) return reply.status(404).send({ success: false, message: 'No terms to accept' })

    const acceptance = await db.userTermsAcceptance.upsert({
      where: { userId_termsVersionId: { userId, termsVersionId: latest.id } },
      create: { userId, termsVersionId: latest.id, ipAddress, userAgent },
      update: {}
    })

    return reply.send({ success: true, data: acceptance })
  })

  app.get('/terms/status', { preHandler: [requireAuth] }, async (req: any, reply) => {
    const userId = req.user.id

    const latest = await db.termsVersion.findFirst({ orderBy: { effectiveAt: 'desc' } })
    if (!latest) return reply.send({ success: true, data: { accepted: true } })

    const acceptance = await db.userTermsAcceptance.findFirst({
      where: { userId, termsVersionId: latest.id }
    })

    return reply.send({
      success: true,
      data: {
        accepted: !!acceptance,
        termsVersion: latest.version,
        effectiveAt: latest.effectiveAt,
        acceptedAt: acceptance?.acceptedAt ?? null
      }
    })
  })
}
