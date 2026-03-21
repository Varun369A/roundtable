/**
 * Discussion Engine — Sabha's core differentiator.
 *
 * 3-round AI collaboration that turns a simple task into a genuine roundtable:
 *
 *   Round 1 — INITIAL   Each AI does its primary work in parallel.
 *   Round 2 — REVIEW    Each AI reads another AI's output and critiques / enriches it.
 *                       Cross-pollination: Claude reviews Perplexity's research,
 *                       GPT-4o reviews Claude's strategy, etc.
 *   Round 3 — SYNTHESIS One final AI (claude-opus or sabha-ai) reads every output
 *                       and every review, then produces the definitive integrated result.
 *
 * This is triggered from the queue worker after all Round-1 subtasks complete.
 */

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@sabha/db'
import type { AIModel, TaskCategory } from '@sabha/types'

// ─── Reviewer assignment ──────────────────────────────────────────────────────

// Which model should review the output of a given model?
// Goal: cross-pollination — always a different model, same capability tier where possible.
const REVIEWER_MAP: Partial<Record<AIModel, AIModel>> = {
  'claude-3-5-sonnet': 'gpt-4o',
  'claude-3-opus':     'gpt-4o',
  'gpt-4o':            'claude-3-5-sonnet',
  'gpt-4-turbo':       'claude-3-5-sonnet',
  'gemini-pro':        'claude-3-5-sonnet',
  'perplexity-sonar':  'claude-3-5-sonnet',  // Claude reviews the research
  'midjourney-v6':     'claude-3-5-sonnet',  // Claude writes a critique / caption
  'dalle-3':           'claude-3-5-sonnet',
  'stability-xl':      'claude-3-5-sonnet',
  'sarvam-1':          'claude-3-5-sonnet',
  'gamma':             'gpt-4o',
  'groq':              'claude-3-5-sonnet',
  'cohere':            'gpt-4o',
}

function getReviewerModel(originalModel: AIModel): AIModel {
  return REVIEWER_MAP[originalModel as keyof typeof REVIEWER_MAP] ?? 'claude-3-5-sonnet'
}

// ─── Build prompts ────────────────────────────────────────────────────────────

function buildReviewPrompt(
  originalTitle: string,
  originalModel: string,
  originalOutput: string,
  taskGoal: string,
): string {
  return `You are reviewing the following AI-generated output as part of a collaborative roundtable.

## Task Goal
${taskGoal}

## Output by ${originalModel} — "${originalTitle}"
${originalOutput}

## Your Review Instructions
As a peer AI in this roundtable:
1. **Identify strengths** — what did this AI do well?
2. **Find gaps or errors** — what is missing, incorrect, or could be improved?
3. **Enrich the output** — add your own insights, data, or perspectives that complement this work.
4. **Suggest concrete improvements** — specific, actionable recommendations.

Be constructive and collaborative. Your review will feed into the final synthesis. Keep it focused and under 600 words.`
}

function buildSynthesisPrompt(
  taskGoal: string,
  initialOutputs: Array<{ title: string; model: string; content: string }>,
  reviewOutputs: Array<{ title: string; model: string; content: string }>,
): string {
  const initialSection = initialOutputs.map((o, i) =>
    `### [AI ${i + 1}] ${o.model} — ${o.title}\n${o.content}`
  ).join('\n\n')

  const reviewSection = reviewOutputs.map((o, i) =>
    `### [Review ${i + 1}] ${o.model} — ${o.title}\n${o.content}`
  ).join('\n\n')

  return `You are the synthesis AI in a collaborative roundtable. Multiple AIs have worked on a task and peer-reviewed each other's outputs. Your job is to create the **definitive final result** that integrates the best of everything.

## Original Task Goal
${taskGoal}

---

## Round 1 — Initial Outputs
${initialSection}

---

## Round 2 — Peer Reviews
${reviewSection}

---

## Your Synthesis Instructions
Produce a single, polished, definitive output that:
1. **Integrates** the strongest elements from all AI outputs
2. **Incorporates** the improvements suggested in the peer reviews
3. **Resolves** any contradictions between AIs with clear reasoning
4. **Delivers** a complete, production-ready result — not a summary of what was said

This is the final deliverable the user will receive. Make it excellent.`
}

