/**
 * UrgencyBrain — Detects how urgently the user needs this.
 * Pure logic — zero API.
 */

import { Brain, BrainContext } from '../../base/Brain'

export type UrgencyLevel = 'low' | 'normal' | 'high' | 'critical'

export interface UrgencyBrainInput { goal: string }
export interface UrgencyBrainOutput {
  urgency: UrgencyLevel
  signals: string[]
  suggestFasterModel: boolean
}

const CRITICAL = ['immediately', 'right now', 'asap', 'urgent', 'emergency', 'deadline today', 'due today', 'launching today']
const HIGH = ['soon', 'quickly', 'fast', 'by tonight', 'this evening', 'need this today', 'deadline tomorrow', 'by end of day', 'eod']
const LOW = ['whenever', 'no rush', 'take your time', 'no hurry', 'at some point']

export class UrgencyBrain extends Brain<UrgencyBrainInput, UrgencyBrainOutput> {
  readonly brainName = 'UrgencyBrain'
  readonly orchestratorName = 'EmotionOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: UrgencyBrainInput, _ctx: BrainContext): Promise<UrgencyBrainOutput> {
    const lower = input.goal.toLowerCase()
    const signals: string[] = []

    const criticalFound = CRITICAL.filter(w => { const f = lower.includes(w); if (f) signals.push(w); return f })
    const highFound = HIGH.filter(w => { const f = lower.includes(w); if (f) signals.push(w); return f })
    const lowFound = LOW.filter(w => lower.includes(w))

    let urgency: UrgencyLevel = 'normal'
    if (criticalFound.length > 0) urgency = 'critical'
    else if (highFound.length > 0) urgency = 'high'
    else if (lowFound.length > 0) urgency = 'low'

    return { urgency, signals, suggestFasterModel: urgency === 'critical' || urgency === 'high' }
  }

  protected fallback(_: UrgencyBrainInput): UrgencyBrainOutput {
    return { urgency: 'normal', signals: [], suggestFasterModel: false }
  }
}
