import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@sabha/db'
import type { JWTPayload } from '@sabha/types'
import { isAccessTokenBlacklisted } from '../lib/tokens'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify<JWTPayload>()

    // Check blacklist (logout case)
    const token = request.cookies?.accessToken
      ?? request.headers.authorization?.replace('Bearer ', '')
      ?? ''
    if (await isAccessTokenBlacklisted(token)) {
      return reply.status(401).send({
        success: false,
        error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked' },
      })
    }

    // Attach user to request
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, tier: true, status: true },
    })

    if (!user || user.status !== 'ACTIVE') {
      return reply.status(401).send({
        success: false,
        error: { code: 'USER_INACTIVE', message: 'User account is inactive' },
      })
    }

    request.user = user
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    })
  }
}

