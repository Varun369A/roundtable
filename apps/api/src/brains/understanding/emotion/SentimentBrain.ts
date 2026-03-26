/**
 * SentimentBrain — Detects user's emotional tone.
 * Pure logic — zero API. Word-list based sentiment analysis.
 */

import { Brain, BrainContext } from '../../base/Brain'

export type Sentiment = 'positive' | 'neutral' | 'frustrated' | 'confused' | 'excited'

export interface SentimentBrainInput { goal: string }
export interface SentimentBrainOutput {
  sentiment: Sentiment
  score: number   // -100 (very negative) to +100 (very positive)
  signals: string[]
}

const POSITIVE = ['great', 'love', 'awesome', 'excellent', 'perfect', 'amazing', 'fantastic', 'best', 'wonderful', 'brilliant', 'happy', 'excited', 'please', 'thank', 'good', 'nice']
const NEGATIVE = ['hate', 'terrible', 'horrible', 'awful', 'bad', 'worst', 'broken', 'failed', 'wrong', 'error', 'not working', 'useless', 'stupid', 'frustrated', 'disappointed', 'annoying']
const CONFUSED = ['confused', 'unsure', 'not sure', 'don\'t know', 'unclear', 'help me understand', 'what is', 'how do', 'why is', 'explain', 'not clear']
const EXCITED = ['!', 'can\'t wait', 'so excited', 'amazing idea', 'love this', 'finally', 'exactly what']

export class SentimentBrain extends Brain<SentimentBrainInput, SentimentBrainOutput> {
  readonly brainName = 'SentimentBrain'
  readonly orchestratorName = 'EmotionOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: SentimentBrainInput, _ctx: BrainContext): Promise<SentimentBrainOutput> {
    const lower = input.goal.toLowerCase()
    const signals: string[] = []

    const posScore = POSITIVE.filter(w => { const found = lower.includes(w); if (found) signals.push(`+${w}`); return found }).length
    const negScore = NEGATIVE.filter(w => { const found = lower.includes(w); if (found) signals.push(`-${w}`); return found }).length
    const confScore = CONFUSED.filter(w => lower.includes(w)).length
    const excScore = EXCITED.filter(w => lower.includes(w)).length
    const excPoints = (input.goal.match(/!/g) || []).length

    const score = (posScore * 15) - (negScore * 20) + (excScore * 10) + (excPoints * 5)
    const clampedScore = Math.max(-100, Math.min(100, score))

    let sentiment: Sentiment = 'neutral'
    if (confScore >= 2) sentiment = 'confused'
    else if (negScore >= 2) sentiment = 'frustrated'
    else if (excScore >= 1 || excPoints >= 2) sentiment = 'excited'
    else if (posScore >= 2) sentiment = 'positive'

    return { sentiment, score: clampedScore, signals }
  }

  protected fallback(_: SentimentBrainInput): SentimentBrainOutput {
    return { sentiment: 'neutral', score: 0, signals: [] }
  }
}
