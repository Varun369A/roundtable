/**
 * Feature flag service.
 * Flags are stored in DB (FeatureFlag table) and cached in Redis for 60s.
 *
 * Usage:
 *   const enabled = await isEnabled('new_dashboard', userId)
 */

import { prisma } from '@sabha/db'
import { redis } from './redis'

const CACHE_TTL = 60 // seconds
const CACHE_PREFIX = 'ff:'

interface FlagConfig {
  allowlist?: string[]        // specific userIds that always get the flag
  rolloutPercent?: number     // 0–100, deterministic hash-based
}

/** Deterministic hash so the same user always gets the same bucket */
function hashUserId(userId: string, flagKey: string): number {
  let h = 0
  const s = userId + ':' + flagKey
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 100
}

export async function isEnabled(flagKey: string, userId?: string): Promise<boolean> {
  // Check Redis cache first
  const cacheKey = `${CACHE_PREFIX}${flagKey}`
  const cached = await redis.get(cacheKey)

  let flag: { enabled: boolean; config: FlagConfig } | null = null

  if (cached) {
    flag = JSON.parse(cached)
  } else {
    const row = await prisma.featureFlag.findUnique({ where: { key: flagKey } })
    if (!row) return false

    flag = { enabled: row.enabled, config: (row.config as FlagConfig) || {} }
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(flag))
  }

  if (!flag || !flag.enabled) return false

  const config = flag.config

  // If no userId, just check global enabled
  if (!userId) return flag.enabled

  // Allowlist takes priority
  if (config.allowlist?.includes(userId)) return true

  // Rollout percent — deterministic bucket
  if (typeof config.rolloutPercent === 'number') {
    return hashUserId(userId, flagKey) < config.rolloutPercent
  }

  return true
}

/** Invalidate cache for a flag (call after admin updates) */
export async function invalidateFlag(flagKey: string): Promise<void> {
  await redis.del(`${CACHE_PREFIX}${flagKey}`)
}

/** Pre-defined flag keys used by the app */
export const FLAGS = {
  TEAM_WORKSPACES: 'team_workspaces',
  TEMPLATE_GALLERY: 'template_gallery',
  BETA_REQUIRED: 'beta_required',       // gates signup behind invite code
  EMAIL_NOTIFICATIONS: 'email_notifications',
  ADMIN_ANALYTICS_V2: 'admin_analytics_v2',
} as const
