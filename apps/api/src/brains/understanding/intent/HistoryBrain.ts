/**
 * HistoryBrain — Queries DB for this user's similar past tasks.
 * Zero external API calls — pure PostgreSQL queries.
 *
 * Used to: surface similar solutions, avoid rebuilding the same thing,
 * inform the architecture brain about what this user has used before.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'
import type { TaskCategory } from './IntentBrain'

export interface HistoryBrainInput {
  userId: string
  primaryCategory: TaskCategory
  subject: string
}

export interface HistoryBrainOutput {
  similarTaskCount: number
  recentTasks: RecentTask[]
  frequentCategories: TaskCategory[]
  preferredComplexity: 'simple' | 'standard' | 'complex'
  hasBuiltSimilar: boolean
  totalTasksCompleted: number
}

export interface RecentTask {
  id: string
  goal: string
  category: string
  completedAt: Date | null
  hadCode: boolean
}

export class HistoryBrain extends Brain<HistoryBrainInput, HistoryBrainOutput> {
  readonly brainName = 'HistoryBrain'
  readonly orchestratorName = 'IntentOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: HistoryBrainInput, _context: BrainContext): Promise<HistoryBrainOutput> {
    const { userId, primaryCategory, subject } = input

    // Get user's recent completed tasks
    const recentRaw = await prisma.task.findMany({
      where: { userId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        originalGoal: true,
        createdAt: true,
        subtasks: {
          where: { role: 'SYNTHESIS' },
          select: { id: true },
          take: 1,
        },
      },
    })

    const totalTasksCompleted = await prisma.task.count({
      where: { userId, status: 'COMPLETED' },
    })

    // Simple similarity: does the past task goal contain any words from current subject?
    const subjectWords = subject.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const recentTasks: RecentTask[] = recentRaw.map(t => ({
      id: t.id,
      goal: t.originalGoal.slice(0, 100),
      category: primaryCategory,
      completedAt: t.createdAt,
      hadCode: false,
    }))

    const similarTaskCount = recentRaw.filter(t => {
      const goalLower = t.originalGoal.toLowerCase()
      return subjectWords.some(w => goalLower.includes(w))
    }).length

    const hasBuiltSimilar = similarTaskCount > 0

    // Infer preferred complexity from task count
    let preferredComplexity: 'simple' | 'standard' | 'complex' = 'standard'
    if (totalTasksCompleted > 20) preferredComplexity = 'complex'
    else if (totalTasksCompleted < 3) preferredComplexity = 'simple'

    return {
      similarTaskCount,
      recentTasks: recentTasks.slice(0, 5),
      frequentCategories: [primaryCategory],
      preferredComplexity,
      hasBuiltSimilar,
      totalTasksCompleted,
    }
  }

  protected fallback(input: HistoryBrainInput): HistoryBrainOutput {
    return {
      similarTaskCount: 0,
      recentTasks: [],
      frequentCategories: [input.primaryCategory],
      preferredComplexity: 'standard',
      hasBuiltSimilar: false,
      totalTasksCompleted: 0,
    }
  }
}
