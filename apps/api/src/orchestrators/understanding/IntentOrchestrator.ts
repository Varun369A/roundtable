/**
 * IntentOrchestrator — Runs 9 Intent brains: Language → Intent → Ambiguity → Context
 *                      → Goal → Constraint → History → Persona → Clarification
 */

import { Orchestrator } from '../base/Orchestrator'
import type { OrchestratorInput } from '../base/Orchestrator'
import type { Brain } from '../../brains/base/Brain'
import {
  LanguageBrain,
  IntentBrain,
  AmbiguityBrain,
  ContextBrain,
  GoalBrain,
  ConstraintBrain,
  HistoryBrain,
  PersonaBrain,
  ClarificationBrain,
} from '../../brains/understanding/intent'
import type { OrchestratorResult } from '../../engines/Engine'

export class IntentOrchestrator extends Orchestrator {
  readonly orchestratorName = 'IntentOrchestrator'
  readonly engineName = 'UnderstandingEngine'

  protected getBrains(): Array<Brain<unknown, unknown>> {
    return [
      new LanguageBrain(),
      new IntentBrain(),
      new AmbiguityBrain(),
      new ContextBrain(),
      new GoalBrain(),
      new ConstraintBrain(),
      new HistoryBrain(),
      new PersonaBrain(),
      new ClarificationBrain(),
    ]
  }

  protected buildBrainInput(brainName: string, accumulated: Record<string, unknown>, input: OrchestratorInput): unknown {
    const base = { goal: input.goal, taskId: input.taskId, userId: input.userId }

    switch (brainName) {
      case 'LanguageBrain':
        return { goal: input.goal }

      case 'IntentBrain':
        return { goal: input.goal, detectedLanguage: (accumulated['LanguageBrain'] as { language?: string })?.language ?? 'en' }

      case 'AmbiguityBrain': {
        const intent = accumulated['IntentBrain'] as Record<string, unknown> | undefined
        return { goal: input.goal, categories: intent?.categories ?? [] }
      }

      case 'ContextBrain':
        return { goal: input.goal, userId: input.userId }

      case 'GoalBrain': {
        const intent = accumulated['IntentBrain'] as Record<string, unknown> | undefined
        return { goal: input.goal, primaryCategory: intent?.primaryCategory ?? 'general', deliverables: [] }
      }

      case 'ConstraintBrain':
        return { goal: input.goal }

      case 'HistoryBrain':
        return { userId: input.userId, currentGoal: input.goal }

      case 'PersonaBrain': {
        const history = accumulated['HistoryBrain'] as Record<string, unknown> | undefined
        return { userId: input.userId, taskCount: (history as { taskCount?: number })?.taskCount ?? 0, recentGoals: [] }
      }

      case 'ClarificationBrain': {
        const ambiguity = accumulated['AmbiguityBrain'] as Record<string, unknown> | undefined
        const intent = accumulated['IntentBrain'] as Record<string, unknown> | undefined
        return {
          goal: input.goal,
          clarityScore: (ambiguity as { clarityScore?: number })?.clarityScore ?? 80,
          needsClarification: (ambiguity as { needsClarification?: boolean })?.needsClarification ?? false,
          primaryCategory: (intent as { primaryCategory?: string })?.primaryCategory ?? 'general',
          missingInfo: (ambiguity as { missingInfo?: string[] })?.missingInfo ?? [],
        }
      }

      default:
        return { ...base, ...accumulated }
    }
  }
}
