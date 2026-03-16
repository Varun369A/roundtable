/**
 * Notification delivery system.
 * Creates DB records + publishes to Redis/Valkey pub/sub channel for live delivery.
 * Channel: sabha:user:{userId}
 */

import { PrismaClient } from '@sabha/db'
import { redis } from '../lib/redis'

const prisma = new PrismaClient()

export type NotificationType =
  | 'task_completed'
  | 'task_failed'
  | 'workspace_invite'
  | 'weekly_digest'
  | 'system_alert'
  | 'model_fallback'
  | 'healing_applied'

export interface CreateNotificationOptions {
  userId: string
  type: NotificationType
  title: string
  body: string
  link?: string
  metadata?: Record<string, unknown>
}

export async function createNotification(opts: CreateNotificationOptions): Promise<void> {
  const notification = await (prisma as any).notification.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      link: opts.link ?? null,
      metadata: opts.metadata ?? {},
      readAt: null,
      createdAt: new Date(),
    },
  })

  const payload = JSON.stringify({
    event: 'notification',
    data: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
    },
  })

  try {
    await redis.publish(`sabha:user:${opts.userId}`, payload)
  } catch (err) {
    console.error('[notifications] Failed to publish to Redis:', err)
  }
}

export async function broadcastAdminAlert(opts: {
  title: string
  body: string
  severity: 'info' | 'warning' | 'critical'
  metadata?: Record<string, unknown>
}): Promise<void> {
  const payload = JSON.stringify({
    event: 'admin_alert',
    data: {
      title: opts.title,
      body: opts.body,
      severity: opts.severity,
      metadata: opts.metadata ?? {},
      timestamp: new Date().toISOString(),
    },
  })

  try {
    await redis.publish('sabha:admin', payload)
  } catch (err) {
    console.error('[notifications] Failed to broadcast admin alert:', err)
  }
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  await (prisma as any).notification.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  })
}

export async function getUnreadCount(userId: string): Promise<number> {
  const count = await (prisma as any).notification.count({
    where: { userId, readAt: null },
  })
  return count
}
