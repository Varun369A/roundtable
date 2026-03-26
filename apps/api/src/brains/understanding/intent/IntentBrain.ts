/**
 * IntentBrain — Classifies what type of task the user is requesting.
 * Pure logic — zero API calls. Keyword + pattern matching.
 *
 * Categories: code, research, content, strategy, data_analysis,
 *             image, voice, translation, general
 */

import { Brain, BrainContext } from '../../base/Brain'

export type TaskCategory =
  | 'code'
  | 'research'
  | 'content'
  | 'strategy'
  | 'data_analysis'
  | 'image'
  | 'voice'
  | 'translation'
  | 'general'

export type Complexity = 'simple' | 'standard' | 'complex'

export interface IntentBrainInput {
  goal: string
}

export interface IntentBrainOutput {
  categories: TaskCategory[]          // max 2
  primaryCategory: TaskCategory
  complexity: Complexity
  isCodeTask: boolean                 // shorthand for categories.includes('code')
  deliverables: string[]              // what the output should be
  subject: string                     // topic of the task
}

// Keyword maps per category — order matters (first match wins for primary)
const CATEGORY_KEYWORDS: Record<TaskCategory, string[]> = {
  code: [
    'build', 'create app', 'develop', 'implement', 'code', 'program', 'website',
    'application', 'api', 'backend', 'frontend', 'full stack', 'fullstack',
    'dashboard', 'component', 'function', 'class', 'module', 'script',
    'database schema', 'rest api', 'graphql', 'react', 'next.js', 'nodejs',
    'typescript', 'python', 'django', 'fastapi', 'express', 'deploy',
    'docker', 'microservice', 'mobile app', 'flutter', 'react native',
    'fix bug', 'refactor', 'optimize code', 'write tests', 'unit test',
  ],
  research: [
    'research', 'find', 'investigate', 'explore', 'study', 'analyze',
    'what is', 'how does', 'explain', 'overview', 'compare', 'review',
    'market research', 'competitive analysis', 'literature review',
    'survey', 'benchmark', 'evaluate', 'assess', 'examine',
  ],
  data_analysis: [
    'analyze data', 'data analysis', 'visualize', 'chart', 'graph',
    'statistics', 'metrics', 'kpi', 'report', 'dashboard analytics',
    'sql query', 'pandas', 'numpy', 'excel', 'csv', 'spreadsheet',
    'trend analysis', 'forecast', 'predict', 'model', 'correlation',
  ],
  content: [
    'write', 'blog', 'article', 'post', 'essay', 'copy', 'content',
    'newsletter', 'email', 'description', 'bio', 'caption', 'story',
    'script', 'press release', 'announcement', 'social media post',
    'product description', 'landing page copy', 'tagline', 'slogan',
  ],
  strategy: [
    'strategy', 'plan', 'roadmap', 'business plan', 'go-to-market',
    'marketing strategy', 'growth', 'product strategy', 'launch plan',
    'competitive strategy', 'pricing', 'positioning', 'business model',
    'swot', 'okr', 'kpi', 'revenue model', 'expansion', 'fundraising',
  ],
  image: [
    'image', 'photo', 'picture', 'illustration', 'logo', 'icon',
    'banner', 'thumbnail', 'generate image', 'create image', 'draw',
    'design image', 'infographic', 'poster', 'cover art',
  ],
  voice: [
    'voice', 'audio', 'narrate', 'speak', 'text to speech', 'tts',
    'podcast', 'voiceover', 'read aloud', 'pronounce',
  ],
  translation: [
    'translate', 'translation', 'convert to', 'in tamil', 'in hindi',
    'in telugu', 'in kannada', 'in malayalam', 'localize', 'localise',
    'regional language', 'vernacular',
  ],
  general: [],
}

