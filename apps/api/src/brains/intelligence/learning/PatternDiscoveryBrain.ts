/**
 * PatternDiscoveryBrain — Discovers recurring patterns across multiple tasks.
 * Zero API — DB aggregate queries + frequency analysis.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface PatternDiscoveryBrainInput {
  userId: string
  currentTechStack: string[]
  currentPattern: string
  windowDays: number
}

export interface DiscoveredPattern {
  pattern: string
  frequency: number
  associatedTech: string[]
  averageScore: number
  recommendation: string
}

export interface PatternDiscoveryBrainOutput {
  topPatterns: DiscoveredPattern[]
  userFavoriteStack: string[]
  dominantPattern: string | null
  insights: string[]
}

export class PatternDiscoveryBrain extends Brain<PatternDiscoveryBrainInput, PatternDiscoveryBrainOutput> {
  readonly brainName = 'PatternDiscoveryBrain'
  readonly orchestratorName = 'LearningOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: PatternDiscoveryBrainInput, _ctx: BrainContext): Promise<PatternDiscoveryBrainOutput> {
    const { userId, windowDays } = input
    const since = new Date(Date.now() - windowDays * 86400000)

    try {
      const recentTasks = await prisma.task.findMany({
        where: {
          userId,
          createdAt: { gte: since },
          status: 'COMPLETED',
        },
        select: {
          contextObject: true,
          qualityScore: true,
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      })

      // Extract tech stacks and patterns from contextObject
      const patternFreq = new Map<string, { count: number; scores: number[]; tech: string[] }>()

      for (const task of recentTasks) {
        const meta = task.contextObject as Record<string, unknown> | null
        if (!meta) continue

        const pattern = (meta.architecturePattern as string) ?? 'unknown'
        const techStack = (meta.techStack as string[]) ?? []
        const score = task.qualityScore ?? 70

        if (!patternFreq.has(pattern)) {
          patternFreq.set(pattern, { count: 0, scores: [], tech: [] })
        }
        const entry = patternFreq.get(pattern)!
        entry.count++
        entry.scores.push(score)
        entry.tech.push(...techStack)
      }

      const topPatterns: DiscoveredPattern[] = [...patternFreq.entries()]
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 5)
        .map(([pattern, data]) => ({
          pattern,
          frequency: data.count,
          associatedTech: [...new Set(data.tech)].slice(0, 5),
          averageScore: data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0,
          recommendation: this.getPatternRecommendation(pattern, data.scores),
        }))

      const allTech = recentTasks.flatMap(t => {
        const meta = t.metadata as Record<string, unknown> | null
        return (meta?.techStack as string[]) ?? []
      })
      const techFreq = new Map<string, number>()
      for (const t of allTech) techFreq.set(t, (techFreq.get(t) ?? 0) + 1)
      const userFavoriteStack = [...techFreq.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([t]) => t)

      const dominantPattern = topPatterns[0]?.pattern ?? null
      const insights = this.generateInsights(topPatterns, recentTasks.length)

      return { topPatterns, userFavoriteStack, dominantPattern, insights }
    } catch {
      return { topPatterns: [], userFavoriteStack: [], dominantPattern: null, insights: [] }
    }
  }

  private getPatternRecommendation(pattern: string, scores: number[]): string {
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    if (avg >= 80) return `${pattern} works well for you — keep using it`
    if (avg >= 60) return `${pattern} is solid but could be improved`
    return `Consider alternatives to ${pattern} — quality scores are below average`
  }

  private generateInsights(patterns: DiscoveredPattern[], taskCount: number): string[] {
    const insights: string[] = []
    if (taskCount >= 5) insights.push(`You've completed ${taskCount} projects — good momentum`)
    if (patterns[0]?.averageScore >= 80) insights.push(`Your ${patterns[0].pattern} projects score consistently high`)
    if (patterns.length >= 3) insights.push(`You work across ${patterns.length} different architecture patterns`)
    return insights
  }

  protected fallback(_: PatternDiscoveryBrainInput): PatternDiscoveryBrainOutput {
    return { topPatterns: [], userFavoriteStack: [], dominantPattern: null, insights: [] }
  }
}
