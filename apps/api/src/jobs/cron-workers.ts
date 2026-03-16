/**
 * Cron workers and healing system.
 *
 * Workers:
 * - staleTaskWorker:     Every 10 min — detect and recover stuck tasks
 * - healingWorker:       Every 5 min  — process dead-letter queue
 * - templateAnalytics:  Daily 2am    — compute template performance scores
 * - userDigestWorker:   Sunday 9am   — send weekly user emails
 * - adminDigestWorker:  Monday 7am   — send admin weekly report
 * - queueMonitor:       Every 1 min  — alert if queue depth spikes
 */

import { Queue, Worker, Job } from 'bullmq'
import { PrismaClient } from '@sabha/db'
import { redis } from '../lib/redis'
import { broadcastAdminAlert, createNotification } from '../lib/notifications'
import { sendEmail } from '../lib/email'
import { metrics } from '../lib/metrics'

const prisma = new PrismaClient()

// BullMQ connection config derived from the shared redis instance
const bullConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD ?? undefined,
}

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------

const staleTaskQueue = new Queue('stale-task-scan', { connection: bullConnection })
const healingQueue = new Queue('dead-letter-healing', { connection: bullConnection })
const templateAnalyticsQueue = new Queue('template-analytics', { connection: bullConnection })
const userDigestQueue = new Queue('user-digest', { connection: bullConnection })
const adminDigestQueue = new Queue('admin-digest', { connection: bullConnection })
const queueMonitorQueue = new Queue('queue-monitor', { connection: bullConnection })

// Subtask queue (for re-enqueuing)
const subtaskQueue = new Queue('subtask-queue', { connection: bullConnection })

// ---------------------------------------------------------------------------
// Helper: send weekly user digest email
// ---------------------------------------------------------------------------

async function sendUserDigestEmail(
  user: any,
  stats: { taskCount: number; completedCount: number; totalCost: number }
): Promise<void> {
  await sendEmail({
    to: user.email,
    subject: 'Your Sabha Weekly Summary',
    html: `
      <h2>Your week on Sabha</h2>
      <p>Hi ${user.name ?? user.email},</p>
      <ul>
        <li>Tasks run: <strong>${stats.taskCount}</strong></li>
        <li>Completed: <strong>${stats.completedCount}</strong></li>
        <li>Total AI cost: <strong>$${stats.totalCost.toFixed(4)}</strong></li>
      </ul>
      <p>Keep building! <a href="${process.env.APP_URL ?? 'https://sabha.ai'}">Open Sabha →</a></p>
    `,
  })
}

// ---------------------------------------------------------------------------
// staleTaskWorker — Every 10 minutes
// ---------------------------------------------------------------------------

