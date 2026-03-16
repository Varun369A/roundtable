import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@sabha/db'
import { redis } from '../lib/redis'
import { PLANS } from '@sabha/types'
import type { PlanId, UserTier } from '@sabha/types'

// Map UserTier → PlanId
const TIER_TO_PLAN: Record<UserTier, PlanId> = {
  FREE:       'free',
  STARTER:    'starter',
  PRO:        'pro',
  POWER:      'power',
  ENTERPRISE: 'enterprise',
}

/**
 * Checks task creation limits before allowing a new task.
 * Uses Redis counters for speed — Postgres as source of truth.
 */
export async function enforcePlanLimits(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.user
  if (!user) {
    reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } })
    return
  }

  const tier = user.tier as UserTier
  const planId = TIER_TO_PLAN[tier] || 'free'
  const plan = PLANS[planId]

  // Unlimited plans — skip all checks
  if (plan.tasksPerMonth === -1) return

  // Get current month usage from Redis (fast path)
  const monthKey = `usage:${user.id}:${getMonthKey()}`
  const usageStr = await redis.get(monthKey)
  const usage = usageStr ? parseInt(usageStr, 10) : 0

  if (usage >= plan.tasksPerMonth) {
    // Double-check against DB (Redis might be stale after server restart)
    const periodStart = getMonthStart()
    const dbUsage = await prisma.task.count({
      where: {
        userId: user.id,
        createdAt: { gte: periodStart },
        status: { notIn: ['CANCELLED'] },
      },
    })

    if (dbUsage >= plan.tasksPerMonth) {
      reply.status(429).send({
        success: false,
        error: {
          code: 'PLAN_LIMIT_REACHED',
          message: `You've used ${dbUsage}/${plan.tasksPerMonth} tasks this month on the ${plan.name} plan.`,
          details: {
            used: dbUsage,
            limit: plan.tasksPerMonth,
            plan: planId,
            upgradeUrl: '/pricing',
          },
        },
      })
      return
    }

    // Sync Redis with DB
    const secondsLeft = getSecondsUntilMonthEnd()
    await redis.setex(monthKey, secondsLeft, String(dbUsage))
    return
  }

  // Increment Redis counter (will be synced to DB via task creation)
  const ttl = await redis.ttl(monthKey)
  if (ttl < 0) {
    await redis.setex(monthKey, getSecondsUntilMonthEnd(), String(usage + 1))
  } else {
    await redis.incr(monthKey)
  }
}

/**
 * Decrement usage counter when a task is cancelled.
 */
export async function decrementUsage(userId: string): Promise<void> {
  const monthKey = `usage:${userId}:${getMonthKey()}`
  const current = await redis.get(monthKey)
  if (current && parseInt(current, 10) > 0) {
    await redis.decr(monthKey)
  }
}

/**
 * Get current usage for a user.
 */
export async function getCurrentUsage(userId: string, tier: UserTier): Promise<{
  tasksUsed: number
  tasksLimit: number
  percentUsed: number
  plan: PlanId
}> {
  const planId = TIER_TO_PLAN[tier] || 'free'
  const plan = PLANS[planId]

  const periodStart = getMonthStart()
  const tasksUsed = await prisma.task.count({
    where: {
      userId,
      createdAt: { gte: periodStart },
      status: { notIn: ['CANCELLED'] },
    },
  })

  return {
    tasksUsed,
    tasksLimit: plan.tasksPerMonth,
    percentUsed: plan.tasksPerMonth === -1 ? 0 : Math.round((tasksUsed / plan.tasksPerMonth) * 100),
    plan: planId,
  }
}

function getMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getMonthStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

function getSecondsUntilMonthEnd(): number {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return Math.floor((nextMonth.getTime() - now.getTime()) / 1000)
}
