import crypto from 'crypto'
import { prisma } from '@arivarangam/db'
import { env } from '@arivarangam/config'
import { redis } from './redis'

const REFRESH_TOKEN_BYTES = 64

export function generateRefreshToken(): string {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function saveRefreshToken({
  userId,
  token,
  userAgent,
  ipAddress,
}: {
  userId: string
  token: string
  userAgent?: string
  ipAddress?: string
}) {
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt, userAgent, ipAddress },
  })
}

export async function rotateRefreshToken({
  oldToken,
  userId,
  userAgent,
  ipAddress,
}: {
  oldToken: string
  userId: string
  userAgent?: string
  ipAddress?: string
}): Promise<string | null> {
  const oldHash = hashToken(oldToken)

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: oldHash },
  })

  if (!existing || existing.isRevoked || existing.expiresAt < new Date()) {
    // Possible token reuse — revoke all tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    })
    return null
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { tokenHash: oldHash },
    data: { isRevoked: true },
  })

  // Issue new token
  const newToken = generateRefreshToken()
  await saveRefreshToken({ userId, token: newToken, userAgent, ipAddress })

  return newToken
}

export async function revokeAllUserTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { isRevoked: true },
  })
}

// Access token blacklist (for logout before expiry)
export async function blacklistAccessToken(token: string, ttlSeconds: number) {
  await redis.setex(`blacklist:${hashToken(token)}`, ttlSeconds, '1')
}

export async function isAccessTokenBlacklisted(token: string): Promise<boolean> {
  const result = await redis.get(`blacklist:${hashToken(token)}`)
  return result !== null
}
