import Anthropic from '@anthropic-ai/sdk'
import type { ParsedIntent, TaskCategory } from '@sabha/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const INTENT_SYSTEM_PROMPT = `You are an intent analysis engine for Sabha, an AI orchestration platform.

Given a user's goal, extract structured intent as JSON. Be precise and practical.

Task categories available:
- research: finding information, market data, competitor analysis, fact-checking
- copywriting: writing copy, content, articles, emails, scripts, taglines
- strategy: planning, frameworks, roadmaps, decision-making
- images: generating visuals, logos, illustrations, mockups
- video: video scripts, storyboards, video generation prompts
- audio: voiceovers, podcasts, music, sound design
- presentation: decks, slides, reports
- code: programming, automation, data processing
- translation: language conversion, localization
- data_analysis: charts, statistics, data interpretation
- general: anything that doesn't fit above

AI Models available for routing:
- claude-3-5-sonnet: best for reasoning, writing, code, strategy
- gpt-4o: great for structured tasks, vision, data
- perplexity-sonar: real-time web search and research
- dalle-3: image generation
- elevenlabs: voice/audio generation
- sarvam-1: Indian language translation
- midjourney-v6: high quality artistic images
- stability-xl: image generation
- gemini-pro: multimodal tasks
- gamma: presentation/deck creation
- runway-gen3: video generation

Respond ONLY with valid JSON matching this exact schema:
{
  "goal": "concise restatement of the goal",
  "categories": ["array of relevant TaskCategory values"],
  "subject": "the main subject/topic",
  "audience": "target audience if mentioned, null otherwise",
  "deliverables": ["list of concrete outputs the user needs"],
  "language": "ISO language code (en, hi, ta, te, etc.)",
  "urgency": "low | normal | high",
  "constraints": ["any constraints mentioned like budget, time, tone, format"]
}`

export async function parseIntent(userGoal: string): Promise<ParsedIntent> {
  // Try AI-based parsing first
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const message = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: INTENT_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Parse this goal: "${userGoal}"`,
          },
        ],
      })

      const content = message.content[0]
      if (content.type === 'text') {
        const parsed = JSON.parse(content.text) as ParsedIntent
        return parsed
      }
    } catch (err) {
      console.warn('[IntentParser] AI parsing failed, falling back to rule-based:', err)
    }
  }

  // Rule-based fallback — always works, no API needed
  return ruleBasedParse(userGoal)
}

function ruleBasedParse(goal: string): ParsedIntent {
  const lower = goal.toLowerCase()
  const categories: TaskCategory[] = []

  const categoryKeywords: Record<TaskCategory, string[]> = {
    research:      ['research', 'find', 'search', 'data', 'market', 'competitor', 'analysis', 'study', 'information', 'facts'],
    copywriting:   ['write', 'copy', 'content', 'article', 'blog', 'email', 'script', 'caption', 'tagline', 'description'],
    strategy:      ['strategy', 'plan', 'roadmap', 'framework', 'approach', 'campaign', 'launch'],
    images:        ['image', 'visual', 'logo', 'design', 'illustration', 'mockup', 'photo', 'picture', 'graphic'],
    video:         ['video', 'reel', 'clip', 'film', 'animation', 'ad', 'advertisement'],
    audio:         ['audio', 'voice', 'voiceover', 'podcast', 'music', 'sound', 'narration'],
    presentation:  ['presentation', 'deck', 'slide', 'pitch', 'report'],
    code:          ['code', 'build', 'develop', 'program', 'automate', 'app', 'website', 'api', 'script'],
    translation:   ['translate', 'hindi', 'tamil', 'telugu', 'kannada', 'marathi', 'bengali', 'language'],
    data_analysis: ['analyze', 'chart', 'graph', 'statistics', 'dashboard', 'metrics', 'insights'],
    general:       [],
  }

  for (const [category, keywords] of Object.entries(categoryKeywords) as [TaskCategory, string[]][]) {
    if (keywords.some((kw) => lower.includes(kw))) {
      categories.push(category)
    }
  }

  if (categories.length === 0) categories.push('general')

  // Detect language
  const hindiChars = /[\u0900-\u097F]/
  const tamilChars = /[\u0B80-\u0BFF]/
  const teluguChars = /[\u0C00-\u0C7F]/
  let language = 'en'
  if (hindiChars.test(goal)) language = 'hi'
  else if (tamilChars.test(goal)) language = 'ta'
  else if (teluguChars.test(goal)) language = 'te'

  // Extract deliverables from categories
  const deliverableMap: Record<TaskCategory, string> = {
    research:      'Research report',
    copywriting:   'Written content',
    strategy:      'Strategy document',
    images:        'Visual assets',
    video:         'Video content',
    audio:         'Audio file',
    presentation:  'Presentation deck',
    code:          'Code/application',
    translation:   'Translated content',
    data_analysis: 'Data analysis report',
    general:       'Deliverable',
  }

  const deliverables = categories.map((c) => deliverableMap[c])

  // Urgency detection
  const urgencyHigh = ['urgent', 'asap', 'immediately', 'today', 'rush', 'quickly']
  const urgencyLow = ['eventually', 'whenever', 'no rush', 'flexible', 'sometime']
  let urgency: 'low' | 'normal' | 'high' = 'normal'
  if (urgencyHigh.some((w) => lower.includes(w))) urgency = 'high'
  else if (urgencyLow.some((w) => lower.includes(w))) urgency = 'low'

  // Subject: first noun phrase (simplified)
  const words = goal.split(' ').filter((w) => w.length > 3)
  const subject = words.slice(0, 4).join(' ') || goal.slice(0, 50)

  return {
    goal: goal.slice(0, 200),
    categories,
    subject,
    audience: extractAudience(lower),
    deliverables,
    language,
    urgency,
    constraints: extractConstraints(lower),
  }
}

function extractAudience(lower: string): string | undefined {
  const audiencePatterns = [
    /targeting\s+([^,\.]+)/,
    /for\s+(students?|professionals?|developers?|marketers?|founders?|enterprises?|startups?|businesses?)/,
    /audience[:\s]+([^,\.]+)/,
  ]
  for (const pattern of audiencePatterns) {
    const match = lower.match(pattern)
    if (match) return match[1].trim()
  }
  return undefined
}

function extractConstraints(lower: string): string[] {
  const constraints: string[] = []
  const budgetMatch = lower.match(/budget[:\s]+([^,\.]+)/)
  if (budgetMatch) constraints.push(`Budget: ${budgetMatch[1].trim()}`)
  const tonePatterns = ['professional', 'casual', 'formal', 'friendly', 'humorous', 'serious']
  for (const tone of tonePatterns) {
    if (lower.includes(tone)) constraints.push(`Tone: ${tone}`)
  }
  return constraints
}
