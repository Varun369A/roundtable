/**
 * AdaptationBrain — How should system behavior adapt based on user patterns?
 * Zero API — rule engine over other memory outputs.
 */

import { Brain, BrainContext } from '../../base/Brain'

export interface AdaptationBrainInput {
  trustLevel: 'new' | 'regular' | 'power'
  expertiseLevel: 'beginner' | 'intermediate' | 'expert'
  totalCorrections: number
  buildsSimilarThings: boolean
  inferredStack: string[]
}

export interface AdaptationBrainOutput {
  skipBasicExplanations: boolean
  useUserPreferredStack: boolean
  stackOverride: string[]
  verbosityLevel: 'low' | 'medium' | 'high'
  autoInferMissingDetails: boolean
}

export class AdaptationBrain extends Brain<AdaptationBrainInput, AdaptationBrainOutput> {
  readonly brainName = 'AdaptationBrain'
  readonly orchestratorName = 'MemoryOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: AdaptationBrainInput, _ctx: BrainContext): Promise<AdaptationBrainOutput> {
    const { trustLevel, expertiseLevel, totalCorrections, buildsSimilarThings, inferredStack } = input

    const skipBasicExplanations = expertiseLevel === 'expert' || trustLevel === 'power'
    const useUserPreferredStack = buildsSimilarThings && inferredStack.length > 0
    const autoInferMissingDetails = trustLevel !== 'new'

    let verbosityLevel: 'low' | 'medium' | 'high' = 'medium'
    if (expertiseLevel === 'expert' && totalCorrections < 3) verbosityLevel = 'low'
    else if (expertiseLevel === 'beginner') verbosityLevel = 'high'

    return {
      skipBasicExplanations,
      useUserPreferredStack,
      stackOverride: useUserPreferredStack ? inferredStack : [],
      verbosityLevel,
      autoInferMissingDetails,
    }
  }

  protected fallback(_: AdaptationBrainInput): AdaptationBrainOutput {
    return { skipBasicExplanations: false, useUserPreferredStack: false, stackOverride: [], verbosityLevel: 'medium', autoInferMissingDetails: false }
  }
}
