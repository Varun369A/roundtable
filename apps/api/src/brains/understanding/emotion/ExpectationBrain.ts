/**
 * ExpectationBrain — What quality level does this user expect?
 * Zero API — inferred from task complexity + user tier.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'
import type { Complexity } from '../intent/IntentBrain'

export interface ExpectationBrainInput { userId: string; complexity: Complexity }
export interface ExpectationBrainOutput {
  qualityExpectation: 'draft' | 'good' | 'production'
  wantsExplanations: boolean
  wantsDocumentation: boolean
  minimumFileCount: number
}

export class ExpectationBrain extends Brain<ExpectationBrainInput, ExpectationBrainOutput> {
  readonly brainName = 'ExpectationBrain'
  readonly orchestratorName = 'EmotionOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: ExpectationBrainInput, _ctx: BrainContext): Promise<ExpectationBrainOutput> {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { tier: true } })
    const tier = user?.tier || 'FREE'

    let qualityExpectation: 'draft' | 'good' | 'production' = 'good'
    if (tier === 'ENTERPRISE' || input.complexity === 'complex') qualityExpectation = 'production'
    else if (tier === 'FREE' && input.complexity === 'simple') qualityExpectation = 'draft'

    const minimumFileCount = input.complexity === 'simple' ? 3 : input.complexity === 'complex' ? 10 : 6

    return {
      qualityExpectation,
      wantsExplanations: tier === 'FREE',
      wantsDocumentation: input.complexity !== 'simple',
      minimumFileCount,
    }
  }

  protected fallback(input: ExpectationBrainInput): ExpectationBrainOutput {
    return { qualityExpectation: 'good', wantsExplanations: false, wantsDocumentation: true, minimumFileCount: 5 }
  }
}
