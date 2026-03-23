/**
 * Clarification Generator — Enterprise Grade
 *
 * Uses Claude to analyse the user's goal and generate 2–3 targeted questions
 * that will meaningfully improve the AI output quality.
 *
 * Design principles:
 * - Questions must be consequential (skippable = low-value)
 * - Context-aware: considers user memory, workspace, template category
 * - Timeout-safe: if user doesn't answer in CLARIFICATION_TIMEOUT_MS, auto-proceeds
 * - Never blocks paid/urgent tasks (can be disabled per workspace)
 */
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@arivarangam/db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Auto-proceed after 10 minutes of no response
export const CLARIFICATION_TIMEOUT_MS = 10 * 60 * 1000

export interface ClarificationQuestion {
  question: string
  hint?: string        // placeholder text for input
  isRequired: boolean  // if false, has a sensible default
  defaultValue?: string
}

interface GenerateClarificationsInput {
  taskId:          string
  goal:            string
  userId:          string
  templateCategory?: string
  memoryContext?:  string  // pre-fetched user memory summary
}

/**
 * Generate 2–3 smart clarification questions for a task goal.
 * Returns empty array if the goal is already specific enough.
 */
export async function generateClarifications(
  input: GenerateClarificationsInput,
): Promise<ClarificationQuestion[]> {
  const { goal, templateCategory, memoryContext } = input

  const systemPrompt = `You are an intelligent task analyst for Arivarangam, a multi-AI orchestration platform.

Your job: analyse a user's task goal and decide if clarification is needed.

Rules:
- Only ask if the answer will MEANINGFULLY change the AI's output
- Max 3 questions. Fewer is better. 0 is acceptable if the goal is already clear.
- Questions must be specific and quick to answer (< 15 seconds each)
- Never ask for information the user already provided in the goal
- Never ask obvious or demographic questions
- Focus on: target audience, tone/style, specific constraints, preferred format, deadline context

Return ONLY valid JSON in this exact format:
{
  "needsClarification": true/false,
  "reasoning": "one sentence explaining why",
  "questions": [
    {
      "question": "What is the primary audience for this content?",
      "hint": "e.g. B2B SaaS founders, students, retail consumers",
      "isRequired": false,
      "defaultValue": "general business audience"
    }
  ]
}`

  const userPrompt = `Task goal: "${goal}"
${templateCategory ? `Template category: ${templateCategory}` : ''}
${memoryContext ? `\nKnown user context:\n${memoryContext}` : ''}

Analyse this goal. Is clarification needed? If yes, what 1–3 questions would most improve the output quality?`

  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-5',
      max_tokens: 800,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('')

    // Extract JSON from response (may have surrounding text)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return []

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.needsClarification || !Array.isArray(parsed.questions)) return []

    return parsed.questions.slice(0, 3) as ClarificationQuestion[]
  } catch (err) {
    console.error('[ClarificationGenerator] Failed to generate questions:', err)
    return []
  }
}

/**
 * Save generated questions to DB and update task status.
 * Returns the saved clarification IDs.
 */
export async function saveClarifications(
  taskId:    string,
  questions: ClarificationQuestion[],
): Promise<string[]> {
  if (questions.length === 0) return []

  const created = await prisma.$transaction(
    questions.map((q, i) =>
      prisma.taskClarification.create({
        data: {
          taskId,
          question:    q.question,
          orderIndex:  i,
          answer:      q.defaultValue ?? null,
        },
      })
    )
  )

  await prisma.task.update({
    where: { id: taskId },
    data:  { status: 'WAITING_CLARIFICATION' },
  })

  return created.map((c) => c.id)
}

/**
 * Build a context string from answered clarifications,
 * for injection into the task's system prompt.
 */
export async function buildClarificationContext(taskId: string): Promise<string> {
  const clarifications = await prisma.taskClarification.findMany({
    where:   { taskId },
    orderBy: { orderIndex: 'asc' },
  })

  const answered = clarifications.filter((c) => c.answer && !c.skipped)
  if (answered.length === 0) return ''

  const lines = answered.map((c) => `- ${c.question}\n  Answer: ${c.answer}`)
  return `\nUser-provided clarifications:\n${lines.join('\n')}`
}

/**
 * Check if a task has timed out waiting for clarifications.
 * Auto-skips unanswered questions and returns true if task should proceed.
 */
export async function checkClarificationTimeout(taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({
    where:  { id: taskId },
    select: { status: true, createdAt: true },
  })

  if (task?.status !== 'WAITING_CLARIFICATION') return false

  const elapsed = Date.now() - task.createdAt.getTime()
  if (elapsed < CLARIFICATION_TIMEOUT_MS) return false

  // Auto-skip all unanswered questions
  await prisma.taskClarification.updateMany({
    where: { taskId, answer: null },
    data:  { skipped: true },
  })

  return true
}
