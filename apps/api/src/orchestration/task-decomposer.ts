import type { ParsedIntent, TaskCategory, AIModel } from '@arivarangam/types'

export interface SubtaskDefinition {
  title: string
  category: TaskCategory
  assignedModel: AIModel
  dependsOn: string[]   // indices into the subtasks array as strings like "0", "1"
  executionOrder: number
  inputInstruction: string
  role: 'INITIAL' | 'REVIEW' | 'SYNTHESIS'
}

// ─── Routing Table ────────────────────────────────────────────────────────────
// Maps task category → best specialist AI.
// Arivarangam AI is ALWAYS the final synthesiser — added automatically.

// ─── Specialist roles ────────────────────────────────────────────────────────
// For CODE tasks: specialists PLAN and RESEARCH — Arivarangam AI WRITES the code.
// GPT-4o: architecture + step-by-step plan
// Perplexity: best practices, libraries, real-world examples
// Arivarangam AI reads their guidance and produces the complete codebase.

export const ROUTING_TABLE: Record<TaskCategory, AIModel> = {
  code:          'gpt-4o',              // GPT-4o: architecture + plan (Arivarangam codes)
  research:      'perplexity-sonar',    // Perplexity: real-time web research
  content:       'claude-3-5-sonnet',   // Claude: nuanced writing
  strategy:      'gpt-4o',              // GPT-4o: structured reasoning
  data_analysis: 'gemini-2.5-pro',      // Gemini: long-context analysis
  image:         'gpt-image-1',         // GPT Image 1: generation
  voice:         'elevenlabs',          // ElevenLabs: TTS
  translation:   'sarvam-1',            // Sarvam: Indian languages
  general:       'gpt-4o',              // GPT-4o: broad reasoning
}

// ─── Who consults on each category ───────────────────────────────────────────
// MAX 1 consultant per category (not 2). Keeps total subtasks ≤ 5.
// Exception: code + complex → 2 consultants (Perplexity + Claude).
// Consultation is SKIPPED entirely for simple tasks.

const CONSULTATION_MAP: Partial<Record<TaskCategory, AIModel>> = {
  code:          'perplexity-sonar',   // Research: libraries, best practices, real-world examples
  research:      'gemini-2.5-pro',     // Deep analysis
  content:       'perplexity-sonar',   // Facts & references
  strategy:      'perplexity-sonar',   // Market research
  data_analysis: 'gpt-4o',            // Structured reasoning
  general:       'perplexity-sonar',   // Research support
}

// For complex code tasks: Claude adds implementation guidance + code patterns
// GPT-4o plans → Perplexity researches → Claude guides patterns → Arivarangam codes
const SECOND_CONSULTATION_MAP: Partial<Record<TaskCategory, AIModel>> = {
  code: 'claude-3-5-sonnet',  // Implementation patterns, code quality, best practices
}

// ─── Dependency rules ────────────────────────────────────────────────────────
const DEPENDENCY_RULES: Partial<Record<TaskCategory, TaskCategory[]>> = {
  content:       ['research'],
  strategy:      ['research'],
  data_analysis: ['research'],
  translation:   ['content'],
}

/**
 * Decomposes a parsed intent into a subtask DAG.
 *
 * Smart routing tiers:
 *   simple   → 1 primary + synthesis                              = 2 subtasks  (~30s)
 *   standard → 1 primary + 1 consultant + synthesis               = 3 subtasks  (~60s)
 *   complex  → 1 primary + 2 consultants + synthesis              = 4 subtasks  (~90s)
 *             (for code: GPT-4o plans → Perplexity researches → Claude guides → Arivarangam codes)
 *
 * Hard cap: never more than 4 specialist subtasks before synthesis.
 * User sees only the Arivarangam AI synthesis — specialist work is internal.
 */
