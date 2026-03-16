import { Queue, Worker, Job, QueueEvents } from 'bullmq'
import { redis } from '../lib/redis'
import { prisma } from '@sabha/db'
import type { AIModel } from '@sabha/types'
import { connectorRegistry } from '../connectors/registry'
import { getContext, buildPromptWithContext, appendSubtaskResult, clearContextCache } from '../orchestration/context-manager'
import { getReadySubtasks } from '../orchestration/orchestrator'
import { translateSubtaskOutput } from '../orchestration/language-layer'
import { metrics } from '../lib/metrics'
import { isEnabled, FLAGS } from '../lib/feature-flags'
import { sendTaskCompletionEmail } from '../lib/email'
import { createNotification } from '../lib/notifications'
import { firewallPrompt } from '../lib/ai-firewall'
import { triggerCodeAssembly } from '../routes/code-projects'

// ─── Queue definitions ────────────────────────────────────────────────────────

const connection = { host: redis.options.host || 'localhost', port: Number(redis.options.port) || 6379 }

export const taskQueue = new Queue<{ taskId: string }>('sabha:tasks', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
})

export const subtaskQueue = new Queue<{ subtaskId: string; taskId: string }>('sabha:subtasks', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 5000 },
    removeOnFail: { count: 1000 },
  },
})

export const queueEvents = new QueueEvents('sabha:subtasks', { connection })

// ─── Task Queue Worker ────────────────────────────────────────────────────────
// Picks up a task after orchestration and enqueues its first ready subtasks.

export const taskWorker = new Worker<{ taskId: string }>(
  'sabha:tasks',
  async (job: Job<{ taskId: string }>) => {
    const { taskId } = job.data
    console.log(`[TaskWorker] Processing task ${taskId}`)

    const readySubtaskIds = await getReadySubtasks(taskId)

    if (readySubtaskIds.length === 0) {
      console.warn(`[TaskWorker] No ready subtasks for task ${taskId}`)
      return
    }

    // Enqueue all ready subtasks (they run in parallel)
    await Promise.all(
      readySubtaskIds.map((subtaskId) =>
        subtaskQueue.add(
          `subtask:${subtaskId}`,
          { subtaskId, taskId },
          { jobId: `subtask:${subtaskId}` } // idempotency
        )
      )
    )

    console.log(`[TaskWorker] Enqueued ${readySubtaskIds.length} subtasks for task ${taskId}`)
  },
  { connection, concurrency: 50 }
)

// ─── Subtask Queue Worker ─────────────────────────────────────────────────────
// Executes a single subtask via the appropriate AI connector.

