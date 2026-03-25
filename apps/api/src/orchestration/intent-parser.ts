import Anthropic from '@anthropic-ai/sdk'
import type { ParsedIntent, TaskCategory } from '@arivarangam/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const INTENT_SYSTEM_PROMPT = `You are an intent analysis engine for Arivarangam, an AI orchestration platform.

Given a user's goal, extract structured intent as JSON. Be precise — pick the MINIMUM categories needed.

Task categories (pick 1-2 MAX, only the most relevant):
- research: finding information, market data, competitor analysis, fact-checking, news
- content: writing copy, articles, blogs, emails, scripts, documentation
- strategy: planning, frameworks, roadmaps, decision-making, go-to-market
- code: programming, building apps, APIs, automation, full-stack development
- data_analysis: charts, statistics, dashboards, metrics, data interpretation
- image: generating visuals, logos, illustrations, mockups
- voice: voiceovers, podcasts, audio narration
- translation: language conversion, localization (Indian languages)
- general: anything that doesn't fit above

Complexity detection:
- "simple": single focused deliverable, short prompt
- "standard": 2-3 related deliverables, medium complexity
- "complex": enterprise/production-ready/comprehensive/full system with multiple interdependent parts

IMPORTANT: Never return more than 2 categories. If task is code + research, return only ["code"] as code is primary.
If task needs both content and strategy, return the most important one.

Respond ONLY with valid JSON:
{
  "goal": "concise restatement",
  "categories": ["1 or 2 categories max"],
  "subject": "main subject/topic (under 50 chars)",
  "audience": "target audience or null",
  "deliverables": ["list of concrete outputs"],
  "language": "ISO language code (en/hi/ta/te)",
  "urgency": "low | normal | high",
  "complexity": "simple | standard | complex",
  "constraints": ["any constraints mentioned"]
}`

export async function parseIntent(userGoal: string): Promise<ParsedIntent> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const message = await client.messages.create({
        model:      'claude-sonnet-4-5',
        max_tokens: 512,
        system:     INTENT_SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: `Parse this goal: "${userGoal.slice(0, 1000)}"` }],
      })

      const content = message.content[0]
      if (content.type === 'text') {
        try {
          const rawText = content.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
          const parsed  = JSON.parse(rawText) as ParsedIntent
          // Hard cap: never more than 2 categories
          if (parsed.categories?.length > 2) {
            parsed.categories = parsed.categories.slice(0, 2)
          }
          return parsed
        } catch {
          // fall through to rule-based
        }
      }
    } catch (err) {
      console.warn('[IntentParser] AI parsing failed, falling back to rule-based:', err)
    }
  }

  return ruleBasedParse(userGoal)
}

function ruleBasedParse(goal: string): ParsedIntent {
  const lower = goal.toLowerCase()

  // Priority-ordered: first match wins (avoids multi-category sprawl)
  const priorityRules: [TaskCategory, string[]][] = [
    ['code',          ['code', 'build', 'develop', 'program', 'automate', 'app', 'website', 'api', 'backend', 'frontend', 'full-stack', 'fullstack']],
    ['image',         ['image', 'visual', 'logo', 'design', 'illustration', 'mockup', 'photo', 'graphic', 'generate image']],
    ['voice',         ['voice', 'voiceover', 'podcast', 'audio', 'narration', 'tts']],
    ['translation',   ['translate', 'hindi', 'tamil', 'telugu', 'kannada', 'marathi', 'bengali']],
    ['data_analysis', ['dashboard', 'chart', 'graph', 'statistics', 'metrics', 'analytics', 'insights', 'visualize data']],
    ['strategy',      ['strategy', 'plan', 'roadmap', 'framework', 'go-to-market', 'launch plan', 'business plan']],
    ['research',      ['research', 'find', 'search', 'market data', 'competitor', 'news', 'information', 'facts']],
    ['content',       ['write', 'article', 'blog', 'email', 'content', 'copy', 'script', 'documentation']],
  ]

  let primaryCategory: TaskCategory = 'general'
  let secondaryCategory: TaskCategory | null = null

  for (const [category, keywords] of priorityRules) {
    if (keywords.some((kw) => lower.includes(kw))) {
      if (primaryCategory === 'general') {
        primaryCategory = category
      } else if (!secondaryCategory && category !== primaryCategory) {
        secondaryCategory = category
        break // stop after 2
      }
    }
  }

  const categories: TaskCategory[] = secondaryCategory
    ? [primaryCategory, secondaryCategory]
    : [primaryCategory]

  // Complexity from prompt length + keywords
  const complexKeywords = ['enterprise', 'production', 'comprehensive', 'full system', 'complete', 'end-to-end', 'scalable', 'full-stack']
  const isComplex = complexKeywords.some((kw) => lower.includes(kw)) || goal.length > 500
  const isSimple  = goal.length < 100 && categories.length === 1

  const complexity: 'simple' | 'standard' | 'complex' =
    isComplex ? 'complex' : isSimple ? 'simple' : 'standard'

  // Language detection
  const hindiChars  = /[\u0900-\u097F]/
  const tamilChars  = /[\u0B80-\u0BFF]/
  const teluguChars = /[\u0C00-\u0C7F]/
  let language = 'en'
  if (hindiChars.test(goal))  language = 'hi'
  else if (tamilChars.test(goal))  language = 'ta'
  else if (teluguChars.test(goal)) language = 'te'

  const urgencyHigh = ['urgent', 'asap', 'immediately', 'today', 'rush']
  const urgencyLow  = ['eventually', 'no rush', 'flexible', 'sometime']
  let urgency: 'low' | 'normal' | 'high' = 'normal'
  if (urgencyHigh.some((w) => lower.includes(w))) urgency = 'high'
  else if (urgencyLow.some((w) => lower.includes(w))) urgency = 'low'

  const words   = goal.split(' ').filter((w) => w.length > 3)
  const subject = words.slice(0, 5).join(' ') || goal.slice(0, 50)

  const deliverableMap: Record<TaskCategory, string> = {
    research:      'Research report',
    content:       'Written content',
    strategy:      'Strategy document',
    image:         'Visual assets',
    voice:         'Audio file',
    translation:   'Translated content',
    code:          'Code / Application',
    data_analysis: 'Data analysis report',
    general:       'Deliverable',
  }

  return {
    goal:         goal.slice(0, 200),
    categories,
    subject,
    audience:     null,
    deliverables: categories.map((c) => deliverableMap[c] || 'Deliverable'),
    language,
    urgency,
    complexity,
    constraints:  [],
  }
}
