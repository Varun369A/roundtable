/**
 * Correction Engine
 *
 * Handles user corrections: natural-language change requests after a task completes.
 *
 * Process:
 *   1. Parse which task categories are affected by the correction description
 *   2. Create a TaskVersion snapshot of the current build state (before changes)
 *   3. Reset affected subtasks to PENDING and delete their outputs
 *   4. Append the correction instruction to each affected subtask's prompt
 *   5. Re-initialize context and re-enqueue the task
 *   6. On completion, create a new TaskVersion and auto-push to GitHub if enabled
 */

import { prisma } from '@sabha/db'
import type { UserTier } from '@sabha/types'
import { enqueueTask } from '../jobs/queue'
import { initializeContext } from './context-manager'
import { firewallPrompt } from '../lib/ai-firewall'
import { pushFiles } from '../lib/github'

// ─── Category keyword map for correction parsing ──────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  code:          ['code', 'bug', 'function', 'component', 'api', 'endpoint', 'fix', 'error', 'implement'],
  design:        ['design', 'ui', 'layout', 'color', 'theme', 'dark mode', 'light mode', 'style', 'css'],
  copywriting:   ['copy', 'text', 'content', 'headline', 'description', 'tone', 'write', 'rewrite'],
  strategy:      ['strategy', 'approach', 'plan', 'positioning', 'target'],
  research:      ['research', 'data', 'find', 'look up', 'search'],
  image:         ['image', 'photo', 'picture', 'visual', 'illustration'],
  audio:         ['audio', 'voice', 'sound', 'narration', 'script'],
  video:         ['video', 'clip', 'animation', 'footage'],
  translation:   ['translate', 'language', 'hindi', 'tamil', 'bengali', 'telugu'],
  data_analysis: ['analysis', 'chart', 'graph', 'metrics', 'insights'],
  general:       [],
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StartCorrectionOptions {
  taskId:      string
  userId:      string
  userTier:    UserTier
  description: string
}

export interface StartCorrectionResult {
  correctionId:       string
  affectedCategories: string[]
  subtasksReset:      number
  versionNumber:      number
}

// ─── startCorrection ──────────────────────────────────────────────────────────

export async function startCorrection(opts: StartCorrectionOptions): Promise<StartCorrectionResult> {
  const { taskId, userId, description } = opts

  // Scan for injection / PII before touching the DB
  await firewallPrompt(description, taskId, userId)

  // Ownership + completion check
  const task = await prisma.task.findFirst({
    where:  { id: taskId, userId },
    select: { id: true, status: true, originalGoal: true },
  })

  if (!task) {
    const err = new Error('Task not found') as any
    err.statusCode = 404; err.code = 'TASK_NOT_FOUND'
    throw err
  }
  if (task.status !== 'COMPLETED') {
    const err = new Error('Can only correct completed tasks') as any
    err.statusCode = 400; err.code = 'TASK_NOT_COMPLETED'
    throw err
  }

  // Snapshot current state BEFORE making any changes
  const currentVersion = await createTaskVersion(
    taskId,
    `Before correction: ${description.slice(0, 80)}`
  )

  // Determine which categories are affected
  const affectedCategories = detectAffectedCategories(description)

  // Find Round 1 (INITIAL) subtasks in affected categories
  const affectedSubtasks = await prisma.subtask.findMany({
    where: {
      taskId,
      category: { in: affectedCategories as any },
      role: 'INITIAL',
    },
    select: { id: true, category: true },
  })

  if (affectedSubtasks.length === 0) {
    const err = new Error('No matching subtasks found for this correction. Try being more specific.') as any
    err.statusCode = 400; err.code = 'NO_AFFECTED_SUBTASKS'
    throw err
  }

  const affectedSubtaskIds = affectedSubtasks.map((s) => s.id)

  // BFS: also reset downstream Review and Synthesis subtasks
  const allToReset = await getDownstreamSubtasks(taskId, affectedSubtaskIds)

  // Create the correction record
  const correction = await prisma.taskCorrection.create({
    data: {
      taskId,
      userId,
      description,
      affectedCategories,
      status: 'IN_PROGRESS',
    },
  })

  // Atomically reset subtasks, delete outputs, mark task IN_PROGRESS
  await prisma.$transaction([
    prisma.subtask.updateMany({
      where: { id: { in: allToReset } },
      data: {
        status:      'PENDING',
        startedAt:   null,
        completedAt: null,
        costUsd:     null,
      },
    }),
    prisma.subtaskOutput.deleteMany({
      where: { subtaskId: { in: allToReset } },
    }),
    prisma.task.update({
      where: { id: taskId },
      data:  { status: 'IN_PROGRESS' },
    }),
  ])

  // Append correction instruction to each affected subtask's prompt
  for (const subtaskId of affectedSubtaskIds) {
    const subtask = await prisma.subtask.findUnique({
      where:  { id: subtaskId },
      select: { inputPrompt: true },
    })
    if (!subtask) continue

    await prisma.subtask.update({
      where: { id: subtaskId },
      data: {
        inputPrompt: `${subtask.inputPrompt}\n\n[CORRECTION REQUEST]: ${description}`,
      },
    })
  }

  // Re-initialize context and re-enqueue
  await initializeContext({
    taskId,
    userId,
    originalGoal: task.originalGoal,
    language:     'en',
    constraints:  [],
  })
  await enqueueTask(taskId)

  return {
    correctionId:       correction.id,
    affectedCategories,
    subtasksReset:      allToReset.length,
    versionNumber:      currentVersion.versionNumber,
  }
}

