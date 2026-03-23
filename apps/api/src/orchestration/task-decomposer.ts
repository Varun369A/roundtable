import type { ParsedIntent, TaskCategory, AIModel } from '@arivarangam/types'

export interface SubtaskDefinition {
  title: string
  category: TaskCategory
  assignedModel: AIModel
  dependsOn: string[]   // indices into the subtasks array as strings like "0", "1"
  executionOrder: number
  inputInstruction: string  // what this subtask should do
}

/**
 * Routing table — maps category to best model.
 * Rule-based V1. Will become ML-based in Month 9.
 */
export const ROUTING_TABLE: Record<TaskCategory, AIModel> = {
  research:      'perplexity-sonar',
  copywriting:   'claude-3-5-sonnet',
  strategy:      'claude-3-5-sonnet',
  images:        'midjourney-v6',
  video:         'runway-gen3',
  audio:         'elevenlabs',
  presentation:  'gamma',
  code:          'claude-3-5-sonnet',
  translation:   'sarvam-1',
  data_analysis: 'gpt-4o',
  general:       'claude-3-5-sonnet',
}

/**
 * Dependency rules — which categories must wait for which.
 * Key: category that has dependencies
 * Value: categories it depends on
 */
const DEPENDENCY_RULES: Partial<Record<TaskCategory, TaskCategory[]>> = {
  copywriting:   ['research', 'strategy'],
  strategy:      ['research'],
  images:        ['strategy', 'copywriting'],
  video:         ['strategy', 'copywriting'],
  audio:         ['copywriting', 'video'],
  presentation:  ['research', 'strategy', 'copywriting'],
  data_analysis: ['research'],
  translation:   ['copywriting'],
}

export function decomposeTask(intent: ParsedIntent): SubtaskDefinition[] {
  const subtasks: SubtaskDefinition[] = []
  const categoryToIndex = new Map<TaskCategory, number>()

  // Sort categories so dependencies come first
  const sortedCategories = topologicalSort(intent.categories)

  for (let i = 0; i < sortedCategories.length; i++) {
    const category = sortedCategories[i]
    let model = ROUTING_TABLE[category]

    // Language-aware routing: for non-English tasks, route content generation
    // to Sarvam (India-first language model). Strategy/reasoning stays on Claude
    // since logical frameworks are language-agnostic.
    if (intent.language !== 'en') {
      if (category === 'copywriting') model = 'sarvam-1'
    }

    // Resolve dependencies
    const dependencyCategories = DEPENDENCY_RULES[category] || []
    const dependsOn: string[] = []

    for (const depCategory of dependencyCategories) {
      if (categoryToIndex.has(depCategory)) {
        dependsOn.push(String(categoryToIndex.get(depCategory)))
      }
    }

    const subtask: SubtaskDefinition = {
      title: buildSubtaskTitle(category, intent),
      category,
      assignedModel: model,
      dependsOn,
      executionOrder: i,
      inputInstruction: buildInputInstruction(category, intent),
    }

    subtasks.push(subtask)
    categoryToIndex.set(category, i)
  }

  return subtasks
}

/**
 * Topological sort — ensures dependencies execute before dependents.
 * Categories with no dependencies run first (and can run in parallel).
 */
function topologicalSort(categories: TaskCategory[]): TaskCategory[] {
  const categorySet = new Set(categories)
  const result: TaskCategory[] = []
  const visited = new Set<TaskCategory>()

  function visit(cat: TaskCategory) {
    if (visited.has(cat)) return
    visited.add(cat)

    const deps = DEPENDENCY_RULES[cat] || []
    for (const dep of deps) {
      if (categorySet.has(dep)) {
        visit(dep)
      }
    }
    result.push(cat)
  }

  for (const cat of categories) {
    visit(cat)
  }

  return result
}

function buildSubtaskTitle(category: TaskCategory, intent: ParsedIntent): string {
  const templates: Record<TaskCategory, string> = {
    research:      `Research: ${intent.subject}`,
    copywriting:   `Write content: ${intent.subject}`,
    strategy:      `Strategy framework: ${intent.subject}`,
    images:        `Generate visuals for ${intent.subject}`,
    video:         `Video concept for ${intent.subject}`,
    audio:         `Voiceover/audio for ${intent.subject}`,
    presentation:  `Build presentation: ${intent.subject}`,
    code:          `Code/automate: ${intent.subject}`,
    translation:   `Translate content to ${intent.language}`,
    data_analysis: `Analyze data: ${intent.subject}`,
    general:       `Complete: ${intent.subject}`,
  }
  return templates[category] || `${category}: ${intent.subject}`
}

function buildInputInstruction(category: TaskCategory, intent: ParsedIntent): string {
  const audience = intent.audience ? ` for ${intent.audience}` : ''
  const constraints = intent.constraints.length > 0
    ? ` Constraints: ${intent.constraints.join(', ')}.`
    : ''

  const templates: Record<TaskCategory, string> = {
    research:
      `Research ${intent.subject}${audience}. Find current market data, trends, key insights, and relevant statistics. Provide a structured summary with sources.${constraints}`,

    copywriting:
      `Write compelling content about ${intent.subject}${audience}. Use the research and strategy context provided. Deliverables: ${intent.deliverables.join(', ')}.${constraints}`,

    strategy:
      `Create a strategic framework for ${intent.goal}${audience}. Include positioning, key messages, execution approach, and success metrics.${constraints}`,

    images:
      `Generate visual concepts for ${intent.subject}${audience}. Create prompts for high-quality visuals that reflect the strategy and brand tone.${constraints}`,

    video:
      `Create video concept and script for ${intent.subject}${audience}. Include scene descriptions, dialogue, and timing.${constraints}`,

    audio:
      `Generate voiceover script and audio direction for ${intent.subject}. Based on the written content, create a natural-sounding narration.${constraints}`,

    presentation:
      `Build a presentation deck for ${intent.subject}${audience}. Structure: executive summary, research findings, strategy, key messages, next steps.${constraints}`,

    code:
      `Build or automate: ${intent.goal}. Provide clean, well-commented code with setup instructions.${constraints}`,

    translation:
      `Translate the content to ${intent.language}. Maintain tone, meaning, and cultural relevance. Avoid literal translations.${constraints}`,

    data_analysis:
      `Analyze the data related to ${intent.subject}. Provide insights, patterns, and recommendations in a structured format.${constraints}`,

    general:
      `Complete the following task: ${intent.goal}${audience}.${constraints}`,
  }

  return templates[category] || `Complete: ${intent.goal}`
}

/**
 * Returns the optimal primary model for a given TemplateCategory.
 * Used when template category context is known at orchestration time.
 */
export function getModelForTemplateCategory(templateCategory: string): AIModel {
  const TEMPLATE_MODELS: Record<string, AIModel> = {
    development: 'claude-3-5-sonnet',
    design:      'midjourney-v6',
    marketing:   'claude-3-5-sonnet',
    business:    'claude-3-5-sonnet',
    content:     'claude-3-5-sonnet',
    research:    'perplexity-sonar',
    learning:    'gemini-pro',
    personal:    'claude-3-5-sonnet',
  }
  return TEMPLATE_MODELS[templateCategory] || 'claude-3-5-sonnet'
}
