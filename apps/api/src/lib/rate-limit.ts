import { redis } from './redis'
import { FastifyReply } from 'fastify'

export const RATE_LIMITS = {
  friendRequests: { window: 3600, max: 20 },
  messages:       { window: 60,   max: 100 },
  reports:        { window: 3600, max: 10 },
  repoCreation:   { window: 3600, max: 10 },
  profileSearch:  { window: 60,   max: 30 },
  adminAccess:    { window: 60,   max: 60 },
}

export async function checkRateLimit(
  key: string,
  config: { window: number; max: number },
  reply: FastifyReply
): Promise<boolean> {
  const current = await redis.incr(key)
  if (current === 1) {
    await redis.expire(key, config.window)
  }
  if (current > config.max) {
    const ttl = await redis.ttl(key)
    await reply.status(429).send({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Too many requests. Limit: ${config.max} per ${config.window}s`,
      retryAfter: ttl
    })
    return false
  }
  return true
}