async function processStaleTaskScan(_job: Job): Promise<void> {
  const staleThreshold = new Date(Date.now() - 30 * 60_000) // 30 minutes

  const stuckTasks = await (prisma as any).task.findMany({
    where: {
      status: 'IN_PROGRESS',
      updatedAt: { lt: staleThreshold },
    },
    include: {
      subtasks: true,
    },
  })

  if (stuckTasks.length === 0) return

  let recovered = 0

  for (const task of stuckTasks) {
    // Check if subtasks are in a stuck state
    const pendingSubtasks = task.subtasks.filter(
      (st: any) => st.status === 'PENDING'
    )
    const inProgressSubtasks = task.subtasks.filter((st: any) => st.status === 'IN_PROGRESS')
    const allTerminal = task.subtasks.every((st: any) =>
      ['COMPLETED', 'FAILED', 'SKIPPED'].includes(st.status)
    )

    if (allTerminal) {
      // All subtasks done — task should be completed or failed, fix it
      const anyFailed = task.subtasks.some((st: any) => st.status === 'FAILED')
      await (prisma as any).task.update({
        where: { id: task.id },
        data: {
          status: anyFailed ? 'FAILED' : 'COMPLETED',
          updatedAt: new Date(),
        },
      })
      recovered++
      continue
    }

    // Re-enqueue pending subtasks that are stuck
    for (const subtask of pendingSubtasks) {
      await subtaskQueue.add(
        'process-subtask',
        { subtaskId: subtask.id, taskId: task.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
      )
    }

    // Re-enqueue in-progress subtasks that appear stuck (no updates in 30+ min)
    for (const subtask of inProgressSubtasks) {
      if (new Date(subtask.updatedAt) < staleThreshold) {
        await (prisma as any).subtask.update({
          where: { id: subtask.id },
          data: { status: 'PENDING', updatedAt: new Date() },
        })
        await subtaskQueue.add(
          'process-subtask',
          { subtaskId: subtask.id, taskId: task.id },
          { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
        )
      }
    }

    recovered++
  }

  // Log healing action
  if (recovered > 0) {
    console.log(`[stale-task-worker] Recovered ${recovered} stale tasks`)
  }

  // Alert if more than 2 stale tasks
  if (stuckTasks.length > 2) {
    await broadcastAdminAlert({
      title: 'Stale Task Alert',
      body: `${stuckTasks.length} stale tasks detected and ${recovered} recovered. Check task processing pipeline.`,
      severity: stuckTasks.length > 10 ? 'critical' : 'warning',
      metadata: { staleCount: stuckTasks.length, recovered },
    })
  }
}

// ---------------------------------------------------------------------------
// healingWorker — Every 5 minutes, processes dead-letter queue
// ---------------------------------------------------------------------------

async function processDeadLetterHealing(_job: Job): Promise<void> {
  const DEAD_LETTER_KEY = 'sabha:dead-letter'
  const MAX_ITEMS = 10

  const items: string[] = []
  for (let i = 0; i < MAX_ITEMS; i++) {
    const item = await redis.lpop(DEAD_LETTER_KEY)
    if (!item) break
    items.push(item)
  }

  if (items.length === 0) return

  for (const raw of items) {
    let job: any
    try {
      job = JSON.parse(raw)
    } catch {
      console.error('[healing-worker] Failed to parse dead letter item:', raw)
      continue
    }

    const { subtaskId, taskId, errorType, attempts = 0 } = job

    if (attempts >= 3) {
      // Permanently failed — escalate
      console.error(`[healing-worker] Permanently failed: subtaskId=${subtaskId} after ${attempts} heal attempts`)

      await (prisma as any).subtask.update({
        where: { id: subtaskId },
        data: { status: 'FAILED', updatedAt: new Date() },
      })

      await broadcastAdminAlert({
        title: 'Subtask Permanently Failed',
        body: `SubTask ${subtaskId} (task ${taskId}) failed permanently after ${attempts} healing attempts. Error type: ${errorType}`,
        severity: 'critical',
        metadata: { subtaskId, taskId, errorType, attempts },
      })
      continue
    }

    switch (errorType) {
      case 'CIRCUIT_OPEN': {
        // Check if the circuit is now closed (flag disabled = circuit closed)
        const flagName = `circuit_breaker_open`
        const flag = await (prisma as any).featureFlag.findFirst({ where: { key: flagName } })
        if (!flag || !flag.enabled) {
          // Circuit is closed — re-enqueue
          await subtaskQueue.add(
            'process-subtask',
            { subtaskId, taskId },
            { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
          )
          console.log(`[healing-worker] Circuit closed, re-enqueued subtask ${subtaskId}`)
        } else {
          // Circuit still open — put back in DLQ with incremented attempts
          await redis.rpush(
            DEAD_LETTER_KEY,
            JSON.stringify({ ...job, attempts: attempts + 1 })
          )
        }
        break
      }

      case 'RATE_LIMIT': {
        // Re-enqueue with 60-second delay
        await subtaskQueue.add(
          'process-subtask',
          { subtaskId, taskId },
          {
            attempts: 3,
            delay: 60_000,
            backoff: { type: 'exponential', delay: 5000 },
          }
        )
        console.log(`[healing-worker] Rate limited, re-enqueuing subtask ${subtaskId} with delay`)
        break
      }

      case 'TIMEOUT': {
        // Assign fallback model and re-enqueue
        const fallbackFlag = await (prisma as any).featureFlag.findFirst({
          where: { key: 'fallback_model_timeout' },
        })
        const fallbackModel = (fallbackFlag?.config as any)?.model ?? 'claude-haiku-4-5'

        await (prisma as any).subtask.update({
          where: { id: subtaskId },
          data: {
            assignedModel: fallbackModel,
            status: 'PENDING',
            updatedAt: new Date(),
          },
        })

        await subtaskQueue.add(
          'process-subtask',
          { subtaskId, taskId },
          { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
        )
        console.log(`[healing-worker] Timeout, re-enqueuing subtask ${subtaskId} with fallback model ${fallbackModel}`)
        break
      }

      case 'CONTENT_POLICY': {
        // Permanently fail — content policy violations are not retried
        await (prisma as any).subtask.update({
          where: { id: subtaskId },
          data: { status: 'FAILED', updatedAt: new Date() },
        })

        // Find task owner and notify
        const task = await (prisma as any).task.findUnique({
          where: { id: taskId },
          select: { userId: true, title: true },
        })

        if (task?.userId) {
          await createNotification({
            userId: task.userId,
            type: 'task_failed',
            title: 'Task step failed: content policy',
            body: `A step in your task "${task.title}" was blocked due to content policy. Other steps may continue.`,
            metadata: { subtaskId, taskId },
          })
        }
        break
      }

      default: {
        // Unknown error type — re-enqueue with incremented attempts
        await redis.rpush(
          DEAD_LETTER_KEY,
          JSON.stringify({ ...job, attempts: attempts + 1 })
        )
        break
      }
    }
  }
}

// ---------------------------------------------------------------------------
// templateAnalytics — Daily at 2am
// ---------------------------------------------------------------------------

async function processTemplateAnalytics(_job: Job): Promise<void> {
  const since7d = new Date(Date.now() - 7 * 86_400_000)

  const templates = await (prisma as any).roundtableTemplate.findMany({
    where: { isBuiltIn: true, isPublic: true },
    select: { id: true, name: true },
  })

  for (const template of templates) {
    try {
      const [tasks, completedTasks] = await Promise.all([
        (prisma as any).task.findMany({
          where: { templateId: template.id, createdAt: { gte: since7d } },
          select: { id: true, status: true, userId: true, createdAt: true, totalCostUsd: true, completedAt: true },
        }),
        (prisma as any).task.findMany({
          where: {
            templateId: template.id,
            status: 'COMPLETED',
            createdAt: { gte: since7d },
          },
          select: { id: true, totalCostUsd: true, completedAt: true, createdAt: true },
        }),
      ])

      const taskCount = tasks.length
      const completionRate = taskCount > 0 ? completedTasks.length / taskCount : 0

      const avgCost =
        completedTasks.length > 0
          ? completedTasks.reduce((sum: number, t: any) => sum + (Number(t.totalCostUsd) ?? 0), 0) /
            completedTasks.length
          : 0

      const avgDurationMs =
        completedTasks.length > 0
          ? completedTasks.reduce((sum: number, t: any) => {
              const dur =
                t.completedAt && t.createdAt
                  ? new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()
                  : 0
              return sum + dur
            }, 0) / completedTasks.length
          : 0

      // User return rate: users who used this template and created another task within 7 days
      const userIds = [...new Set(tasks.map((t: any) => t.userId))]
      let returningUsers = 0
      for (const userId of userIds) {
        const laterTask = await (prisma as any).task.findFirst({
          where: {
            userId,
            templateId: template.id,
            createdAt: { gte: since7d },
            id: { notIn: tasks.filter((t: any) => t.userId === userId).map((t: any) => t.id).slice(0, 1) },
          },
        })
        if (laterTask) returningUsers++
      }
      const returnUserRate = userIds.length > 0 ? returningUsers / userIds.length : 0

      // Performance score: (completionRate × 40) + (returnUserRate × 30) + (costScore × 20) + (recency × 10)
      const maxCost = 1.0 // normalize against $1 as max
      const costScore = avgCost > 0 ? Math.max(0, 1 - avgCost / maxCost) : 0.5
      const recencyScore = taskCount > 0 ? Math.min(1, taskCount / 100) : 0

      const performanceScore =
        completionRate * 40 +
        returnUserRate * 30 +
        costScore * 20 +
        recencyScore * 10

      await (prisma as any).templateAnalytics.upsert({
        where: { templateId: template.id },
        update: {
          taskCount,
          completionRate,
          avgCostUsd: avgCost,
          avgDurationMs: Math.round(avgDurationMs),
          returnUserRate,
          performanceScore: Math.round(performanceScore * 10) / 10,
        },
        create: {
          templateId: template.id,
          weekStart:  since7d,
          taskCount,
          completionRate,
          avgCostUsd: avgCost,
          avgDurationMs: Math.round(avgDurationMs),
          returnUserRate,
          performanceScore: Math.round(performanceScore * 10) / 10,
        },
      })
    } catch (err) {
      console.error(`[template-analytics] Failed for template ${template.id}:`, err)
    }
  }

  console.log(`[template-analytics] Computed analytics for ${templates.length} templates`)
}

// ---------------------------------------------------------------------------
// userDigestWorker — Sunday 9am
// ---------------------------------------------------------------------------

async function processUserDigest(_job: Job): Promise<void> {
  // Check if email_notifications flag is enabled
  const emailFlag = await (prisma as any).featureFlag.findFirst({
    where: { key: 'email_notifications' },
  })
  if (emailFlag && !emailFlag.enabled) {
    console.log('[user-digest] email_notifications flag is disabled, skipping')
    return
  }

  const since30d = new Date(Date.now() - 30 * 86_400_000)
  const since7d = new Date(Date.now() - 7 * 86_400_000)

  const users = await (prisma as any).user.findMany({
    where: {
      OR: [{ isBeta: true }, { tier: { not: 'FREE' } }],
      lastActiveAt: { gte: since30d },
    },
    select: { id: true, email: true, name: true },
  })

  let sent = 0
  let failed = 0

  for (const user of users) {
    try {
      const [tasks, completedTasks, billingEvents] = await Promise.all([
        (prisma as any).task.count({
          where: { userId: user.id, createdAt: { gte: since7d } },
        }),
        (prisma as any).task.count({
          where: { userId: user.id, status: 'COMPLETED', createdAt: { gte: since7d } },
        }),
        (prisma as any).billingEvent.aggregate({
          where: { userId: user.id, createdAt: { gte: since7d } },
          _sum: { costUsd: true },
        }),
      ])

      await sendUserDigestEmail(user, {
        taskCount: tasks,
        completedCount: completedTasks,
        totalCost: Number(billingEvents._sum?.costUsd ?? 0),
      })
      sent++
    } catch (err) {
      console.error(`[user-digest] Failed to send digest to ${user.email}:`, err)
      failed++
    }
  }

  console.log(`[user-digest] Sent ${sent} digests, ${failed} failed`)
}

// ---------------------------------------------------------------------------
// adminDigestWorker — Monday 7am
// ---------------------------------------------------------------------------

async function processAdminDigest(_job: Job): Promise<void> {
  const since7d = new Date(Date.now() - 7 * 86_400_000)
  const adminEmail = process.env.ADMIN_EMAIL

  if (!adminEmail) {
    console.warn('[admin-digest] ADMIN_EMAIL env var not set, skipping')
    return
  }

  const [newSignups, revenue, topTemplates, errorCount, totalTasks] = await Promise.all([
    (prisma as any).user.count({ where: { createdAt: { gte: since7d } } }),
    (prisma as any).billingEvent.aggregate({
      where: { createdAt: { gte: since7d } },
      _sum: { costUsd: true },
    }),
    (prisma as any).task.groupBy({
      by: ['templateId'],
      _count: { id: true },
      where: { createdAt: { gte: since7d }, templateId: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take: 3,
    }),
    (prisma as any).task.count({
      where: { status: 'FAILED', createdAt: { gte: since7d } },
    }),
    (prisma as any).task.count({ where: { createdAt: { gte: since7d } } }),
  ])

  // Enrich top templates with names
  const topTemplateIds = topTemplates.map((t: any) => t.templateId).filter(Boolean)
  const templateNames = await (prisma as any).roundtableTemplate.findMany({
    where: { id: { in: topTemplateIds } },
    select: { id: true, name: true },
  })
  const nameMap = Object.fromEntries(templateNames.map((t: any) => [t.id, t.name]))

  const errorRate = totalTasks > 0 ? ((errorCount / totalTasks) * 100).toFixed(2) : '0.00'
  const weeklyRevenue = Number(revenue._sum?.costUsd ?? 0)

  const topTemplateList = topTemplates
    .map((t: any) => `  - ${nameMap[t.templateId] ?? t.templateId}: ${t._count.id} tasks`)
    .join('\n')

  await sendEmail({
    to: adminEmail,
    subject: `Sabha Admin Weekly Digest — ${new Date().toLocaleDateString()}`,
    html: `
      <h2>Sabha Weekly Admin Report</h2>
      <h3>Week ending ${new Date().toLocaleDateString()}</h3>
      <ul>
        <li>New sign-ups: <strong>${newSignups}</strong></li>
        <li>Weekly revenue: <strong>$${weeklyRevenue.toFixed(2)}</strong></li>
        <li>Total tasks: <strong>${totalTasks}</strong></li>
        <li>Error rate: <strong>${errorRate}%</strong></li>
      </ul>
      <h3>Top 3 Templates</h3>
      <pre>${topTemplateList || 'No template data'}</pre>
      <p>View full dashboard: <a href="${process.env.APP_URL ?? 'https://sabha.ai'}/admin">Sabha Admin</a></p>
    `,
  })

  console.log('[admin-digest] Admin digest sent')
}

// ---------------------------------------------------------------------------
// queueMonitor — Every 1 minute
// ---------------------------------------------------------------------------

async function processQueueMonitor(_job: Job): Promise<void> {
  let queueDepth = 0
  try {
    // BullMQ stores waiting jobs in Redis; check the waiting count
    const waiting = await subtaskQueue.getWaitingCount()
    const delayed = await subtaskQueue.getDelayedCount()
    queueDepth = waiting + delayed
  } catch (err) {
    console.error('[queue-monitor] Failed to get queue stats:', err)
    return
  }

  if (queueDepth > 500) {
    await broadcastAdminAlert({
      title: 'CRITICAL: Queue Depth Spike',
      body: `Subtask queue depth is ${queueDepth} — far above safe threshold (500). Immediate attention required.`,
      severity: 'critical',
      metadata: { queueDepth },
    })
  } else if (queueDepth > 200) {
    await broadcastAdminAlert({
      title: 'Warning: Queue Depth Elevated',
      body: `Subtask queue depth is ${queueDepth}, above warning threshold (200). Monitor closely.`,
      severity: 'warning',
      metadata: { queueDepth },
    })
  }

  // Record queue depth metric
  metrics.queueDepth.set({ queue: 'subtask' }, queueDepth)
}

// ---------------------------------------------------------------------------
// startCronWorkers — registers all queues and workers
// ---------------------------------------------------------------------------

export function startCronWorkers(): void {
  // ---- Stale task scan: every 10 minutes ----
  staleTaskQueue.add(
    'scan',
    {},
    { repeat: { pattern: '*/10 * * * *' }, removeOnComplete: 10, removeOnFail: 5 }
  )
  new Worker('stale-task-scan', processStaleTaskScan, { connection: bullConnection })

  // ---- Dead-letter healing: every 5 minutes ----
  healingQueue.add(
    'heal',
    {},
    { repeat: { pattern: '*/5 * * * *' }, removeOnComplete: 10, removeOnFail: 5 }
  )
  new Worker('dead-letter-healing', processDeadLetterHealing, { connection: bullConnection })

  // ---- Template analytics: daily at 2am ----
  templateAnalyticsQueue.add(
    'compute',
    {},
    { repeat: { pattern: '0 2 * * *' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('template-analytics', processTemplateAnalytics, { connection: bullConnection })

  // ---- User digest: Sunday 9am ----
  userDigestQueue.add(
    'send',
    {},
    { repeat: { pattern: '0 9 * * 0' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('user-digest', processUserDigest, { connection: bullConnection })

  // ---- Admin digest: Monday 7am ----
  adminDigestQueue.add(
    'send',
    {},
    { repeat: { pattern: '0 7 * * 1' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('admin-digest', processAdminDigest, { connection: bullConnection })

  // ---- Queue monitor: every 1 minute ----
  queueMonitorQueue.add(
    'monitor',
    {},
    { repeat: { pattern: '* * * * *' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('queue-monitor', processQueueMonitor, { connection: bullConnection })

  console.log('[cron-workers] All cron workers started')
}
