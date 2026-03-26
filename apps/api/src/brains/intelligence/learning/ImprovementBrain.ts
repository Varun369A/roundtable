/**
 * ImprovementBrain — Generates improvement suggestions based on quality trends.
 * Zero API — trend analysis from DB + rule engine.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface ImprovementBrainInput {
  userId: string
  currentScore: number
  currentGrade: string
  topPatterns: Array<{ pattern: string; averageScore: number; frequency: number }>
  systemicIssues: string[]
}

export interface ImprovementSuggestion {
  area: string
  suggestion: string
  impact: 'high' | 'medium' | 'low'
  basedOn: string
}

export interface ImprovementBrainOutput {
  suggestions: ImprovementSuggestion[]
  scoreTrajectory: 'improving' | 'stable' | 'declining'
  averageScoreLast5: number
}

export class ImprovementBrain extends Brain<ImprovementBrainInput, ImprovementBrainOutput> {
  readonly brainName = 'ImprovementBrain'
  readonly orchestratorName = 'LearningOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: ImprovementBrainInput, _ctx: BrainContext): Promise<ImprovementBrainOutput> {
    const { userId, currentScore, topPatterns, systemicIssues } = input
    const suggestions: ImprovementSuggestion[] = []

    // Get last 5 quality scores
    let last5Scores: number[] = []
    try {
      const recent = await prisma.task.findMany({
        where: { userId, status: 'COMPLETED' },
        select: { qualityScore: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
      last5Scores = recent.map(t => t.qualityScore ?? 70)
    } catch {
      last5Scores = [currentScore]
    }

    const averageScoreLast5 = last5Scores.length > 0
      ? Math.round(last5Scores.reduce((a, b) => a + b, 0) / last5Scores.length)
      : currentScore

    // Trajectory
    let scoreTrajectory: ImprovementBrainOutput['scoreTrajectory'] = 'stable'
    if (last5Scores.length >= 3) {
      const recent = last5Scores.slice(0, 3)
      const older = last5Scores.slice(-2)
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
      if (recentAvg > olderAvg + 5) scoreTrajectory = 'improving'
      else if (recentAvg < olderAvg - 5) scoreTrajectory = 'declining'
    }

    // Suggestions from systemic issues
    for (const issue of systemicIssues.slice(0, 2)) {
      suggestions.push({
        area: 'Error Handling',
        suggestion: issue,
        impact: 'high',
        basedOn: 'Repeated error patterns across files',
      })
    }

    // Suggestions from low-scoring patterns
    for (const p of topPatterns.filter(p => p.averageScore < 70)) {
      suggestions.push({
        area: 'Architecture',
        suggestion: `Consider alternatives to ${p.pattern} — your projects using it average ${p.averageScore}/100`,
        impact: 'medium',
        basedOn: `${p.frequency} past projects`,
      })
    }

    // Score-based suggestions
    if (currentScore < 60) {
      suggestions.push({ area: 'Requirements', suggestion: 'Try providing more specific requirements — vague goals produce lower quality output', impact: 'high', basedOn: 'Current score below 60' })
    }
    if (currentScore >= 80) {
      suggestions.push({ area: 'Complexity', suggestion: 'Your high scores suggest you can tackle more complex projects', impact: 'low', basedOn: 'Consistent high performance' })
    }

    return { suggestions: suggestions.slice(0, 5), scoreTrajectory, averageScoreLast5 }
  }

  protected fallback(input: ImprovementBrainInput): ImprovementBrainOutput {
    return {
      suggestions: [],
      scoreTrajectory: 'stable',
      averageScoreLast5: input.currentScore,
    }
  }
}
