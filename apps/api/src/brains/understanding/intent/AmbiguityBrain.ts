/**
 * AmbiguityBrain — Scores how clear the user's request is (0-100).
 * Pure logic — zero API calls.
 *
 * Score < 70 → needs clarification before proceeding.
 * Identifies exactly which parts are unclear.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { TaskCategory } from './IntentBrain'

export interface AmbiguityBrainInput {
  goal: string
  categories: TaskCategory[]
}

export interface AmbiguityBrainOutput {
  clarityScore: number        // 0-100 (100 = perfectly clear)
  needsClarification: boolean // true if score < 70
  missingInfo: string[]       // what info is missing
  ambiguousTerms: string[]    // terms that need clarification
  specificityScore: number    // how specific is the request
  scopeScore: number          // is the scope clear
}

// Questions that MUST be answerable for different categories
const REQUIRED_SIGNALS: Record<TaskCategory, string[]> = {
  code: ['tech stack or language', 'specific functionality', 'database or storage needs'],
  research: ['specific topic or question', 'depth required'],
  content: ['topic', 'tone or style', 'target audience'],
  strategy: ['business context', 'goal or objective', 'timeframe'],
  data_analysis: ['data source', 'what to analyze', 'output format'],
  image: ['subject or scene', 'style or mood'],
  voice: ['text to convert', 'voice style or language'],
  translation: ['source text or topic', 'target language'],
  general: ['clear objective'],
}

// Vague terms that reduce clarity
const VAGUE_TERMS = [
  'something', 'anything', 'whatever', 'some kind of', 'kind of',
  'like this', 'similar to', 'good app', 'cool website', 'nice design',
  'modern', 'professional', 'better', 'improve', 'fix', 'update',
]

// Specificity boosters
const SPECIFIC_SIGNALS = [
  'using', 'with', 'for', 'that', 'which', 'include', 'should',
  'must', 'need', 'require', 'integrate', 'connect', 'store',
]

export class AmbiguityBrain extends Brain<AmbiguityBrainInput, AmbiguityBrainOutput> {
  readonly brainName = 'AmbiguityBrain'
  readonly orchestratorName = 'IntentOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: AmbiguityBrainInput, _context: BrainContext): Promise<AmbiguityBrainOutput> {
    const { goal, categories } = input
    const lower = goal.toLowerCase()
    const wordCount = goal.split(/\s+/).length
    const primaryCategory = categories[0] || 'general'

    // 1. Vague terms check
    const foundVague = VAGUE_TERMS.filter(term => lower.includes(term))

    // 2. Specificity check — count specific signal words
    const specificCount = SPECIFIC_SIGNALS.filter(s => lower.includes(s)).length
    const specificityScore = Math.min(100, specificCount * 15 + (wordCount > 30 ? 20 : 0))

    // 3. Scope check — is the scope defined?
    const hasScope = wordCount > 20 && !lower.includes('just') && !lower.includes('maybe')
    const scopeScore = hasScope ? 70 : 30

    // 4. Required signals check for category
    const required = REQUIRED_SIGNALS[primaryCategory] || REQUIRED_SIGNALS.general
    const missingInfo: string[] = []

    if (primaryCategory === 'code') {
      const hasTechStack = /react|next|vue|angular|express|fastapi|django|node|python|typescript|javascript|flutter/i.test(goal)
      const hasFunctionality = wordCount > 15
      const hasDb = /database|db|sql|postgres|mysql|mongodb|prisma|supabase/i.test(goal)

      if (!hasTechStack && wordCount < 40) missingInfo.push('Preferred tech stack or language')
      if (!hasFunctionality) missingInfo.push('Specific features or functionality needed')
      if (!hasDb && wordCount > 30) missingInfo.push('Database or data storage needs (if any)')
    } else if (primaryCategory === 'content') {
      if (!/audience|reader|user|customer|client/i.test(goal)) missingInfo.push('Target audience')
      if (!/tone|formal|casual|friendly|professional/i.test(goal)) missingInfo.push('Desired tone or style')
    } else if (primaryCategory === 'strategy') {
      if (!/business|company|product|service|startup/i.test(goal)) missingInfo.push('Business context')
      if (!/goal|objective|target|achieve|grow/i.test(goal)) missingInfo.push('Specific goal or objective')
    }

    // 5. Compute final clarity score
    let clarityScore = 60  // baseline

    // Word count contribution (more detail = more clarity)
    if (wordCount > 50) clarityScore += 20
    else if (wordCount > 25) clarityScore += 10
    else if (wordCount < 10) clarityScore -= 20

    // Penalise vague terms
    clarityScore -= foundVague.length * 10

    // Reward specificity signals
    clarityScore += Math.min(20, specificCount * 3)

    // Penalise missing info
    clarityScore -= missingInfo.length * 10

    clarityScore = Math.max(0, Math.min(100, clarityScore))

    return {
      clarityScore,
      needsClarification: clarityScore < 70,
      missingInfo,
      ambiguousTerms: foundVague,
      specificityScore,
      scopeScore,
    }
  }

  protected fallback(_input: AmbiguityBrainInput): AmbiguityBrainOutput {
    return {
      clarityScore: 50,
      needsClarification: true,
      missingInfo: ['Task details are unclear'],
      ambiguousTerms: [],
      specificityScore: 50,
      scopeScore: 50,
    }
  }
}
