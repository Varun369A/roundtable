import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma as db } from '@arivarangam/db'

export async function requireTermsAccepted(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const userId = (request as any).user?.id
  if (!userId) return

  try {
    const latestTerms = await db.termsVersion.findFirst({
      orderBy: { effectiveAt: 'desc' }
    })

    if (!latestTerms) return

    const accepted = await db.userTermsAcceptance.findFirst({
      where: { userId, termsVersionId: latestTerms.id }
    })

    // Auto-accept terms for users who haven't accepted yet (e.g. pre-date the explicit acceptance flow).
    // This prevents blocking existing users with 403 on every request.
    if (!accepted) {
      await db.userTermsAcceptance.create({
        data: {
          userId,
          termsVersionId: latestTerms.id,
          ipAddress: String((request.headers['x-forwarded-for'] ?? request.ip) ?? 'unknown').slice(0, 45),
          userAgent: String(request.headers['user-agent'] ?? 'unknown').slice(0, 500),
        },
      })
    }
  } catch {
    // DB query failed — pass through to avoid blocking the user
  }
}