// ─── onCorrectionComplete ─────────────────────────────────────────────────────
// Called from the queue worker when a corrected task finishes.

export async function onCorrectionComplete(
  taskId:      string,
  userId:      string,
  correctionId: string,
): Promise<void> {
  const correction = await prisma.taskCorrection.findFirst({
    where:  { id: correctionId, taskId },
    select: { description: true },
  })
  if (!correction) return

  const version = await createTaskVersion(
    taskId,
    `Correction: ${correction.description.slice(0, 80)}`
  )

  // Auto-push to GitHub if user has a connected GitHub account
  let commitUrl: string | undefined
  const githubConn = await prisma.gitHubConnection.findUnique({
    where:  { userId },
    select: { accessToken: true, login: true },
  })

  if (githubConn) {
    try {
      // Collect text outputs as files
      const subtasks = await prisma.subtask.findMany({
        where:  { taskId, status: 'COMPLETED' },
        select: { title: true, category: true, output: { select: { content: true, type: true } } },
      })
      const files = subtasks
        .filter((s) => (s.output?.type as string) === 'TEXT' && s.output?.content)
        .map((s) => ({
          path:    `${s.category}/${s.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`,
          content: s.output!.content!,
        }))

      if (files.length > 0) {
        const repoName = `sabha-build-${taskId.slice(-8)}`
        const commitSha = await pushFiles(
          githubConn.accessToken,
          githubConn.login,
          repoName,
          files,
          `Sabha correction: ${correction.description.slice(0, 72)}`,
        )
        commitUrl = `https://github.com/${githubConn.login}/${repoName}/commit/${commitSha}`

        await prisma.taskVersion.update({
          where: { id: version.id },
          data:  { githubCommit: commitSha },
        })
      }
    } catch (err) {
      console.error('[CorrectionEngine] GitHub push failed:', err)
    }
  }

  await prisma.taskCorrection.update({
    where: { id: correctionId },
    data: {
      status:         'COMPLETED',
      completedAt:    new Date(),
      resultVersionId: version.id,
      githubCommitUrl: commitUrl ?? null,
    },
  })
}

// ─── createTaskVersion ────────────────────────────────────────────────────────

export async function createTaskVersion(
  taskId:      string,
  description: string,
): Promise<{ id: string; versionNumber: number }> {
  const existing = await prisma.taskVersion.count({ where: { taskId } })
  const versionNumber = existing + 1

  // Snapshot all completed subtask outputs
  const subtasks = await prisma.subtask.findMany({
    where: { taskId, status: 'COMPLETED' },
    select: {
      id:            true,
      title:         true,
      category:      true,
      assignedModel: true,
      role:          true,
      output: { select: { content: true, fileUrl: true, type: true } },
    },
  })

  const snapshot: Record<string, unknown> = {}
  for (const s of subtasks) {
    snapshot[s.id] = {
      title:    s.title,
      category: s.category,
      model:    s.assignedModel,
      role:     s.role,
      content:  s.output?.content  ?? null,
      fileUrl:  s.output?.fileUrl  ?? null,
      type:     s.output?.type     ?? 'TEXT',
    }
  }

  const version = await prisma.taskVersion.create({
    data: { taskId, versionNumber, description, snapshot: snapshot as any },
    select: { id: true, versionNumber: true },
  })

  return version
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectAffectedCategories(description: string): string[] {
  const lower = description.toLowerCase()
  const affected: string[] = []

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      affected.push(category)
    }
  }

  // Fallback: re-run everything under 'general'
  return affected.length > 0 ? affected : ['general']
}

async function getDownstreamSubtasks(taskId: string, initialIds: string[]): Promise<string[]> {
  const all = new Set(initialIds)
  const allSubtasks = await prisma.subtask.findMany({
    where:  { taskId },
    select: { id: true, dependsOn: true },
  })

  let changed = true
  while (changed) {
    changed = false
    for (const s of allSubtasks) {
      if (all.has(s.id)) continue
      const deps = s.dependsOn as string[]
      if (deps.some((dep) => all.has(dep))) {
        all.add(s.id)
        changed = true
      }
    }
  }

  return [...all]
}
