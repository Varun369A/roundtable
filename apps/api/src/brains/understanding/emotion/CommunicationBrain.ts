/**
 * CommunicationBrain — Final synthesis: how should Arivarangam communicate?
 * Pure logic — aggregates all emotion brain outputs into one directive.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { Sentiment } from './SentimentBrain'
import type { UrgencyLevel } from './UrgencyBrain'
import type { ToneStyle } from './ToneBrain'

export interface CommunicationBrainInput {
  sentiment: Sentiment
  urgency: UrgencyLevel
  tone: ToneStyle
  responsePrefix: string
  prioritiseSpeed: boolean
  qualityExpectation: 'draft' | 'good' | 'production'
  needsExplanations: boolean
}

export interface CommunicationBrainOutput {
  /** Final directive for how to communicate */
  directive: CommunicationDirective
}

export interface CommunicationDirective {
  openingMessage: string
  explanationDepth: 'none' | 'brief' | 'detailed'
  codeCommentDensity: 'minimal' | 'normal' | 'heavy'
  includeExamples: boolean
  outputFormat: 'concise' | 'structured' | 'comprehensive'
  prioritiseSpeed: boolean
}

export class CommunicationBrain extends Brain<CommunicationBrainInput, CommunicationDirective> {
  readonly brainName = 'CommunicationBrain'
  readonly orchestratorName = 'EmotionOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: CommunicationBrainInput, _ctx: BrainContext): Promise<CommunicationDirective> {
    const { sentiment, urgency, tone, responsePrefix, prioritiseSpeed, qualityExpectation, needsExplanations } = input

    const explanationDepth = needsExplanations ? 'detailed' : tone === 'technical' ? 'brief' : 'none'
    const codeCommentDensity = needsExplanations ? 'heavy' : qualityExpectation === 'production' ? 'normal' : 'minimal'
    const includeExamples = needsExplanations || sentiment === 'confused'

    let outputFormat: 'concise' | 'structured' | 'comprehensive' = 'structured'
    if (prioritiseSpeed) outputFormat = 'concise'
    else if (qualityExpectation === 'production') outputFormat = 'comprehensive'

    const openingMessage = responsePrefix ||
      (sentiment === 'excited' ? "Let's build this!" :
       tone === 'casual' ? "On it!" :
       "Processing your request.")

    return { openingMessage, explanationDepth, codeCommentDensity, includeExamples, outputFormat, prioritiseSpeed }
  }

  protected fallback(_: CommunicationBrainInput): CommunicationDirective {
    return { openingMessage: 'Processing.', explanationDepth: 'brief', codeCommentDensity: 'normal', includeExamples: false, outputFormat: 'structured', prioritiseSpeed: false }
  }
}