export const subtaskWorker = new Worker<{ subtaskId: string; taskId: string }>(
  'sabha:subtasks',
  async (job: Job<{ subtaskId: string; taskId: string }>) => {
    const { subtaskId, taskId } = job.data
    console.log(`[SubtaskWorker] Executing subtask ${subtaskId}`)

    const subtask = await prisma.subtask.findUnique({
      where: { id: subtaskId },
    })

    if (!subtask || subtask.status !== 'PENDING') {
      console.warn(`[SubtaskWorker] Subtask ${subtaskId} not in PENDING state, skipping`)
      return
    }

    // Mark as in progress
    await prisma.subtask.update({
      where: { id: subtaskId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    })

    const start = Date.now()

    try {
      // Get context
      const context = await getContext(taskId)
      if (!context) throw new Error(`Context not found for task ${taskId}`)

      // Build full prompt
      const rawPrompt = buildPromptWithContext(context, subtask.inputPrompt)

      // AI Firewall — sanitize before sending to AI model
      const firewallResult = await firewallPrompt(rawPrompt, taskId, context.userId)
      if (!firewallResult.allowed) {
        throw Object.assign(new Error('Prompt blocked by AI firewall'), { code: 'FIREWALL_BLOCKED' })
      }
      const fullPrompt = firewallResult.sanitized

      // Execute via connector
      const output = await connectorRegistry.execute(subtask.assignedModel as AIModel, {
        prompt: fullPrompt,
        model: subtask.assignedModel as AIModel,
        taskId,
        subtaskId,
      })

      // Save output to DB
      await prisma.subtaskOutput.create({
        data: {
          subtaskId,
          type: output.type,
          content:      output.content,
          fileUrl:      output.fileUrl,
          fileSizeBytes: output.fileSizeBytes,
          metadata:     output.metadata || {},
        },
      })

      // Update subtask
      await prisma.subtask.update({
        where: { id: subtaskId },
        data: {
          status:       'COMPLETED',
          completedAt:  new Date(),
          costUsd:      output.costUsd,
          inputTokens:  output.inputTokens,
          outputTokens: output.outputTokens,
        },
      })

      // Update context
      await appendSubtaskResult({
        taskId,
        subtaskId,
        title: subtask.title,
        executor: subtask.assignedModel as AIModel,
        outputContent: output.content || output.fileUrl || '',
      })

      // Translate output back to user's language if needed
      const { translatedContent, costUsd: translationCost } = await translateSubtaskOutput({
        taskId,
        subtaskId,
        content: output.content || '',
        outputType: output.type,
      })

      // Log billing event
      await prisma.billingEvent.create({
        data: {
          userId:      (await prisma.task.findUnique({ where: { id: taskId }, select: { userId: true } }))!.userId,
          taskId,
          eventType:   'api_call',
          aiModel:     subtask.assignedModel as AIModel,
          costUsd:     output.costUsd,
          inputTokens:  output.inputTokens,
          outputTokens: output.outputTokens,
          metadata:    { subtaskId, latencyMs: Date.now() - start },
        },
      })

      // Update task total cost (AI + translation)
      await prisma.task.update({
        where: { id: taskId },
        data: { totalCostUsd: { increment: output.costUsd } },
      })

      if (translationCost > 0) {
        await prisma.task.update({
          where: { id: taskId },
          data: { totalCostUsd: { increment: translationCost } },
        })
      }

      // Emit SSE event — user sees output in their language
      await redis.publish(`sabha:task:${taskId}`, JSON.stringify({
        event: 'subtask_completed',
        subtaskId,
        title: subtask.title,
        model: subtask.assignedModel,
        output: {
          type: output.type,
          content: translatedContent?.slice(0, 2000) || output.content?.slice(0, 2000),
          fileUrl: output.fileUrl,
        },
      }))

      // Enqueue next ready subtasks (DAG progression)
      await enqueueNextSubtasks(taskId)

    } catch (err) {
      console.error(`[SubtaskWorker] Subtask ${subtaskId} failed:`, err)

      await prisma.subtask.update({
        where: { id: subtaskId },
        data: { status: 'FAILED', completedAt: new Date() },
      })

      // If any subtask fails, mark task as failed
      const failedTask = await prisma.task.update({
        where: { id: taskId },
        data: { status: 'FAILED' },
        select: { userId: true, title: true },
      })
      metrics.tasksFailed.inc()

      // In-app failure notification
      createNotification({
        userId: failedTask.userId,
        type: 'task_failed',
        title: 'Task failed',
        body: `"${failedTask.title}" encountered an error. Click to retry.`,
        link: `/dashboard?task=${taskId}`,
        metadata: { taskId, error: err instanceof Error ? err.message : 'Unknown error' },
      }).catch(() => {})

      await redis.publish(`sabha:task:${taskId}`, JSON.stringify({
        event: 'subtask_failed',
        subtaskId,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))

      // Push to dead-letter queue for healing worker
      const errorCode = (err as NodeJS.ErrnoException).code || 'UNKNOWN'
      const existingAttempts = job.attemptsMade || 0
      await redis.rpush('sabha:dead-letter', JSON.stringify({
        subtaskId,
        taskId,
        errorType: errorCode,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        attempts: existingAttempts + 1,
        failedAt: Date.now(),
      }))

      throw err
    }
  },
  {
    connection,
    concurrency: 20, // run 20 subtasks in parallel across all tasks
  }
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function enqueueNextSubtasks(taskId: string): Promise<void> {
  const readyIds = await getReadySubtasks(taskId)

  if (readyIds.length === 0) {
    // Check if task is now complete
    const allSubtasks = await prisma.subtask.findMany({
      where: { taskId },
      select: { status: true },
    })

    const allDone = allSubtasks.every(
      (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED' || s.status === 'FAILED'
    )
    const anyFailed = allSubtasks.some((s) => s.status === 'FAILED')

    if (allDone && !anyFailed) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
      await clearContextCache(taskId)

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
          userId: true,
          title: true,
          totalCostUsd: true,
          subtasks: { select: { id: true } },
          user:    { select: { email: true, name: true } },
          template: { select: { category: true } },
        },
      })

      if (task) {
        await prisma.usageStats.upsert({
          where: { userId: task.userId },
          update: {
            totalTasksCompleted: { increment: 1 },
            totalSubtasksRun: { increment: allSubtasks.length },
          },
          create: { userId: task.userId, totalTasksCompleted: 1, totalSubtasksRun: allSubtasks.length },
        })

        // In-app notification (always)
        createNotification({
          userId: task.userId,
          type: 'task_completed',
          title: 'Task complete',
          body: `Your roundtable "${task.title}" finished — ${allSubtasks.length} AI subtasks ran.`,
          link: `/dashboard?task=${taskId}`,
          metadata: { taskId, subtaskCount: allSubtasks.length, costUsd: Number(task.totalCostUsd) },
        }).catch(() => {})

        // Send task completion email (non-blocking)
        if (await isEnabled(FLAGS.EMAIL_NOTIFICATIONS)) {
          sendTaskCompletionEmail({
            to: task.user.email,
            name: task.user.name,
            taskTitle: task.title,
            taskId,
            subtaskCount: allSubtasks.length,
            costUsd: Number(task.totalCostUsd),
          }).catch(() => {})
        }
      }

      // Auto-assemble code workspace for development category tasks
      if (task && task.template?.category === 'development') {
        triggerCodeAssembly(taskId, task.userId, task.title).catch(() => {})
      }

      metrics.tasksCompleted.inc()
      await redis.publish(`sabha:task:${taskId}`, JSON.stringify({
        event:           'task_completed',
        taskId,
        hasCodeWorkspace: task?.template?.category === 'development',
      }))
    }
    return
  }

  await Promise.all(
    readyIds.map((subtaskId) =>
      subtaskQueue.add(
        `subtask:${subtaskId}`,
        { subtaskId, taskId },
        { jobId: `subtask:${subtaskId}` }
      )
    )
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called by orchestrateTask() after subtasks are created in DB.
 * Kicks off the execution pipeline.
 */
export async function enqueueTask(taskId: string): Promise<void> {
  await taskQueue.add(`task:${taskId}`, { taskId }, { jobId: `task:${taskId}` })
}

export async function getQueueStats() {
  const [taskCounts, subtaskCounts] = await Promise.all([
    taskQueue.getJobCounts(),
    subtaskQueue.getJobCounts(),
  ])
  return { tasks: taskCounts, subtasks: subtaskCounts }
}
