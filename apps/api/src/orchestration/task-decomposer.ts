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

// ─── Specialist Matrix ────────────────────────────────────────────────────────
// Each category defines an ordered list of specialist slots.
// Slots activate based on task complexity:
//   simple   → only 'simple' slots   → 1 specialist  + Arivarangam (~30s)
//   standard → simple + standard     → 2 specialists + Arivarangam (~60s)
//   complex  → all slots             → 3 specialists + Arivarangam (~90s)
//
// Arivarangam AI is always the final synthesiser — never listed here.

export type SpecialistRole = 'architect' | 'researcher' | 'analyst' | 'implementer' | 'writer' | 'reviewer'
type Complexity = 'simple' | 'standard' | 'complex'

export interface SpecialistSlot {
  model:         AIModel
  role:          SpecialistRole
  minComplexity: Complexity
}

const COMPLEXITY_RANK: Record<Complexity, number> = { simple: 0, standard: 1, complex: 2 }

export const SPECIALIST_MATRIX: Record<TaskCategory, SpecialistSlot[]> = {
  code: [
    { model: 'gpt-4o',            role: 'architect',   minComplexity: 'simple'   }, // architecture + file structure
    { model: 'perplexity-sonar',  role: 'researcher',  minComplexity: 'standard' }, // best libraries, npm packages
    { model: 'claude-3-5-sonnet', role: 'implementer', minComplexity: 'complex'  }, // code patterns, security, tests
  ],
  research: [
    { model: 'perplexity-sonar',  role: 'researcher',  minComplexity: 'simple'   }, // real-time web research
    { model: 'gemini-2.5-pro',    role: 'analyst',     minComplexity: 'standard' }, // deep long-context analysis
    { model: 'gpt-4o',            role: 'reviewer',    minComplexity: 'complex'  }, // structured synthesis
  ],
  content: [
    { model: 'claude-3-5-sonnet', role: 'writer',      minComplexity: 'simple'   }, // nuanced writing, tone
    { model: 'perplexity-sonar',  role: 'researcher',  minComplexity: 'standard' }, // facts, stats, references
    { model: 'gpt-4o',            role: 'reviewer',    minComplexity: 'complex'  }, // structure, argument review
  ],
  strategy: [
    { model: 'gpt-4o',            role: 'architect',   minComplexity: 'simple'   }, // strategic framework
    { model: 'perplexity-sonar',  role: 'researcher',  minComplexity: 'standard' }, // market research
    { model: 'gemini-2.5-pro',    role: 'analyst',     minComplexity: 'complex'  }, // risk + opportunity analysis
  ],
  data_analysis: [
    { model: 'gemini-2.5-pro',    role: 'analyst',     minComplexity: 'simple'   }, // long-context data analysis
    { model: 'gpt-4o',            role: 'reviewer',    minComplexity: 'standard' }, // structured interpretation
    { model: 'perplexity-sonar',  role: 'researcher',  minComplexity: 'complex'  }, // real-world benchmarks
  ],
  general: [
    { model: 'gpt-4o',            role: 'architect',   minComplexity: 'simple'   }, // broad reasoning
    { model: 'perplexity-sonar',  role: 'researcher',  minComplexity: 'standard' }, // factual grounding
    { model: 'claude-3-5-sonnet', role: 'analyst',     minComplexity: 'complex'  }, // depth + nuance
  ],
  image:       [{ model: 'gpt-image-1', role: 'architect', minComplexity: 'simple' }],
  voice:       [{ model: 'elevenlabs',  role: 'architect', minComplexity: 'simple' }],
  translation: [
    { model: 'sarvam-1',          role: 'writer',      minComplexity: 'simple'   }, // Indian language translation
    { model: 'claude-3-5-sonnet', role: 'reviewer',    minComplexity: 'standard' }, // quality + cultural accuracy
  ],
}

// Legacy export — kept for any code that imports ROUTING_TABLE directly
export const ROUTING_TABLE: Record<TaskCategory, AIModel> = Object.fromEntries(
  Object.entries(SPECIALIST_MATRIX).map(([cat, slots]) => [cat, slots[0].model])
) as Record<TaskCategory, AIModel>

// ─── Dependency rules ────────────────────────────────────────────────────────
const DEPENDENCY_RULES: Partial<Record<TaskCategory, TaskCategory[]>> = {
  content:       ['research'],
  strategy:      ['research'],
  data_analysis: ['research'],
  translation:   ['content'],
}

/**
 * Decomposes a parsed intent into a subtask DAG using the specialist matrix.
 *
 * Routing tiers (driven by complexity detected in intent parser):
 *   simple   → 1 specialist  + Arivarangam  (~30s)
 *   standard → 2 specialists + Arivarangam  (~60s)
 *   complex  → 3 specialists + Arivarangam  (~90s)
 *
 * Each category has its own specialist matrix — only AIs that genuinely help
 * with that domain are included. Arivarangam AI is always the final builder.
 */
