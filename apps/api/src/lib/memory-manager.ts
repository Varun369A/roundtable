/**
 * User Memory Manager — Enterprise Grade
 *
 * Arivarangam remembers everything meaningful about the user across all tasks.
 * Memory has two layers:
 *
 *   1. Structured keys (UserMemory) — explicit facts: business type, tone, audience
 *      - User-set (from onboarding / settings)
 *      - Inferred (extracted from task patterns)
 *      - Confidence-scored; inferred facts decay over 90 days without reinforcement
 *
 *   2. Free-form facts (UserMemoryFact) — ad-hoc observations from task completions
 *      - "User frequently asks for Hindi translations → prefers bilingual output"
 *      - "User's tasks are always B2B SaaS focused"
 *
 * Memory is injected into EVERY task prompt, giving Arivarangam persistent context.
 */
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@arivarangam/db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Memory categories and their structured keys ──────────────────────────────

export const MEMORY_CATEGORIES = {
  business:    ['business_name', 'business_type', 'industry', 'company_size', 'target_market'],
  audience:    ['primary_audience', 'audience_demographics', 'audience_pain_points'],
  preferences: ['writing_tone', 'output_format', 'preferred_language', 'content_length'],
  technical:   ['tech_stack', 'coding_language', 'framework', 'deployment_platform'],
  personal:    ['name', 'role', 'location', 'timezone'],
  brand:       ['brand_voice', 'brand_values', 'competitors', 'usp'],
} as const

export type MemoryCategory = keyof typeof MEMORY_CATEGORIES

// ─── Core memory operations ───────────────────────────────────────────────────

export async function setMemory(
  userId:   string,
  key:      string,
  value:    string,
  source:   'user_set' | 'inferred' | 'onboarding' = 'user_set',
  category: string = 'preferences',
): Promise<void> {
  await prisma.userMemory.upsert({
    where:  { userId_key: { userId, key } },
    update: { value, source, confidence: source === 'user_set' ? 1.0 : 0.75, isActive: true, updatedAt: new Date() },
    create: { userId, key, value, source, category, confidence: source === 'user_set' ? 1.0 : 0.75 },
  })
}

export async function deleteMemory(userId: string, key: string): Promise<void> {
  await prisma.userMemory.updateMany({
    where: { userId, key },
    data:  { isActive: false },
  })
}

export async function getMemoryMap(userId: string): Promise<Record<string, string>> {
  const memories = await prisma.userMemory.findMany({
    where:   { userId, isActive: true },
    orderBy: { usageCount: 'desc' },
  })
  return Object.fromEntries(memories.map((m) => [m.key, m.value]))
}

/**
 * Build the memory context string injected into every AI prompt.
 * Concise — max ~300 tokens. Tracks usage count for each memory key used.
 */
export async function getMemoryContext(userId: string): Promise<string> {
  const memories = await prisma.userMemory.findMany({
    where:   { userId, isActive: true, confidence: { gte: 0.4 } },
    orderBy: [{ source: 'asc' }, { usageCount: 'desc' }], // user_set first
    take:    20,
  })

  if (memories.length === 0) return ''

  // Group by category for readable formatting
  const grouped: Record<string, string[]> = {}
  for (const m of memories) {
    if (!grouped[m.category]) grouped[m.category] = []
    grouped[m.category].push(`${m.key.replace(/_/g, ' ')}: ${m.value}`)
  }

  const lines: string[] = ['[User Context — apply to all outputs]']
  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`${cat.charAt(0).toUpperCase() + cat.slice(1)}: ${items.join(' | ')}`)
  }

  // Increment usage counters non-blocking
  const ids = memories.map((m) => m.id)
  prisma.userMemory.updateMany({
    where: { id: { in: ids } },
    data:  { usageCount: { increment: 1 } },
  }).catch(() => {})

  return lines.join('\n')
}

/**
 * After a task completes, infer new memory facts from patterns.
 * Runs as a background job — never blocks the main flow.
 */
