import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma as db } from '@arivarangam/db'

export async function requireTermsAccepted(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = (request as any).user?.id
  if (!userId) return

  const latestTerms = await db.termsVersion.findFirst({
    orderBy: { effectiveAt: 'desc' }
  })

  if (!latestTerms) return

  const accepted = await db.userTermsAcceptance.findFirst({
    where: { userId, termsVersionId: latestTerms.id }
  })

  if (!accepted) {
    await reply.status(403).send({
      success: false,
      code: 'TERMS_NOT_ACCEPTED',
      message: 'You must accept the Terms of Service to continue',
      termsUrl: '/terms',
      termsVersion: latestTerms.version
    })
  }
}
