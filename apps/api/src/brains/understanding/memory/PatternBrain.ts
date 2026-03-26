/**
 * PatternBrain — Detects patterns in user's task history (what they build repeatedly).
 * Zero API — DB aggregation.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface PatternBrainInput { userId: string }
export interface PatternBrainOutput {
  frequentTopics: string[]
  repeatCount: number
  buildsSimilarThings: boolean
  inferredStack: string[]
}

export class PatternBrain extends Brain<PatternBrainInput, PatternBrainOutput> {
  readonly brainName = 'PatternBrain'
  readonly orchestratorName = 'MemoryOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: PatternBrainInput, _ctx: BrainContext): Promise<PatternBrainOutput> {
    const recentTasks = await prisma.task.findMany({
      where: { userId: input.userId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { originalGoal: true },
    })

    // Extract frequent words from goals
    const wordFrequency: Record<string, number> = {}
    const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'be', 'been', 'i', 'me', 'my', 'build', 'create', 'make'])

    for (const task of recentTasks) {
      const words = task.originalGoal.toLowerCase().split(/\s+/)
      for (const word of words) {
        const cleaned = word.replace(/[^a-z]/g, '')
        if (cleaned.length > 3 && !STOP_WORDS.has(cleaned)) {
          wordFrequency[cleaned] = (wordFrequency[cleaned] || 0) + 1
        }
      }
    }

    const frequentTopics = Object.entries(wordFrequency)
      .filter(([, count]) => count >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word)

    // Infer tech stack from frequent topics
    const TECH_WORDS = ['react', 'nextjs', 'node', 'python', 'typescript', 'postgres', 'mongodb', 'docker', 'fastapi', 'prisma']
    const inferredStack = frequentTopics.filter(t => TECH_WORDS.includes(t))

    return {
      frequentTopics,
      repeatCount: recentTasks.length,
      buildsSimilarThings: frequentTopics.length > 0,
      inferredStack,
    }
  }

  protected fallback(_: PatternBrainInput): PatternBrainOutput {
    return { frequentTopics: [], repeatCount: 0, buildsSimilarThings: false, inferredStack: [] }
  }
}
