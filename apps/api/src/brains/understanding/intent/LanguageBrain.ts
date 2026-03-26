/**
 * LanguageBrain — Detects the language of the user's goal.
 * Pure logic — zero API calls. Uses Unicode range detection.
 *
 * Supported: English, Tamil (ta), Hindi (hi), Telugu (te)
 */

import { Brain, BrainContext } from '../../base/Brain'

export type SupportedLanguage = 'en' | 'ta' | 'hi' | 'te'

export interface LanguageBrainInput {
  goal: string
}

export interface LanguageBrainOutput {
  language: SupportedLanguage
  confidence: number  // 0-100
  scriptDetected: string
}

// Unicode ranges for Indian scripts
const TAMIL_RANGE = /[\u0B80-\u0BFF]/
const HINDI_RANGE = /[\u0900-\u097F]/
const TELUGU_RANGE = /[\u0C00-\u0C7F]/

export class LanguageBrain extends Brain<LanguageBrainInput, LanguageBrainOutput> {
  readonly brainName = 'LanguageBrain'
  readonly orchestratorName = 'IntentOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: LanguageBrainInput, _context: BrainContext): Promise<LanguageBrainOutput> {
    const { goal } = input
    const totalChars = goal.length || 1

    const tamilChars = (goal.match(/[\u0B80-\u0BFF]/g) || []).length
    const hindiChars = (goal.match(/[\u0900-\u097F]/g) || []).length
    const teluguChars = (goal.match(/[\u0C00-\u0C7F]/g) || []).length

    const tamilRatio = tamilChars / totalChars
    const hindiRatio = hindiChars / totalChars
    const teluguRatio = teluguChars / totalChars

    // Threshold: >5% of chars in a script = that language
    if (tamilRatio > 0.05) {
      return { language: 'ta', confidence: Math.min(100, Math.round(tamilRatio * 200)), scriptDetected: 'Tamil' }
    }
    if (hindiRatio > 0.05) {
      return { language: 'hi', confidence: Math.min(100, Math.round(hindiRatio * 200)), scriptDetected: 'Devanagari (Hindi)' }
    }
    if (teluguRatio > 0.05) {
      return { language: 'te', confidence: Math.min(100, Math.round(teluguRatio * 200)), scriptDetected: 'Telugu' }
    }

    return { language: 'en', confidence: 95, scriptDetected: 'Latin (English)' }
  }

  protected fallback(_input: LanguageBrainInput): LanguageBrainOutput {
    return { language: 'en', confidence: 50, scriptDetected: 'Unknown' }
  }
}
