/**
 * ToneBrain — Detects communication style: formal/casual/technical.
 * Pure logic — zero API.
 */

import { Brain, BrainContext } from '../../base/Brain'

export type ToneStyle = 'formal' | 'casual' | 'technical' | 'simple'

export interface ToneBrainInput { goal: string }
export interface ToneBrainOutput {
  tone: ToneStyle
  usesSlang: boolean
  usesTechnicalJargon: boolean
  responseStyle: 'concise' | 'detailed' | 'conversational'
}

const CASUAL_SIGNALS = ['hey', 'hi', 'yo', 'gonna', 'wanna', 'kinda', 'lol', 'btw', 'tbh', 'u ', 'ur ', 'plz', 'pls', 'thx', 'imo', 'fyi', 'ngl']
const FORMAL_SIGNALS = ['please', 'kindly', 'require', 'regarding', 'pursuant', 'henceforth', 'therefore', 'accordingly', 'furthermore', 'additionally']
const TECHNICAL_SIGNALS = ['api', 'endpoint', 'async', 'database', 'schema', 'repository', 'implementation', 'architecture', 'infrastructure', 'deployment', 'microservice']

export class ToneBrain extends Brain<ToneBrainInput, ToneBrainOutput> {
  readonly brainName = 'ToneBrain'
  readonly orchestratorName = 'EmotionOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: ToneBrainInput, _ctx: BrainContext): Promise<ToneBrainOutput> {
    const lower = input.goal.toLowerCase()

    const casualScore = CASUAL_SIGNALS.filter(w => lower.includes(w)).length
    const formalScore = FORMAL_SIGNALS.filter(w => lower.includes(w)).length
    const techScore = TECHNICAL_SIGNALS.filter(w => lower.includes(w)).length

    let tone: ToneStyle = 'simple'
    if (techScore >= 2) tone = 'technical'
    else if (formalScore >= 2) tone = 'formal'
    else if (casualScore >= 2) tone = 'casual'

    const responseStyle = techScore >= 2 ? 'detailed' : casualScore >= 2 ? 'conversational' : 'concise'

    return { tone, usesSlang: casualScore >= 2, usesTechnicalJargon: techScore >= 2, responseStyle }
  }

  protected fallback(_: ToneBrainInput): ToneBrainOutput {
    return { tone: 'simple', usesSlang: false, usesTechnicalJargon: false, responseStyle: 'concise' }
  }
}
