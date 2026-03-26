/**
 * ClarificationBrain — Generates smart clarifying questions when ambiguity > 30%.
 * Uses Groq free tier for question generation (minimal tokens).
 * Falls back to template questions if Groq is unavailable.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { callGroq } from '../../../connectors/groq.connector'
import type { TaskCategory } from './IntentBrain'

export interface ClarificationBrainInput {
  goal: string
  primaryCategory: TaskCategory
  clarityScore: number
  missingInfo: string[]
  needsClarification: boolean
}

export interface ClarificationBrainOutput {
  shouldAsk: boolean
  questions: ClarificationQuestion[]
}

export interface ClarificationQuestion {
  id: string
  question: string
  type: 'text' | 'choice' | 'multiselect'
  options?: string[]
  required: boolean
  orderIndex: number
}

// Template questions per category — used as fallback
const TEMPLATE_QUESTIONS: Record<TaskCategory, ClarificationQuestion[]> = {
  code: [
    { id: 'tech_stack', question: 'Which tech stack should I use? (e.g. React + Node, Next.js, Python/FastAPI)', type: 'text', required: true, orderIndex: 1 },
    { id: 'auth', question: 'Does this app need user authentication/login?', type: 'choice', options: ['Yes, with email/password', 'Yes, with social login (Google/GitHub)', 'No authentication needed'], required: true, orderIndex: 2 },
    { id: 'database', question: 'What database should it use?', type: 'choice', options: ['PostgreSQL', 'MongoDB', 'SQLite (simple)', 'No database needed'], required: false, orderIndex: 3 },
  ],
  research: [
    { id: 'depth', question: 'What depth of research do you need?', type: 'choice', options: ['Brief overview (1-2 pages)', 'Detailed report (5-10 pages)', 'Comprehensive deep-dive'], required: true, orderIndex: 1 },
    { id: 'focus', question: 'Any specific angle or perspective to focus on?', type: 'text', required: false, orderIndex: 2 },
  ],
  content: [
    { id: 'tone', question: 'What tone should the content have?', type: 'choice', options: ['Professional & formal', 'Casual & friendly', 'Technical & detailed', 'Inspirational'], required: true, orderIndex: 1 },
    { id: 'length', question: 'How long should it be?', type: 'choice', options: ['Short (under 300 words)', 'Medium (300-800 words)', 'Long (800+ words)'], required: false, orderIndex: 2 },
  ],
  strategy: [
    { id: 'context', question: 'What is your business/product context?', type: 'text', required: true, orderIndex: 1 },
    { id: 'timeframe', question: 'What timeframe is this strategy for?', type: 'choice', options: ['3 months', '6 months', '1 year', '3+ years'], required: false, orderIndex: 2 },
  ],
  data_analysis: [
    { id: 'data_source', question: 'What is the data source?', type: 'text', required: true, orderIndex: 1 },
    { id: 'output_format', question: 'What format should the analysis be in?', type: 'choice', options: ['Written report', 'Charts and graphs', 'Dashboard code', 'SQL queries'], required: true, orderIndex: 2 },
  ],
  image: [
    { id: 'style', question: 'What visual style do you want?', type: 'choice', options: ['Photorealistic', 'Illustration / cartoon', 'Minimalist', 'Professional / corporate'], required: true, orderIndex: 1 },
  ],
  voice: [
    { id: 'voice_style', question: 'What voice style?', type: 'choice', options: ['Professional narrator', 'Friendly casual', 'News anchor style'], required: true, orderIndex: 1 },
  ],
  translation: [
    { id: 'target_lang', question: 'Which language should it be translated to?', type: 'choice', options: ['Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam', 'Other'], required: true, orderIndex: 1 },
  ],
  general: [
    { id: 'details', question: 'Can you provide more details about what you need?', type: 'text', required: true, orderIndex: 1 },
  ],
}

export class ClarificationBrain extends Brain<ClarificationBrainInput, ClarificationBrainOutput> {
  readonly brainName = 'ClarificationBrain'
  readonly orchestratorName = 'IntentOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = true  // uses Groq when available
  private _tokensUsed = 0

  protected getTokensUsed(): number { return this._tokensUsed }

  protected async process(input: ClarificationBrainInput, _context: BrainContext): Promise<ClarificationBrainOutput> {
    const { clarityScore, needsClarification, primaryCategory, goal, missingInfo } = input

    // High clarity — no questions needed
    if (!needsClarification || clarityScore >= 80) {
      return { shouldAsk: false, questions: [] }
    }

    // Try Groq for smart questions
    try {
      const prompt = `You are helping understand a user's task request.

User's goal: "${goal}"
Task category: ${primaryCategory}
Clarity score: ${clarityScore}/100
Missing information: ${missingInfo.join(', ')}

Generate 2-3 concise clarification questions to fill the gaps.
Return ONLY valid JSON in this exact format:
[
  { "id": "q1", "question": "...", "type": "text|choice", "options": ["option1", "option2"] or null, "required": true, "orderIndex": 1 }
]
Keep questions short, specific, and actionable.`

      const response = await callGroq(prompt, { maxTokens: 400, fast: true })
      this._tokensUsed = 400

      // Parse response
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ClarificationQuestion[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { shouldAsk: true, questions: parsed.slice(0, 3) }
        }
      }
    } catch {
      // Groq failed — use templates
    }

    // Fallback to template questions
    const templates = TEMPLATE_QUESTIONS[primaryCategory] || TEMPLATE_QUESTIONS.general
    const relevant = templates.filter((q, i) => {
      if (i === 0) return true // always include first
      return missingInfo.some(m => q.question.toLowerCase().includes(m.toLowerCase().split(' ')[0]))
    }).slice(0, 3)

    return { shouldAsk: true, questions: relevant }
  }

  protected fallback(_input: ClarificationBrainInput): ClarificationBrainOutput {
    return { shouldAsk: false, questions: [] }
  }
}
