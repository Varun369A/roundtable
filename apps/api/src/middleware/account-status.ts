import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma as db } from '@arivarangam/db'

export async function checkAccountStatus(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = (request as any).user?.id
  if (!userId) return

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isSuspended: true, suspendedAt: true, suspendedReason: true }
  })

  if (user?.isSuspended) {
    await reply.status(403).send({
      success: false,
      code: 'ACCOUNT_SUSPENDED',
      message: 'Your account has been suspended for violating Arivarangam Terms of Service.',
      suspendedAt: user.suspendedAt,
      reason: user.suspendedReason
    })
  }
}