export async function inferMemoryFromTask(userId: string, taskId: string): Promise<void> {
  try {
    const task = await prisma.task.findUnique({
      where:  { id: taskId },
      select: {
        originalGoal: true,
        subtasks: {
          select: { category: true, output: { select: { content: true } } },
          where:  { status: 'COMPLETED' },
          take:   3,
        },
      },
    })
    if (!task) return

    // Only infer if we have enough task history
    const taskCount = await prisma.task.count({ where: { userId, status: 'COMPLETED' } })
    if (taskCount < 3) return // need at least 3 tasks before inferring

    // Get recent task goals to find patterns
    const recentGoals = await prisma.task.findMany({
      where:   { userId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take:    10,
      select:  { originalGoal: true },
    })

    const existingMemory = await getMemoryContext(userId)

    const systemPrompt = `You are analysing a user's task history to extract useful persistent facts about them and their business. These facts will improve future AI outputs.

Return ONLY valid JSON:
{
  "inferences": [
    {
      "key": "snake_case_key",
      "value": "concise value",
      "category": "business|audience|preferences|technical|personal|brand",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation"
    }
  ]
}

Rules:
- Only infer high-confidence (>= 0.6) facts
- Return empty array if nothing new and useful can be inferred
- Never repeat what's already in existing memory
- Facts must be reusable across future tasks (not one-off observations)`

    const userPrompt = `Current task goal: "${task.originalGoal}"

Recent task history (last 10 goals):
${recentGoals.map((t, i) => `${i + 1}. "${t.originalGoal}"`).join('\n')}

${existingMemory ? `Already known:\n${existingMemory}` : ''}

What new, reusable facts can you infer about this user/business?`

    const response = await anthropic.messages.create({
      model:      'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed.inferences)) return

    for (const inf of parsed.inferences) {
      if (inf.confidence >= 0.6 && inf.key && inf.value) {
        // Don't overwrite user-set memories
        const existing = await prisma.userMemory.findUnique({
          where: { userId_key: { userId, key: inf.key } },
        })
        if (existing?.source === 'user_set') continue

        await setMemory(userId, inf.key, inf.value, 'inferred', inf.category)

        // Save as fact too
        await prisma.userMemoryFact.create({
          data: {
            userId,
            fact:        `${inf.key}: ${inf.value}`,
            category:    inf.category,
            confidence:  inf.confidence,
            sourceTaskId: taskId,
          },
        })
      }
    }
  } catch (err) {
    console.error('[MemoryManager] Inference failed:', err)
  }
}

/**
 * Decay confidence of inferred memories older than 90 days without usage.
 * Run weekly by cron worker.
 */
export async function decayStaleMemories(): Promise<void> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  // Find inferred memories not used in 90 days
  await prisma.userMemory.updateMany({
    where: {
      source:    'inferred',
      updatedAt: { lt: ninetyDaysAgo },
      confidence: { gte: 0.2 },
    },
    data: { confidence: { decrement: 0.15 } },
  })

  // Deactivate memories with very low confidence
  await prisma.userMemory.updateMany({
    where:  { confidence: { lt: 0.2 }, source: 'inferred' },
    data:   { isActive: false },
  })
}

/**
 * Onboarding: bulk-set memories from the 5-question onboarding flow.
 */
export async function saveOnboardingMemory(
  userId: string,
  answers: Record<string, string>,
): Promise<void> {
  const ONBOARDING_KEY_MAP: Record<string, { key: string; category: string }> = {
    business_name:   { key: 'business_name',   category: 'business' },
    business_type:   { key: 'business_type',   category: 'business' },
    primary_audience:{ key: 'primary_audience', category: 'audience' },
    writing_tone:    { key: 'writing_tone',     category: 'preferences' },
    main_use_case:   { key: 'main_use_case',    category: 'preferences' },
  }

  for (const [field, value] of Object.entries(answers)) {
    if (!value?.trim()) continue
    const mapping = ONBOARDING_KEY_MAP[field]
    if (mapping) {
      await setMemory(userId, mapping.key, value.trim(), 'onboarding', mapping.category)
    }
  }
}
