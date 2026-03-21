import { redis } from '../lib/redis'
import { prisma } from '@sabha/db'
import type { ContextObject, CompletedSubtaskSummary, AIModel } from '@sabha/types'

const CONTEXT_TTL = 60 * 60 * 24 // 24 hours in seconds
const CONTEXT_KEY = (taskId: string) => `sabha:context:${taskId}`

/**
 * Initialize context object when a task starts.
 * Stored in Redis for fast access during execution,
 * and persisted to Postgres on the task record.
 */
export async function initializeContext(params: {
  taskId: string
  originalGoal: string
  userId: string
  language?: string
  constraints?: string[]
}): Promise<ContextObject> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { preferences: true },
  })

  const preferences = (user?.preferences as Record<string, unknown>) || {}

  const context: ContextObject = {
    taskId: params.taskId,
    userId: params.userId,
    originalGoal: params.originalGoal,
    userProfile: {
      language: params.language || 'en',
      preferredTone: (preferences.tone as string) || undefined,
      industry:      (preferences.industry as string) || undefined,
    },
    completedSubtasks: [],
    activeConstraints: params.constraints || [],
  }

  // Store in Redis for fast access
  await redis.setex(CONTEXT_KEY(params.taskId), CONTEXT_TTL, JSON.stringify(context))

  // Persist to DB
  await prisma.task.update({
    where: { id: params.taskId },
    data: { contextObject: context as any },
  })

  return context
}

/**
 * Get current context for a task.
 * Redis-first, falls back to Postgres.
 */
export async function getContext(taskId: string): Promise<ContextObject | null> {
  // Try Redis first
  const cached = await redis.get(CONTEXT_KEY(taskId))
  if (cached) {
    try {
      return JSON.parse(cached) as ContextObject
    } catch {
      // corrupted cache — fall through to DB
    }
  }

  // Fallback to DB
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { contextObject: true },
  })

  if (!task?.contextObject) return null

  const context = task.contextObject as unknown as ContextObject

  // Restore to Redis
  await redis.setex(CONTEXT_KEY(taskId), CONTEXT_TTL, JSON.stringify(context))

  return context
}

/**
 * After a subtask completes, update the context with its summary.
 * All subsequent AIs will know what this subtask produced.
 */
export async function appendSubtaskResult(params: {
  taskId: string
  subtaskId: string
  title: string
  executor: AIModel
  outputContent: string
}): Promise<ContextObject> {
  const context = await getContext(params.taskId)
  if (!context) throw new Error(`Context not found for task ${params.taskId}`)

  // Summarise output — 1,500 chars keeps enough context for dependent AIs to write
  // properly informed copy; indirect context is naturally compressed by the model's window
  const summary = params.outputContent.slice(0, 1500) + (params.outputContent.length > 1500 ? '...' : '')

  const completedEntry: CompletedSubtaskSummary = {
    id: params.subtaskId,
    title: params.title,
    executor: params.executor,
    outputSummary: summary,
    completedAt: new Date(),
  }

  const updatedContext: ContextObject = {
    ...context,
    completedSubtasks: [...context.completedSubtasks, completedEntry],
  }

  // Update Redis
  await redis.setex(CONTEXT_KEY(params.taskId), CONTEXT_TTL, JSON.stringify(updatedContext))

  // Persist to DB
  await prisma.task.update({
    where: { id: params.taskId },
    data: { contextObject: updatedContext as any },
  })

  return updatedContext
}

/**
 * Build the full prompt for an AI given the current context + subtask instruction.
 * This is what gets sent to every AI connector.
 */
export function buildPromptWithContext(context: ContextObject, instruction: string): string {
  const parts: string[] = []

  parts.push(`# Original Goal\n${context.originalGoal}`)

  if (context.activeConstraints.length > 0) {
    parts.push(`# Constraints\n${context.activeConstraints.join('\n')}`)
  }

  if (context.completedSubtasks.length > 0) {
    parts.push('# Work Completed So Far')
    for (const completed of context.completedSubtasks) {
      parts.push(`## ${completed.title} (by ${completed.executor})\n${completed.outputSummary}`)
    }
  }

  parts.push(`# Your Task\n${instruction}`)

  if (context.userProfile.language && context.userProfile.language !== 'en') {
    parts.push(`# Language Requirement\nRespond in language code: ${context.userProfile.language}`)
  }

  return parts.join('\n\n')
}

/**
 * Clean up context from Redis when task is fully done.
 * DB copy persists forever.
 */
export async function clearContextCache(taskId: string): Promise<void> {
  await redis.del(CONTEXT_KEY(taskId))
}
