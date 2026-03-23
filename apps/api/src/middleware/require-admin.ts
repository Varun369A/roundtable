import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@arivarangam/db'
import crypto from 'node:crypto'

/**
 * Admin-only middleware.
 * Requires: valid JWT + user.isAdmin = true
 * OR: x-admin-secret header matching ADMIN_SECRET env var (for automated tools)
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Check secret header (for CLI/automation) — timing-safe comparison to prevent timing attacks
  const secretHeader = request.headers['x-admin-secret']
  const adminSecret = process.env.ADMIN_SECRET
  if (secretHeader && adminSecret) {
    const header = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader
    try {
      const a = Buffer.from(header)
      const b = Buffer.from(adminSecret)
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return // allowed
      }
    } catch {
      // fall through to JWT check
    }
  }

  // Check JWT + isAdmin flag
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
  }

  const user = await prisma.user.findUnique({
    where: { id: request.user.id },
    select: { isAdmin: true, status: true },
  })

  if (!user?.isAdmin || user.status !== 'ACTIVE') {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    })
  }
}