export function decomposeTask(intent: ParsedIntent): SubtaskDefinition[] {
  const subtasks: SubtaskDefinition[] = []

  const complexity = (intent as any).complexity ?? 'standard'

  // Cap categories: simple=1, standard=1, complex=2
  const maxCategories = complexity === 'complex' ? 2 : 1
  const sortedCategories = topologicalSort(intent.categories).slice(0, maxCategories)

  const categoryToIndex = new Map<TaskCategory, number>()

  for (let i = 0; i < sortedCategories.length; i++) {
    const category = sortedCategories[i]
    let primaryModel = ROUTING_TABLE[category]

    // Indian language content → Sarvam handles writing
    if (intent.language !== 'en' && category === 'content') {
      primaryModel = 'sarvam-1'
    }

    // Resolve category dependencies
    const dependencyCategories = DEPENDENCY_RULES[category] || []
    const dependsOn: string[] = []
    for (const depCategory of dependencyCategories) {
      if (categoryToIndex.has(depCategory)) {
        dependsOn.push(String(categoryToIndex.get(depCategory)))
      }
    }

    // Add primary specialist
    subtasks.push({
      title:            buildSubtaskTitle(category, intent, primaryModel, 'primary'),
      category,
      assignedModel:    primaryModel,
      dependsOn,
      executionOrder:   subtasks.length,
      inputInstruction: buildPrimaryInstruction(category, intent),
      role:             'INITIAL',
    })
    categoryToIndex.set(category, subtasks.length - 1)

    // Add consultants for standard/complex tasks (skip for simple, image, voice, translation)
    const skipConsult = ['image', 'voice', 'translation'].includes(category)
    const addConsult  = !skipConsult && complexity !== 'simple'

    if (addConsult) {
      const consultantModel = CONSULTATION_MAP[category]
      if (consultantModel && consultantModel !== primaryModel) {
        subtasks.push({
          title:            buildSubtaskTitle(category, intent, consultantModel, 'consult'),
          category,
          assignedModel:    consultantModel,
          dependsOn,
          executionOrder:   subtasks.length,
          inputInstruction: buildConsultationInstruction(category, intent, consultantModel),
          role:             'INITIAL',
        })
      }

      // For complex code tasks: add Claude as second consultant (implementation guidance)
      if (complexity === 'complex') {
        const secondConsultant = SECOND_CONSULTATION_MAP[category]
        if (secondConsultant && secondConsultant !== primaryModel && secondConsultant !== consultantModel) {
          subtasks.push({
            title:            buildSubtaskTitle(category, intent, secondConsultant, 'consult'),
            category,
            assignedModel:    secondConsultant,
            dependsOn,
            executionOrder:   subtasks.length,
            inputInstruction: buildConsultationInstruction(category, intent, secondConsultant),
            role:             'INITIAL',
          })
        }
      }
    }
  }

  // Always add Arivarangam AI as final synthesiser (depends on ALL specialists)
  const allPreviousIndices = subtasks.map((_, i) => String(i))

  subtasks.push({
    title:            `Arivarangam AI — building your ${buildDeliverableLabel(intent.categories[0])}`,
    category:         intent.categories[0] || 'general',
    assignedModel:    'sabha-ai',
    dependsOn:        allPreviousIndices,
    executionOrder:   subtasks.length,
    inputInstruction: buildSynthesisInstruction(intent),
    role:             'SYNTHESIS',
  })

  return subtasks
}

// ─── Title builders ───────────────────────────────────────────────────────────

