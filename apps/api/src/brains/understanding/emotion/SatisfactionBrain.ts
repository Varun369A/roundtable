/**
 * SatisfactionBrain — Was the last output good? Checks DB feedback.
 * Zero external API — pure DB read.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface SatisfactionBrainInput { userId: string }
export interface SatisfactionBrainOutput {
  lastTaskSatisfaction: 'unknown' | 'good' | 'poor'
  averageQualityScore: number
  hasGivenFeedback: boolean
  totalCorrections: number
}

export class SatisfactionBrain extends Brain<SatisfactionBrainInput, SatisfactionBrainOutput> {
  readonly brainName = 'SatisfactionBrain'
  readonly orchestratorName = 'EmotionOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: SatisfactionBrainInput, _ctx: BrainContext): Promise<SatisfactionBrainOutput> {
    const [recentKnowledge, correctionCount] = await Promise.all([
      prisma.codeKnowledge.findFirst({
        where: { userId: input.userId },
        orderBy: { createdAt: 'desc' },
        select: { qualityScore: true },
      }),
      prisma.taskCorrection.count({
        where: { task: { userId: input.userId } },
      }),
    ])

    const lastScore = recentKnowledge ? recentKnowledge.qualityScore / 100 : null
    const lastTaskSatisfaction = lastScore === null ? 'unknown' : lastScore >= 0.7 ? 'good' : 'poor'
    const averageQualityScore = lastScore ?? 0.75

    return {
      lastTaskSatisfaction,
      averageQualityScore,
      hasGivenFeedback: correctionCount > 0,
      totalCorrections: correctionCount,
    }
  }

  protected fallback(_: SatisfactionBrainInput): SatisfactionBrainOutput {
    return { lastTaskSatisfaction: 'unknown', averageQualityScore: 0.75, hasGivenFeedback: false, totalCorrections: 0 }
  }
}
