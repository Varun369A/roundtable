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
import { getNextRunTime } from '../lib/cron-expression'
import { decayStaleMemories } from '../lib/memory-manager'
import { pruneStaleParticipants } from '../lib/session-manager'
import { orchestrateTask } from '../orchestration/orchestrator'
import { enqueueTask } from './queue'
import { expireStaleReviews } from '../lib/expert-marketplace'
import { creditWallet } from '../lib/credit-manager'
import { runContentGeneration } from './content-generator'
import { runDailyApprovalNotifier } from './daily-approval-notifier'
import { runEngagementMonitor } from './engagement-monitor'
import { runPostScheduler } from './post-scheduler'

const prisma = new PrismaClient()

// ─── Distributed cron lock (prevents duplicate runs across API instances) ─────

async function acquireCronLock(jobName: string, ttlSeconds: number): Promise<boolean> {
  const key = `cron:lock:${jobName}`
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX')
  return result === 'OK'
}

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
const sabhaLearningQueue = new Queue('sabha-learning', { connection: bullConnection })
const scheduledTaskQueue = new Queue('scheduled-tasks', { connection: bullConnection })
const memoryDecayQueue = new Queue('memory-decay', { connection: bullConnection })
const clarificationTimeoutQueue = new Queue('clarification-timeout', { connection: bullConnection })
const presencePruneQueue = new Queue('presence-prune', { connection: bullConnection })
const expireReviewsQueue = new Queue('expire-reviews', { connection: bullConnection })
const creditExpiryQueue = new Queue('credit-expiry', { connection: bullConnection })
const contentGenerationQueue = new Queue('content-generation', { connection: bullConnection })
const dailyApprovalQueue = new Queue('daily-approval-notifier', { connection: bullConnection })
const engagementMonitorQueue = new Queue('engagement-monitor', { connection: bullConnection })
const postSchedulerQueue = new Queue('post-scheduler', { connection: bullConnection })

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

  const stuckTasks = await prisma.task.findMany({
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
      await prisma.task.update({
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
        await prisma.subtask.update({
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

      await prisma.subtask.update({
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
        const flag = await prisma.featureFlag.findFirst({ where: { key: flagName } })
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
        const fallbackFlag = await prisma.featureFlag.findFirst({
          where: { key: 'fallback_model_timeout' },
        })
        const fallbackModel = (fallbackFlag?.config as any)?.model ?? 'claude-haiku-4-5'

        await prisma.subtask.update({
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
        await prisma.subtask.update({
          where: { id: subtaskId },
          data: { status: 'FAILED', updatedAt: new Date() },
        })

        // Find task owner and notify
        const task = await prisma.task.findUnique({
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
  const acquired = await acquireCronLock('template-analytics', 82800) // 23hr lock (runs daily)
  if (!acquired) { _job.log('Skipped — another instance running'); return }
  const since7d = new Date(Date.now() - 7 * 86_400_000)

  const templates = await prisma.roundtableTemplate.findMany({
    where: { isBuiltIn: true, isPublic: true },
    select: { id: true, name: true },
  })

  for (const template of templates) {
    try {
      const [tasks, completedTasks] = await Promise.all([
        prisma.task.findMany({
          where: { templateId: template.id, createdAt: { gte: since7d } },
          select: { id: true, status: true, userId: true, createdAt: true, totalCostUsd: true, completedAt: true },
        }),
        prisma.task.findMany({
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
        const laterTask = await prisma.task.findFirst({
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

      await prisma.templateAnalytics.upsert({
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
  const emailFlag = await prisma.featureFlag.findFirst({
    where: { key: 'email_notifications' },
  })
  if (emailFlag && !emailFlag.enabled) {
    console.log('[user-digest] email_notifications flag is disabled, skipping')
    return
  }

  const since30d = new Date(Date.now() - 30 * 86_400_000)
  const since7d = new Date(Date.now() - 7 * 86_400_000)

  const users = await prisma.user.findMany({
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
        prisma.task.count({
          where: { userId: user.id, createdAt: { gte: since7d } },
        }),
        prisma.task.count({
          where: { userId: user.id, status: 'COMPLETED', createdAt: { gte: since7d } },
        }),
        prisma.billingEvent.aggregate({
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
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.billingEvent.aggregate({
      where: { createdAt: { gte: since7d } },
      _sum: { costUsd: true },
    }),
    prisma.task.groupBy({
      by: ['templateId'],
      _count: { id: true },
      where: { createdAt: { gte: since7d }, templateId: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take: 3,
    }),
    prisma.task.count({
      where: { status: 'FAILED', createdAt: { gte: since7d } },
    }),
    prisma.task.count({ where: { createdAt: { gte: since7d } } }),
  ])

  // Enrich top templates with names
  const topTemplateIds = topTemplates.map((t: any) => t.templateId).filter(Boolean)
  const templateNames = await prisma.roundtableTemplate.findMany({
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
// sabhaLearningWorker — Every 15 minutes
// Checks if Sabha AI has accumulated enough knowledge to be "ready".
// Notifies admin when threshold is reached.
// ---------------------------------------------------------------------------

async function processSabhaLearning(_job: Job): Promise<void> {
  const acquired = await acquireCronLock('sabha-learning', 840) // 14min lock (runs every 15min)
  if (!acquired) { _job.log('Skipped — another instance running'); return }
  const knowledgeCount = await prisma.sabhaKnowledge.count()

  const state = await prisma.sabhaAIState.upsert({
    where: { id: 'singleton' },
    update: { knowledgeCount, lastLearnedAt: new Date() },
    create: { id: 'singleton', knowledgeCount, lastLearnedAt: new Date() },
    select: { status: true, readyThreshold: true, knowledgeCount: true },
  })

  // Transition LEARNING → READY when threshold is met
  if (state.status === 'LEARNING' && knowledgeCount >= state.readyThreshold) {
    await prisma.sabhaAIState.update({
      where: { id: 'singleton' },
      data: { status: 'READY' },
    })

    // Notify all admin users
    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
    })

    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: 'system_alert',
        title: 'Sabha AI is ready',
        body: `Sabha AI has learned from ${knowledgeCount} tasks. Go to Admin → Sabha AI to enable it.`,
        link: '/admin/sabha',
        metadata: { knowledgeCount },
      }).catch(() => {})
    }

    console.log(`[sabha-learning] Sabha AI reached READY state with ${knowledgeCount} knowledge entries`)
  } else {
    console.log(`[sabha-learning] Knowledge: ${knowledgeCount}/${state.readyThreshold} — status: ${state.status}`)
  }
}

// ---------------------------------------------------------------------------
// Scheduled Task Runner — every minute
// ---------------------------------------------------------------------------

async function processScheduledTasks(): Promise<void> {
  const acquired = await acquireCronLock('scheduled-tasks', 55) // 55s lock (runs every minute)
  if (!acquired) { console.log('[ScheduledTaskRunner] Skipped — another instance running'); return }
  const now = new Date()

  const due = await prisma.scheduledTask.findMany({
    where: {
      isActive:   true,
      nextRunAt:  { lte: now },
    },
    take: 50,
  })

  for (const scheduled of due) {
    // Skip if maxRuns reached
    if (scheduled.maxRuns !== null && scheduled.runCount >= scheduled.maxRuns) {
      await prisma.scheduledTask.update({
        where: { id: scheduled.id },
        data:  { isActive: false },
      })
      continue
    }

    // Create a run record
    const run = await prisma.scheduledTaskRun.create({
      data: {
        scheduledTaskId: scheduled.id,
        status:          'running',
        triggerType:     'scheduled',
      },
    })

    try {
      // Create the actual task
      const workspace = scheduled.workspaceId
        ? { connect: { id: scheduled.workspaceId } }
        : undefined

      const task = await prisma.task.create({
        data: {
          userId:       scheduled.userId,
          workspaceId:  scheduled.workspaceId ?? undefined,
          originalGoal: scheduled.goal,
          title:        scheduled.name,
          status:       'PENDING',
          templateId:   scheduled.templateId ?? undefined,
        },
      })

      // Enqueue task — skip clarification for scheduled tasks (automated)
      await enqueueTask(task.id)

      // Update run record
      await prisma.scheduledTaskRun.update({
        where: { id: run.id },
        data:  { taskId: task.id, status: 'completed', completedAt: new Date() },
      })

      // Compute next run time
      const nextRunAt = getNextRunTime(scheduled.cronExpression, now)

      await prisma.scheduledTask.update({
        where: { id: scheduled.id },
        data: {
          lastRunAt: now,
          nextRunAt,
          runCount: { increment: 1 },
        },
      })

      if (scheduled.notifyOnComplete) {
        await createNotification({
          userId: scheduled.userId,
          type:   'task_completed',
          title:  `Scheduled task started`,
          body:   `"${scheduled.name}" has been started automatically.`,
          link:   `/roundtable/${task.id}`,
          metadata: { scheduledTaskId: scheduled.id, taskId: task.id },
        })
      }
    } catch (err) {
      console.error(`[ScheduledTaskRunner] Failed to run scheduled task ${scheduled.id}:`, err)

      await prisma.scheduledTaskRun.update({
        where: { id: run.id },
        data:  { status: 'failed', completedAt: new Date(), errorMessage: err instanceof Error ? err.message : 'Unknown error' },
      })

      await prisma.scheduledTask.update({
        where: { id: scheduled.id },
        data:  { failCount: { increment: 1 } },
      })

      if (scheduled.notifyOnFail) {
        await createNotification({
          userId: scheduled.userId,
          type:   'task_failed',
          title:  'Scheduled task failed',
          body:   `"${scheduled.name}" failed to start. Check your scheduled tasks.`,
          link:   '/dashboard/scheduled',
          metadata: { scheduledTaskId: scheduled.id, error: err instanceof Error ? err.message : 'Unknown' },
        })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Memory Decay Worker — weekly Sunday 3am
// ---------------------------------------------------------------------------

async function processMemoryDecay(): Promise<void> {
  const acquired = await acquireCronLock('memory-decay', 3600) // 1hr lock
  if (!acquired) { console.log('[MemoryDecay] Skipped — another instance running'); return }
  console.log('[MemoryDecay] Running confidence decay for stale inferred memories...')
  await decayStaleMemories()
  console.log('[MemoryDecay] Done')
}

// ---------------------------------------------------------------------------
// Clarification Timeout Checker — every 5 minutes
// ---------------------------------------------------------------------------

async function processClarificationTimeouts(): Promise<void> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

  const timedOut = await prisma.task.findMany({
    where: {
      status:    'WAITING_CLARIFICATION',
      createdAt: { lt: tenMinutesAgo },
    },
    select: { id: true },
    take:   50,
  })

  for (const task of timedOut) {
    // Auto-skip unanswered questions
    await prisma.taskClarification.updateMany({
      where: { taskId: task.id, answer: null },
      data:  { skipped: true },
    })
    // Resume orchestration
    console.log(`[ClarificationTimeout] Auto-proceeding task ${task.id} after timeout`)
    orchestrateTask(task.id).catch((err) =>
      console.error(`[ClarificationTimeout] Failed to resume task ${task.id}:`, err)
    )
  }
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

  // ---- Sabha AI learning check: every 15 minutes ----
  sabhaLearningQueue.add(
    'check',
    {},
    { repeat: { pattern: '*/15 * * * *' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('sabha-learning', processSabhaLearning, { connection: bullConnection })

  // ---- Scheduled task runner: every minute ----
  scheduledTaskQueue.add(
    'run',
    {},
    { repeat: { pattern: '* * * * *' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('scheduled-tasks', processScheduledTasks, { connection: bullConnection })

  // ---- Memory decay: weekly Sunday 3am ----
  memoryDecayQueue.add(
    'decay',
    {},
    { repeat: { pattern: '0 3 * * 0' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('memory-decay', processMemoryDecay, { connection: bullConnection })

  // ---- Clarification timeout: every 5 minutes ----
  clarificationTimeoutQueue.add(
    'check',
    {},
    { repeat: { pattern: '*/5 * * * *' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('clarification-timeout', processClarificationTimeouts, { connection: bullConnection })

  // ---- Presence pruning: every 1 minute ----
  presencePruneQueue.add(
    'prune',
    {},
    { repeat: { pattern: '* * * * *' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('presence-prune', async () => { await pruneStaleParticipants() }, { connection: bullConnection })

  // ---- Expert review expiry: every 30 minutes ----
  expireReviewsQueue.add(
    'expire',
    {},
    { repeat: { pattern: '*/30 * * * *' }, removeOnComplete: 10, removeOnFail: 5 }
  )
  new Worker('expire-reviews', async (_job: Job) => { await expireStaleReviews() }, { connection: bullConnection })

  // ---- Credit expiry: daily at 2am UTC ----
  creditExpiryQueue.add(
    'expire',
    {},
    { repeat: { pattern: '0 2 * * *' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('credit-expiry', async (_job: Job) => {
    // Find all promotional credit transactions that have expired
    const expired = await prisma.creditTransaction.findMany({
      where: {
        expiresAt: { lt: new Date() },
        type: 'PROMOTION',
      },
    })

    let expiredCount = 0

    for (const tx of expired) {
      // Avoid double-expiry: check if an EXPIRY transaction already references this tx
      const alreadyExpired = await prisma.creditTransaction.findFirst({
        where: {
          walletId: tx.walletId,
          type: 'EXPIRY',
          description: { contains: tx.id },
        },
      })
      if (alreadyExpired) continue

      // Cap at current wallet balance to avoid going negative
      const wallet = await prisma.creditWallet.findUnique({ where: { id: tx.walletId } })
      if (!wallet || wallet.balance <= 0) continue

      const expireAmount = Math.min(tx.amount, wallet.balance)
      await creditWallet(
        wallet.userId,
        -expireAmount,
        'EXPIRY' as any,
        `Promotional credits expired (tx: ${tx.id})`
      )
      expiredCount++
    }

    if (expiredCount > 0) {
      console.log(`[credit-expiry] Expired ${expiredCount} promotional credit transaction(s)`)
    }
  }, { connection: bullConnection })

  // ---- Content generation: every day at 11pm IST (5pm UTC) ----
  contentGenerationQueue.add(
    'generate',
    {},
    { repeat: { pattern: '0 17 * * *' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('content-generation', async (_job: Job) => { await runContentGeneration() }, { connection: bullConnection })

  // ---- Daily approval notifier: every day at 8am IST (2:30am UTC) ----
  dailyApprovalQueue.add(
    'notify',
    {},
    { repeat: { pattern: '30 2 * * *' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('daily-approval-notifier', async (_job: Job) => { await runDailyApprovalNotifier() }, { connection: bullConnection })

  // ---- Engagement monitor: every 2 hours ----
  engagementMonitorQueue.add(
    'monitor',
    {},
    { repeat: { pattern: '0 */2 * * *' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('engagement-monitor', async (_job: Job) => { await runEngagementMonitor() }, { connection: bullConnection })

  // ---- Post scheduler: every 5 minutes ----
  postSchedulerQueue.add(
    'schedule',
    {},
    { repeat: { pattern: '*/5 * * * *' }, removeOnComplete: 5, removeOnFail: 3 }
  )
  new Worker('post-scheduler', async (_job: Job) => { await runPostScheduler() }, { connection: bullConnection })

  console.log('[cron-workers] All cron workers started')
}
