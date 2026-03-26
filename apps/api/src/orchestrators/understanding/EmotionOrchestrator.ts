/**
 * EmotionOrchestrator — Runs 9 Emotion brains: Sentiment → Urgency → Frustration → Tone
 *                       → Empathy → Satisfaction → Engagement → Expectation → Communication
 */

import { Orchestrator } from '../base/Orchestrator'
import type { OrchestratorInput } from '../base/Orchestrator'
import type { Brain } from '../../brains/base/Brain'
import {
  SentimentBrain,
  UrgencyBrain,
  FrustrationBrain,
  ToneBrain,
  EmpathyBrain,
  SatisfactionBrain,
  EngagementBrain,
  ExpectationBrain,
  CommunicationBrain,
} from '../../brains/understanding/emotion'

export class EmotionOrchestrator extends Orchestrator {
  readonly orchestratorName = 'EmotionOrchestrator'
  readonly engineName = 'UnderstandingEngine'

  protected getBrains(): Array<Brain<unknown, unknown>> {
    return [
      new SentimentBrain(),
      new UrgencyBrain(),
      new FrustrationBrain(),
      new ToneBrain(),
      new EmpathyBrain(),
      new SatisfactionBrain(),
      new EngagementBrain(),
      new ExpectationBrain(),
      new CommunicationBrain(),
    ]
  }

  protected buildBrainInput(brainName: string, accumulated: Record<string, unknown>, input: OrchestratorInput): unknown {
    const base = { goal: input.goal, taskId: input.taskId, userId: input.userId }

    const sentiment = (accumulated['SentimentBrain'] as { sentiment?: string })?.sentiment ?? 'neutral'
    const urgency = (accumulated['UrgencyBrain'] as { level?: string })?.level ?? 'normal'
    const frustration = (accumulated['FrustrationBrain'] as { isFrustrated?: boolean })?.isFrustrated ?? false
    const tone = (accumulated['ToneBrain'] as { tone?: string })?.tone ?? 'casual'
    const satisfaction = (accumulated['SatisfactionBrain'] as { satisfactionScore?: number })?.satisfactionScore ?? 70

    switch (brainName) {
      case 'SentimentBrain':
        return { text: input.goal }

      case 'UrgencyBrain':
        return { text: input.goal }

      case 'FrustrationBrain':
        return { text: input.goal, userId: input.userId, taskId: input.taskId, sentiment }

      case 'ToneBrain':
        return { text: input.goal }

      case 'EmpathyBrain':
        return { sentiment, isFrustrated: frustration, urgencyLevel: urgency, tone }

      case 'SatisfactionBrain':
        return { userId: input.userId }

      case 'EngagementBrain':
        return { userId: input.userId }

      case 'ExpectationBrain':
        return { userId: input.userId, persona: (input.previousEngineOutputs?.['IntentOrchestrator'] as Record<string, unknown>)?.['PersonaBrain'] ?? 'intermediate' }

      case 'CommunicationBrain':
        return {
          tone,
          sentiment,
          frustration,
          urgencyLevel: urgency,
          satisfactionScore: satisfaction,
          persona: (input.previousEngineOutputs?.['IntentOrchestrator'] as Record<string, unknown> | undefined)?.['PersonaBrain'],
        }

      default:
        return { ...base, ...accumulated }
    }
  }
}