export function decomposeTask(intent: ParsedIntent): SubtaskDefinition[] {
  const subtasks: SubtaskDefinition[] = []

  const complexity: Complexity = (intent as any).complexity ?? 'standard'
  const complexityRank = COMPLEXITY_RANK[complexity]

  // Cap categories: simple/standard → 1 category, complex → up to 2
  const maxCategories = complexity === 'complex' ? 2 : 1
  const sortedCategories = topologicalSort(intent.categories).slice(0, maxCategories)

  const categoryToIndex = new Map<TaskCategory, number>()

  for (const category of sortedCategories) {
    // Resolve category dependencies
    const depCategories = DEPENDENCY_RULES[category] || []
    const dependsOn: string[] = []
    for (const depCat of depCategories) {
      if (categoryToIndex.has(depCat)) {
        dependsOn.push(String(categoryToIndex.get(depCat)))
      }
    }

    // Get active specialists for this category × complexity
    let activeSlots = (SPECIALIST_MATRIX[category] || []).filter(
      (slot) => COMPLEXITY_RANK[slot.minComplexity] <= complexityRank
    )

    // Indian language content → swap first writer slot to Sarvam
    if (intent.language !== 'en' && category === 'content') {
      activeSlots = activeSlots.map((s, idx) =>
        idx === 0 ? { ...s, model: 'sarvam-1' as AIModel } : s
      )
    }

    // Deduplicate: if two slots resolved to the same model, keep first only
    const seenModels = new Set<AIModel>()
    const uniqueSlots = activeSlots.filter((s) => {
      if (seenModels.has(s.model)) return false
      seenModels.add(s.model)
      return true
    })

    // Add a subtask for each active specialist
    for (const slot of uniqueSlots) {
      const isFirst = !categoryToIndex.has(category)
      subtasks.push({
        title:            buildSubtaskTitle(category, intent, slot.model, isFirst ? 'primary' : 'consult'),
        category,
        assignedModel:    slot.model,
        dependsOn,
        executionOrder:   subtasks.length,
        inputInstruction: buildSpecialistInstruction(category, intent, slot),
        role:             'INITIAL',
      })
      if (isFirst) categoryToIndex.set(category, subtasks.length - 1)
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

/**
 * Unified instruction builder — uses the slot role + model to craft
 * a precise prompt that matches each specialist's actual strength.
 */
function buildSpecialistInstruction(
  category: TaskCategory,
  intent: ParsedIntent,
  slot: SpecialistSlot,
): string {
  const audience    = intent.audience ? ` for ${intent.audience}` : ''
  const constraints = intent.constraints.length > 0
    ? ` Constraints: ${intent.constraints.join(', ')}.` : ''
  const g = intent.goal
  const s = intent.subject

  // ── Role × Model instructions ─────────────────────────────────────────────

  if (slot.role === 'architect') {
    if (category === 'code') {
      return `You are the architecture and planning specialist. Goal: "${g}"${audience}. Provide: (1) recommended tech stack with justification, (2) complete file/folder structure, (3) step-by-step implementation plan — what each file does, (4) key data flows and algorithms. Do NOT write full code yet. Arivarangam AI will code from your plan.${constraints}`
    }
    if (category === 'strategy') {
      return `You are the strategy specialist. Create a strategic framework for: "${g}"${audience}. Include positioning, key messages, execution approach, KPIs and success metrics.${constraints}`
    }
    return `You are the primary specialist. Complete: "${g}"${audience}.${constraints}`
  }

  if (slot.role === 'researcher') {
    if (category === 'code' || category === 'general') {
      return `You are the research specialist for a coding project: "${g}". Find: (1) best libraries/frameworks with exact npm install commands and version numbers, (2) open-source references and GitHub repos, (3) common pitfalls and how to avoid them, (4) production deployment considerations. Arivarangam AI will use your findings to write the code.${constraints}`
    }
    return `You are the research specialist. Research "${s}"${audience}. Find current data, trends, key statistics, and real-world examples with sources. Be specific and cite where possible.${constraints}`
  }

  if (slot.role === 'analyst') {
    if (category === 'data_analysis') {
      return `You are the data analysis specialist. Analyze data about "${s}"${audience}. Identify patterns, anomalies, and trends. Produce actionable insights and specific recommendations.${constraints}`
    }
    return `You are the deep analysis specialist. Provide strategic analysis for: "${g}"${audience}. Cover long-term implications, risks, opportunities, and second-order effects.${constraints}`
  }

  if (slot.role === 'implementer') {
    // Claude as code implementer: concrete patterns and snippets
    return `You are the code quality and implementation specialist for: "${g}". Provide: (1) recommended code patterns and architecture best practices specific to this use case, (2) security considerations with implementation examples, (3) error handling strategies and edge cases, (4) testing approach and key test cases, (5) performance optimisations. Include concrete code snippets for the trickiest parts. Arivarangam AI will use your guidance to write the complete codebase.${constraints}`
  }

  if (slot.role === 'writer') {
    if (slot.model === 'sarvam-1') {
      return `You are the language specialist. Translate the following to ${intent.language}, maintaining tone and cultural relevance: "${g}"${constraints}`
    }
    return `You are the writing specialist. Write compelling, polished content about "${s}"${audience}. Deliverables: ${intent.deliverables.join(', ') || 'complete written content'}.${constraints}`
  }

  if (slot.role === 'reviewer') {
    if (category === 'translation') {
      return `You are the translation quality reviewer. Review the translated content for "${s}" to ${intent.language}. Check for accuracy, natural flow, cultural appropriateness, and any mistranslations. Provide a corrected and polished version.${constraints}`
    }
    return `You are the quality and structure reviewer. Review and strengthen the approach for: "${g}"${audience}. Focus on logical structure, completeness, and what the primary specialist may have missed.${constraints}`
  }

  return `You are a specialist. Complete: "${g}"${audience}.${constraints}`
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
