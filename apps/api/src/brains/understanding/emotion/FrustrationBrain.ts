/**
 * FrustrationBrain — Detects if user is hitting a repeated failure or blocked.
 * Uses DB to check recent failed tasks. Zero external API.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface FrustrationBrainInput { userId: string; goal: string }
export interface FrustrationBrainOutput {
  isFrustrated: boolean
  frustrationLevel: 'none' | 'mild' | 'high'
  recentFailures: number
  suggestEmpathy: boolean
  reason: string
}

const FRUSTRATION_WORDS = ['still not', 'again', 'still broken', 'tried everything', 'nothing works', "doesn't work", 'failed', 'not working', 'wrong', 'broken', 'issue', 'problem', 'keep getting']

export class FrustrationBrain extends Brain<FrustrationBrainInput, FrustrationBrainOutput> {
  readonly brainName = 'FrustrationBrain'
  readonly orchestratorName = 'EmotionOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: FrustrationBrainInput, _ctx: BrainContext): Promise<FrustrationBrainOutput> {
    const lower = input.goal.toLowerCase()
    const textFrustration = FRUSTRATION_WORDS.filter(w => lower.includes(w)).length

    // Check recent failures in DB
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentFailures = await prisma.task.count({
      where: { userId: input.userId, status: 'FAILED', createdAt: { gte: oneDayAgo } },
    })

    const frustrationScore = textFrustration * 20 + recentFailures * 15
    let frustrationLevel: 'none' | 'mild' | 'high' = 'none'
    if (frustrationScore >= 40) frustrationLevel = 'high'
    else if (frustrationScore >= 20) frustrationLevel = 'mild'

    return {
      isFrustrated: frustrationLevel !== 'none',
      frustrationLevel,
      recentFailures,
      suggestEmpathy: frustrationLevel === 'high',
      reason: recentFailures > 2 ? `${recentFailures} failed tasks in last 24h` : textFrustration > 0 ? 'Frustration detected in message' : '',
    }
  }

  protected fallback(_: FrustrationBrainInput): FrustrationBrainOutput {
    return { isFrustrated: false, frustrationLevel: 'none', recentFailures: 0, suggestEmpathy: false, reason: '' }
  }
}
