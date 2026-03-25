import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@arivarangam/db'
import type { JWTPayload } from '@arivarangam/types'
import { isAccessTokenBlacklisted } from '../lib/tokens'
import { ensureUserInfrastructure } from '../lib/user-infrastructure'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const queryToken = (request.query as Record<string, string>)?.token
    if (queryToken && !request.headers.authorization && !request.cookies?.accessToken) {
      request.headers['authorization'] = `Bearer ${queryToken}`
    }

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
      select: { id: true, email: true, tier: true, status: true, isEmailVerified: true, isAdmin: true },
    })

    if (!user || user.status !== 'ACTIVE') {
      return reply.status(401).send({
        success: false,
        error: { code: 'USER_INACTIVE', message: 'User account is inactive' },
      })
    }

    request.user = user

    // Ensure this user has all required platform infrastructure (Redis-cached, near-zero cost).
    // Fires in background — never delays the request.
    ensureUserInfrastructure(user.id).catch(() => {})
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    })
  }
}

