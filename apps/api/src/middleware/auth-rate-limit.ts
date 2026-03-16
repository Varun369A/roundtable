import { FastifyRequest, FastifyReply } from 'fastify'
import { redis } from '../lib/redis'

/**
 * Per-email/IP rate limiter for sensitive auth endpoints.
 *
 * Strategy:
 *   - Track failed login attempts per email (not IP) to prevent
 *     targeted account lockout attacks via IP rotation.
 *   - After 10 failures within 15 minutes, block for 15 minutes.
 *   - Reset counter on successful login (handled by auth route).
 *
 * This is intentionally separate from the global IP rate limit,
 * which covers volume attacks from a single IP.
 */

const MAX_ATTEMPTS = 10
const WINDOW_SECONDS = 900  // 15 minutes
const LOCKOUT_SECONDS = 900 // 15 minutes

function loginKey(email: string): string {
  return `auth:attempts:${email.toLowerCase()}`
}

function lockoutKey(email: string): string {
  return `auth:lockout:${email.toLowerCase()}`
}

/**
 * Middleware: rejects login attempts for locked-out accounts.
 * Must be applied BEFORE the password verification logic.
 */
export async function checkLoginRateLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = request.body as { email?: string }
  if (!body?.email || typeof body.email !== 'string') return

  const email = body.email.toLowerCase()
  const isLocked = await redis.exists(lockoutKey(email))

  if (isLocked) {
    const ttl = await redis.ttl(lockoutKey(email))
    reply.status(429).send({
      success: false,
      error: {
        code: 'ACCOUNT_TEMPORARILY_LOCKED',
        message: `Too many failed login attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
      },
    })
  }
}

/**
 * Called after a failed login attempt to increment the counter
 * and potentially lock the account temporarily.
 */
export async function recordLoginFailure(email: string): Promise<void> {
  const key = loginKey(email)
  const count = await redis.incr(key)

  if (count === 1) {
    // First failure — set the window TTL
    await redis.expire(key, WINDOW_SECONDS)
  }

  if (count >= MAX_ATTEMPTS) {
    // Lock the account
    await redis.setex(lockoutKey(email), LOCKOUT_SECONDS, '1')
    await redis.del(key) // reset counter after lock
  }
}

/**
 * Called after a successful login to clear the failure counter.
 */
export async function clearLoginFailures(email: string): Promise<void> {
  await redis.del(loginKey(email))
}