// ─── Review deduplication ─────────────────────────────────────────────────────

/**
 * Round 2 reviews run in parallel and don't see each other — Claude and GPT-4o
 * routinely flag the same gaps independently. This collapses duplicates before
 * synthesis reads them, improving output quality and reducing synthesis token cost.
 *
 * Uses claude-haiku for speed and cost (~₹0.30 per call).
 * Falls back to raw reviews on any error — never blocks synthesis.
 */
async function deduplicateReviews(
  reviews: Array<{ title: string; model: string; content: string }>
): Promise<Array<{ title: string; model: string; content: string }>> {
  if (reviews.length < 2) return reviews

  const reviewText = reviews
    .map((r, i) => `### Review ${i + 1} — ${r.model}\n${r.content}`)
    .join('\n\n')

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Multiple AIs independently reviewed the same output. Many flagged the same issues. Collapse into a single deduplicated list of unique insights — remove any point that is substantively repeated, keep every distinct suggestion, gap, or strength. Format as a numbered list.\n\n${reviewText}`,
      }],
    })

    const content = response.content[0]
    if (content.type !== 'text') return reviews

    return [{ title: 'Consolidated Peer Review', model: 'dedup-pass', content: content.text }]
  } catch {
    return reviews  // fall back to raw reviews on any error
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface DiscussionRound {
  roundNumber: number
  subtaskIds: string[]
}

/**
 * Check if Round 1 is complete and there are enough participants for discussion.
 * Returns the completed INITIAL subtask IDs, or null if not ready.
 */
export async function checkRound1Complete(taskId: string): Promise<string[] | null> {
  const subtasks = await prisma.subtask.findMany({
    where: { taskId, role: 'INITIAL' },
    select: { id: true, status: true },
  })

  if (subtasks.length < 2) return null  // need at least 2 AIs for a discussion

  const allComplete = subtasks.every(
    (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED' || s.status === 'FAILED'
  )
  const anyComplete = subtasks.some((s) => s.status === 'COMPLETED')

  return allComplete && anyComplete ? subtasks.filter((s) => s.status === 'COMPLETED').map((s) => s.id) : null
}

/**
 * Check if Round 2 is complete.
 */
export async function checkRound2Complete(taskId: string): Promise<boolean> {
  const reviews = await prisma.subtask.findMany({
    where: { taskId, role: 'REVIEW' },
    select: { status: true },
  })

  if (reviews.length === 0) return false

  return reviews.every(
    (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED' || s.status === 'FAILED'
  )
}

/**
 * Create Round 2 (REVIEW) subtasks.
 * Each completed INITIAL subtask gets reviewed by a different AI.
 * Returns the new subtask IDs.
 */
export async function createReviewSubtasks(taskId: string): Promise<string[]> {
  // Get all completed INITIAL subtasks with their outputs
  const initialSubtasks = await prisma.subtask.findMany({
    where: { taskId, role: 'INITIAL', status: 'COMPLETED' },
    include: { output: true },
    orderBy: { executionOrder: 'asc' },
  })

  if (initialSubtasks.length < 2) return []

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { originalGoal: true },
  })

  const created: string[] = []
  const baseOrder = Math.max(...initialSubtasks.map((s) => s.executionOrder)) + 1

  for (let i = 0; i < initialSubtasks.length; i++) {
    const targetSubtask = initialSubtasks[i]
    const content = targetSubtask.output?.content
    if (!content || content.length < 100) continue  // skip trivial outputs

    const reviewerModel = getReviewerModel(targetSubtask.assignedModel as AIModel)

    const reviewSubtask = await prisma.subtask.create({
      data: {
        taskId,
        title: `Peer Review: ${targetSubtask.title}`,
        category: targetSubtask.category,
        assignedModel: reviewerModel as any,
        status: 'PENDING',
        role: 'REVIEW',
        roundNumber: 2,
        reviewsSubtaskId: targetSubtask.id,
        dependsOn: [targetSubtask.id],
        executionOrder: baseOrder + i,
        inputPrompt: buildReviewPrompt(
          targetSubtask.title,
          targetSubtask.assignedModel,
          content.slice(0, 4000),
          task?.originalGoal ?? '',
        ),
      },
    })
    created.push(reviewSubtask.id)
  }

  return created
}

/**
 * Create Round 3 (SYNTHESIS) subtask.
 * A single synthesis AI reads all initial outputs + all reviews.
 * Returns the new subtask ID, or null if there's nothing to synthesize.
 */
export async function createSynthesisSubtask(taskId: string): Promise<string | null> {
  const [initialSubtasks, reviewSubtasks, task] = await Promise.all([
    prisma.subtask.findMany({
      where: { taskId, role: 'INITIAL', status: 'COMPLETED' },
      include: { output: true },
      orderBy: { executionOrder: 'asc' },
    }),
    prisma.subtask.findMany({
      where: { taskId, role: 'REVIEW', status: 'COMPLETED' },
      include: { output: true },
      orderBy: { executionOrder: 'asc' },
    }),
    prisma.task.findUnique({
      where: { id: taskId },
      select: {
        originalGoal: true,
        userId: true,
        user: { select: { tier: true } },
      },
    }),
  ])

  if (initialSubtasks.length === 0) return null

  const initialOutputs = initialSubtasks
    .filter((s) => s.output?.content)
    .map((s) => ({
      title: s.title,
      model: s.assignedModel,
      content: (s.output!.content ?? '').slice(0, 3000),
    }))

  const rawReviewOutputs = reviewSubtasks
    .filter((s) => s.output?.content)
    .map((s) => ({
      title: s.title,
      model: s.assignedModel,
      content: (s.output!.content ?? '').slice(0, 2000),
    }))

  // Deduplication pass: collapse duplicate review points before synthesis reads them
  const reviewOutputs = await deduplicateReviews(rawReviewOutputs)

  // Choose synthesis model per spec:
  // - Sabha AI if self-learning is enabled (feature flag)
  // - Claude Opus for Studio/Enterprise — quality justifies the cost
  // - Claude Sonnet for Free/Builder — margin-preserving default
  const sabhaState = await prisma.sabhaAIState.findUnique({ where: { id: 'singleton' } })
  const userTier = (task as any)?.user?.tier ?? 'FREE'
  const OPUS_TIERS = new Set(['STUDIO', 'ENTERPRISE'])
  const synthesisModel: AIModel =
    sabhaState?.status === 'ENABLED' ? 'sabha-ai' :
    OPUS_TIERS.has(userTier)         ? 'claude-3-opus' :
                                       'claude-3-5-sonnet'

  const allInitialIds = initialSubtasks.map((s) => s.id)
  const allReviewIds  = reviewSubtasks.map((s) => s.id)
  const maxOrder = Math.max(
    ...initialSubtasks.map((s) => s.executionOrder),
    ...reviewSubtasks.map((s) => s.executionOrder),
    0,
  ) + 1

  const synthesisSubtask = await prisma.subtask.create({
    data: {
      taskId,
      title: 'Roundtable Synthesis',
      category: 'general',
      assignedModel: synthesisModel as any,
      status: 'PENDING',
      role: 'SYNTHESIS',
      roundNumber: 3,
      dependsOn: [...allInitialIds, ...allReviewIds],
      executionOrder: maxOrder,
      inputPrompt: buildSynthesisPrompt(
        task?.originalGoal ?? '',
        initialOutputs,
        reviewOutputs,
      ),
    },
  })

  return synthesisSubtask.id
}

/**
 * Check if a SYNTHESIS subtask exists for this task.
 */
export async function synthesisExists(taskId: string): Promise<boolean> {
  const s = await prisma.subtask.findFirst({
    where: { taskId, role: 'SYNTHESIS' },
    select: { id: true },
  })
  return !!s
}

/**
 * Check if the synthesis subtask is complete.
 */
export async function checkSynthesisComplete(taskId: string): Promise<boolean> {
  const s = await prisma.subtask.findFirst({
    where: { taskId, role: 'SYNTHESIS' },
    select: { status: true },
  })
  return s?.status === 'COMPLETED' || s?.status === 'FAILED' || s?.status === 'SKIPPED'
}

/**
 * Are there any REVIEW subtasks for this task?
 */
export async function hasReviewRound(taskId: string): Promise<boolean> {
  const s = await prisma.subtask.findFirst({
    where: { taskId, role: 'REVIEW' },
    select: { id: true },
  })
  return !!s
}
