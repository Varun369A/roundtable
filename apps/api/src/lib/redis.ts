/**
 * Valkey client (drop-in Redis-compatible open-source cache & pub/sub).
 * Valkey is fully protocol-compatible with Redis — ioredis works unchanged.
 * Config: VALKEY_URL env var (falls back to REDIS_URL for legacy compatibility).
 */

import Redis from 'ioredis'
import { env } from '@arivarangam/config'

const valkeyUrl = process.env.VALKEY_URL || env.REDIS_URL

export const redis = new Redis(valkeyUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  // Valkey-specific: connection name for server-side monitoring
  connectionName: 'arivarangam-api',
})

redis.on('error', (err) => {
  console.error('[Valkey] Connection error:', err.message)
})

redis.on('connect', () => {
  console.log('[Valkey] Connected')
})

redis.on('ready', () => {
  console.log('[Valkey] Ready')
})

redis.on('reconnecting', (delay: number) => {
  console.warn(`[Valkey] Reconnecting in ${delay}ms`)
})

/**
 * Dedicated subscriber connection — ioredis cannot use the same connection
 * for both commands and pub/sub subscriptions simultaneously.
 */
export function createSubscriberConnection(): Redis {
  return new Redis(valkeyUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectionName: 'sabha-sub',
  })
}