function buildSubtaskTitle(
  category: TaskCategory,
  intent: ParsedIntent,
  model: AIModel,
  type: 'primary' | 'consult',
): string {
  const modelLabel: Partial<Record<AIModel, string>> = {
    'claude-3-5-sonnet': 'Claude',
    'gpt-4o':            'GPT-4o',
    'gemini-2.5-pro':    'Gemini',
    'perplexity-sonar':  'Perplexity',
    'sarvam-1':          'Sarvam',
    'elevenlabs':        'ElevenLabs',
    'gpt-image-1':       'GPT Image',
    'sabha-ai':          'Arivarangam AI',
  }
  const label = modelLabel[model] || model
  const subject = intent.subject.slice(0, 35)

  if (type === 'primary') {
    const categoryLabel: Record<TaskCategory, string> = {
      code:          `Coding: ${subject}`,
      research:      `Research: ${subject}`,
      content:       `Writing: ${subject}`,
      strategy:      `Strategy: ${subject}`,
      data_analysis: `Analysis: ${subject}`,
      image:         `Image: ${subject}`,
      voice:         `Voice: ${subject}`,
      translation:   `Translating: ${subject}`,
      general:       `Working on: ${subject}`,
    }
    return `${label} — ${categoryLabel[category]}`
  }
  return `${label} consulting on ${subject}`
}

function buildDeliverableLabel(category: TaskCategory): string {
  const labels: Record<TaskCategory, string> = {
    code:          'application',
    research:      'research report',
    content:       'content',
    strategy:      'strategy document',
    data_analysis: 'analysis report',
    image:         'image',
    voice:         'audio',
    translation:   'translated content',
    general:       'deliverable',
  }
  return labels[category] || 'output'
}

// ─── Instruction builders ─────────────────────────────────────────────────────

function buildPrimaryInstruction(category: TaskCategory, intent: ParsedIntent): string {
  const audience = intent.audience ? ` for ${intent.audience}` : ''
  const constraints = intent.constraints.length > 0
    ? ` Constraints: ${intent.constraints.join(', ')}.` : ''

  const map: Record<TaskCategory, string> = {
    research:
      `You are the research specialist. Research "${intent.subject}"${audience}. Find current data, trends, key statistics and insights. Provide a thorough, structured summary with sources.${constraints}`,

    code:
      `You are the architecture and planning specialist. The goal is: "${intent.goal}"${audience}. Do NOT write the full code yet. Instead provide: (1) recommended tech stack with justification, (2) complete file/folder structure, (3) step-by-step implementation plan with what each file does, (4) key algorithms and data flow. Arivarangam AI will write the actual code using your plan.${constraints}`,

    content:
      `You are the writing specialist. Write compelling content about "${intent.subject}"${audience}. Deliverables: ${intent.deliverables.join(', ')}.${constraints}`,

    strategy:
      `You are the strategy specialist. Create a strategic framework for "${intent.goal}"${audience}. Include positioning, key messages, execution approach, and success metrics.${constraints}`,

    data_analysis:
      `You are the analysis specialist. Analyze data about "${intent.subject}"${audience}. Identify patterns, insights, and actionable recommendations.${constraints}`,

    image:
      `You are the image generation specialist. Generate high-quality visuals for "${intent.subject}"${audience}.${constraints}`,

    voice:
      `You are the voice specialist. Generate natural, engaging voiceover for "${intent.subject}"${audience}.${constraints}`,

    translation:
      `You are the language specialist. Translate the following content to ${intent.language}, maintaining tone and cultural relevance: "${intent.goal}"${constraints}`,

    general:
      `You are the primary specialist. Complete: "${intent.goal}"${audience}.${constraints}`,
  }
  return map[category] || `Complete: ${intent.goal}`
}

