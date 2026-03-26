/**
 * MemoryOrchestrator — Runs 9 Memory brains: ShortTerm → LongTerm → Preference → Profile
 *                      → Pattern → Relationship → Adaptation → FeedbackMemory → Personalization
 */

import { Orchestrator } from '../base/Orchestrator'
import type { OrchestratorInput } from '../base/Orchestrator'
import type { Brain } from '../../brains/base/Brain'
import {
  ShortTermBrain,
  LongTermBrain,
  PreferenceBrain,
  ProfileBrain,
  PatternBrain,
  RelationshipBrain,
  AdaptationBrain,
  FeedbackMemoryBrain,
  PersonalizationBrain,
} from '../../brains/understanding/memory'

export class MemoryOrchestrator extends Orchestrator {
  readonly orchestratorName = 'MemoryOrchestrator'
  readonly engineName = 'UnderstandingEngine'

  protected getBrains(): Array<Brain<unknown, unknown>> {
    return [
      new ShortTermBrain(),
      new LongTermBrain(),
      new PreferenceBrain(),
      new ProfileBrain(),
      new PatternBrain(),
      new RelationshipBrain(),
      new AdaptationBrain(),
      new FeedbackMemoryBrain(),
      new PersonalizationBrain(),
    ]
  }

  protected buildBrainInput(brainName: string, accumulated: Record<string, unknown>, input: OrchestratorInput): unknown {
    const intentOutput = input.previousEngineOutputs?.['IntentOrchestrator'] as Record<string, unknown> | undefined
    const persona = (intentOutput?.['PersonaBrain'] as { level?: string })?.level ?? 'intermediate'

    const shortTerm = accumulated['ShortTermBrain'] as Record<string, unknown> | undefined
    const longTerm = accumulated['LongTermBrain'] as Record<string, unknown> | undefined
    const preference = accumulated['PreferenceBrain'] as Record<string, unknown> | undefined
    const profile = accumulated['ProfileBrain'] as Record<string, unknown> | undefined
    const pattern = accumulated['PatternBrain'] as Record<string, unknown> | undefined
    const relationship = accumulated['RelationshipBrain'] as Record<string, unknown> | undefined

    switch (brainName) {
      case 'ShortTermBrain':
        return { taskId: input.taskId, userId: input.userId }

      case 'LongTermBrain':
        return { userId: input.userId }

      case 'PreferenceBrain':
        return { userId: input.userId }

      case 'ProfileBrain':
        return { userId: input.userId }

      case 'PatternBrain':
        return { userId: input.userId }

      case 'RelationshipBrain':
        return { userId: input.userId }

      case 'AdaptationBrain':
        return {
          userId: input.userId,
          persona,
          preferences: preference ?? {},
          longTermContext: longTerm,
          patternData: pattern,
        }

      case 'FeedbackMemoryBrain':
        return { userId: input.userId }

      case 'PersonalizationBrain':
        return {
          memoryContext: '',
          name: (profile as { name?: string })?.name ?? '',
          businessName: (profile as { businessName?: string })?.businessName ?? '',
          techStack: (preference as { techStack?: string[] })?.techStack ?? [],
          writingTone: (preference as { writingTone?: string })?.writingTone ?? 'professional',
          preferredLanguage: (preference as { preferredLanguage?: string })?.preferredLanguage ?? 'en',
          avoidPatterns: [],
          preferredApproaches: [],
          stackOverride: (pattern as { inferredStack?: string[] })?.inferredStack ?? [],
          verbosityLevel: 'medium' as const,
        }

      default:
        return { userId: input.userId, taskId: input.taskId, goal: input.goal, ...accumulated }
    }
  }
}
