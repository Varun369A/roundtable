/**
 * EmpathyBrain — Determines what emotional response Arivarangam should show.
 * Pure logic — combines sentiment + frustration + urgency signals.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { Sentiment } from './SentimentBrain'
import type { UrgencyLevel } from './UrgencyBrain'

export interface EmpathyBrainInput {
  sentiment: Sentiment
  urgency: UrgencyLevel
  isFrustrated: boolean
  frustrationLevel: 'none' | 'mild' | 'high'
}

export interface EmpathyBrainOutput {
  responsePrefix: string    // what to say before the output
  showEncouragement: boolean
  showAcknowledgement: boolean
  prioritiseSpeed: boolean
}

export class EmpathyBrain extends Brain<EmpathyBrainInput, EmpathyBrainOutput> {
  readonly brainName = 'EmpathyBrain'
  readonly orchestratorName = 'EmotionOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: EmpathyBrainInput, _ctx: BrainContext): Promise<EmpathyBrainOutput> {
    const { sentiment, urgency, isFrustrated, frustrationLevel } = input

    let responsePrefix = ''
    let showEncouragement = false
    let showAcknowledgement = false
    let prioritiseSpeed = false

    if (frustrationLevel === 'high') {
      responsePrefix = "I understand this has been challenging. Let me handle this carefully."
      showAcknowledgement = true
    } else if (frustrationLevel === 'mild') {
      responsePrefix = "Got it — let me get this right for you."
      showAcknowledgement = true
    } else if (sentiment === 'excited') {
      responsePrefix = "Great idea — let's build this!"
      showEncouragement = true
    } else if (sentiment === 'confused') {
      responsePrefix = "Let me break this down clearly."
      showEncouragement = true
    }

    if (urgency === 'critical' || urgency === 'high') {
      prioritiseSpeed = true
    }

    return { responsePrefix, showEncouragement, showAcknowledgement, prioritiseSpeed }
  }

  protected fallback(_: EmpathyBrainInput): EmpathyBrainOutput {
    return { responsePrefix: '', showEncouragement: false, showAcknowledgement: false, prioritiseSpeed: false }
  }
}