// Complexity signals
const COMPLEX_KEYWORDS = [
  'full', 'complete', 'production', 'enterprise', 'entire', 'whole',
  'comprehensive', 'end-to-end', 'e2e', 'full stack', 'all features',
  'with authentication', 'with database', 'with tests', 'scalable',
  'multi-tenant', 'saas', 'real-time', 'microservices',
]

const SIMPLE_KEYWORDS = [
  'simple', 'basic', 'quick', 'small', 'short', 'minimal', 'tiny',
  'one page', 'single', 'just a', 'only', 'brief',
]

function scoreCategory(goal: string, keywords: string[]): number {
  const lower = goal.toLowerCase()
  return keywords.filter(kw => lower.includes(kw)).length
}

function inferDeliverables(goal: string, category: TaskCategory): string[] {
  const lower = goal.toLowerCase()
  const deliverables: string[] = []

  if (category === 'code') {
    if (lower.includes('frontend') || lower.includes('ui') || lower.includes('react')) deliverables.push('frontend code')
    if (lower.includes('backend') || lower.includes('api') || lower.includes('server')) deliverables.push('backend code')
    if (lower.includes('database') || lower.includes('schema') || lower.includes('prisma')) deliverables.push('database schema')
    if (lower.includes('test') || lower.includes('spec')) deliverables.push('test files')
    if (lower.includes('docker') || lower.includes('deploy')) deliverables.push('deployment config')
    if (deliverables.length === 0) deliverables.push('source code', 'documentation')
  } else if (category === 'content') {
    deliverables.push('written content')
  } else if (category === 'research') {
    deliverables.push('research report')
  } else if (category === 'strategy') {
    deliverables.push('strategy document')
  } else if (category === 'data_analysis') {
    deliverables.push('analysis report')
  } else {
    deliverables.push('output')
  }

  return deliverables
}

function extractSubject(goal: string): string {
  // Remove common verb starters and return the core subject
  const cleaned = goal
    .replace(/^(build|create|develop|implement|write|make|generate|design|analyze|research)\s+/i, '')
    .replace(/^(a|an|the)\s+/i, '')
    .trim()
  // Return first 60 chars as subject
  return cleaned.length > 60 ? cleaned.slice(0, 60) + '...' : cleaned
}

export class IntentBrain extends Brain<IntentBrainInput, IntentBrainOutput> {
  readonly brainName = 'IntentBrain'
  readonly orchestratorName = 'IntentOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: IntentBrainInput, _context: BrainContext): Promise<IntentBrainOutput> {
    const { goal } = input

    // Score each category
    const scores: Partial<Record<TaskCategory, number>> = {}
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      const score = scoreCategory(goal, keywords)
      if (score > 0) scores[cat as TaskCategory] = score
    }

    // Sort by score
    const ranked = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([cat]) => cat as TaskCategory)

    const primaryCategory: TaskCategory = ranked[0] || 'general'
    const secondaryCategory = ranked[1]
    const categories: TaskCategory[] = secondaryCategory
      ? [primaryCategory, secondaryCategory]
      : [primaryCategory]

    // Complexity
    const lower = goal.toLowerCase()
    const wordCount = goal.split(/\s+/).length
    let complexity: Complexity = 'standard'

    const complexScore = COMPLEX_KEYWORDS.filter(kw => lower.includes(kw)).length
    const simpleScore = SIMPLE_KEYWORDS.filter(kw => lower.includes(kw)).length

    if (complexScore >= 2 || wordCount > 80) complexity = 'complex'
    else if (simpleScore >= 1 || wordCount < 20) complexity = 'simple'

    return {
      categories,
      primaryCategory,
      complexity,
      isCodeTask: categories.includes('code'),
      deliverables: inferDeliverables(goal, primaryCategory),
      subject: extractSubject(goal),
    }
  }

  protected fallback(_input: IntentBrainInput): IntentBrainOutput {
    return {
      categories: ['general'],
      primaryCategory: 'general',
      complexity: 'standard',
      isCodeTask: false,
      deliverables: ['output'],
      subject: 'task',
    }
  }
}