function buildConsultationInstruction(
  category: TaskCategory,
  intent: ParsedIntent,
  model: AIModel,
): string {
  if (model === 'perplexity-sonar') {
    const isCode = ['code', 'general'].includes(category)
    if (isCode) {
      return `Research for a coding project: "${intent.goal}". Find: (1) best libraries/frameworks for this use case with npm install commands, (2) any existing open-source solutions or GitHub repos to reference, (3) common pitfalls and how to avoid them, (4) production deployment considerations. Be specific with version numbers and actual package names. Arivarangam AI will use your research to write the code.`
    }
    return `Research current information, latest best practices, and real-world examples relevant to: "${intent.goal}". Provide facts, statistics and references that will support the final output.`
  }
  if (model === 'gpt-4o') {
    return `Provide logical structure, step-by-step reasoning, and a clear implementation plan for: "${intent.goal}". Focus on the approach and decision framework.`
  }
  if (model === 'gemini-2.5-pro') {
    return `Provide deep analysis and strategic guidance for: "${intent.goal}". Consider long-term implications, risks, and opportunities.`
  }
  if (model === 'claude-3-5-sonnet') {
    if (category === 'code') {
      return `You are the code quality and implementation specialist. For the project: "${intent.goal}". Provide: (1) recommended code patterns and architectural best practices for this specific use case, (2) security considerations and how to implement them, (3) error handling strategies and edge cases to cover, (4) testing approach and what to test, (5) performance optimizations to apply. Write concrete code snippets showing HOW to implement the trickiest parts. Arivarangam AI will use your guidance to write the complete codebase.`
    }
    return `Provide detailed, high-quality content and technical depth for: "${intent.goal}". Focus on clarity, completeness and actionability.`
  }
  return `Provide your specialist perspective on: "${intent.goal}"`
}

function buildSynthesisInstruction(intent: ParsedIntent): string {
  const isCode = intent.categories.includes('code')

  if (isCode) {
    return `You are Arivarangam AI — the master builder. Your specialists have done the research and architecture planning for: "${intent.goal}".

Read ALL specialist outputs above carefully. Now WRITE THE COMPLETE, PRODUCTION-READY CODE.

Rules:
- Write EVERY file completely — no placeholders, no "add your logic here", no "TODO"
- Follow the architecture plan from your specialist exactly
- Use the specific libraries and packages your research specialist identified
- Include package.json / requirements.txt with exact versions
- Include setup instructions and environment variable examples
- Add clear inline comments explaining non-obvious logic
- Code must run immediately after following setup steps

Do NOT mention AI names. Do NOT summarize what the specialists said. Just BUILD.

Deliverables: ${intent.deliverables.join(', ') || 'complete, working codebase'}`
  }

  return `You are Arivarangam AI. The specialist AIs above have each contributed their expertise on: "${intent.goal}".

Read ALL the specialist outputs carefully. Now BUILD the final, complete deliverable for the user.

Instructions:
- Integrate the best insights from every specialist
- Do NOT mention individual AI names or say "according to Claude/GPT-4o"
- Deliver as Arivarangam AI — one unified, polished output
- Make it complete, actionable, and production-ready
- The user should only need this final output — nothing else

Deliverables expected: ${intent.deliverables.join(', ') || 'complete output as requested'}`
}

// ─── Topological sort ─────────────────────────────────────────────────────────

function topologicalSort(categories: TaskCategory[]): TaskCategory[] {
  const categorySet = new Set(categories)
  const result: TaskCategory[] = []
  const visited = new Set<TaskCategory>()

  function visit(cat: TaskCategory) {
    if (visited.has(cat)) return
    visited.add(cat)
    const deps = DEPENDENCY_RULES[cat] || []
    for (const dep of deps) {
      if (categorySet.has(dep)) visit(dep)
    }
    result.push(cat)
  }

  for (const cat of categories) visit(cat)
  return result
}

/**
 * Returns the optimal primary model for a given template category.
 */
export function getModelForTemplateCategory(templateCategory: string): AIModel {
  const TEMPLATE_MODELS: Record<string, AIModel> = {
    development: 'claude-3-5-sonnet',
    design:      'gpt-image-1',
    marketing:   'claude-3-5-sonnet',
    business:    'gpt-4o',
    content:     'claude-3-5-sonnet',
    research:    'perplexity-sonar',
    learning:    'gemini-2.5-pro',
    personal:    'claude-3-5-sonnet',
  }
  return TEMPLATE_MODELS[templateCategory] || 'claude-3-5-sonnet'
}
