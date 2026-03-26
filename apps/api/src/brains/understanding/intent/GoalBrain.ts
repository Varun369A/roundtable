/**
 * GoalBrain — Extracts the clear final deliverable from the user's request.
 * Pure logic — zero API calls.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { TaskCategory } from './IntentBrain'

export interface GoalBrainInput {
  goal: string
  primaryCategory: TaskCategory
  deliverables: string[]
}

export interface GoalBrainOutput {
  finalGoal: string       // cleaned, normalised statement of what to build
  outputType: string      // 'application' | 'document' | 'analysis' | 'image' etc
  isBuilding: boolean     // true = building something new
  isFixing: boolean       // true = fixing/improving existing
  isAnalyzing: boolean    // true = analyzing/researching
  scope: 'small' | 'medium' | 'large'
}

const BUILD_VERBS = ['build', 'create', 'develop', 'implement', 'make', 'design', 'generate', 'write', 'produce']
const FIX_VERBS = ['fix', 'repair', 'debug', 'refactor', 'improve', 'optimize', 'update', 'enhance', 'upgrade']
const ANALYZE_VERBS = ['analyze', 'analyse', 'research', 'investigate', 'study', 'review', 'audit', 'evaluate']

export class GoalBrain extends Brain<GoalBrainInput, GoalBrainOutput> {
  readonly brainName = 'GoalBrain'
  readonly orchestratorName = 'IntentOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: GoalBrainInput, _context: BrainContext): Promise<GoalBrainOutput> {
    const { goal, primaryCategory } = input
    const lower = goal.toLowerCase()
    const words = goal.split(/\s+/)

    const isBuilding = BUILD_VERBS.some(v => lower.startsWith(v) || lower.includes(` ${v} `))
    const isFixing = FIX_VERBS.some(v => lower.startsWith(v) || lower.includes(` ${v} `))
    const isAnalyzing = ANALYZE_VERBS.some(v => lower.startsWith(v) || lower.includes(` ${v} `))

    // Output type based on category
    const outputTypeMap: Record<TaskCategory, string> = {
      code: 'application',
      research: 'research report',
      content: 'written content',
      strategy: 'strategy document',
      data_analysis: 'data analysis',
      image: 'image',
      voice: 'audio',
      translation: 'translated content',
      general: 'output',
    }
    const outputType = outputTypeMap[primaryCategory] || 'output'

    // Scope based on word count + complexity signals
    let scope: 'small' | 'medium' | 'large' = 'medium'
    if (words.length < 15) scope = 'small'
    else if (words.length > 60 || /full|complete|entire|enterprise|all/i.test(goal)) scope = 'large'

    // Clean goal — capitalise first letter, ensure ends with period
    const finalGoal = goal.charAt(0).toUpperCase() + goal.slice(1).trim() + (goal.endsWith('.') ? '' : '.')

    return { finalGoal, outputType, isBuilding, isFixing, isAnalyzing, scope }
  }

  protected fallback(input: GoalBrainInput): GoalBrainOutput {
    return {
      finalGoal: input.goal,
      outputType: 'output',
      isBuilding: true,
      isFixing: false,
      isAnalyzing: false,
      scope: 'medium',
    }
  }
}
