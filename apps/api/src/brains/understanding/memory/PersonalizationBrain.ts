/**
 * PersonalizationBrain — Final synthesis: combines all memory into one injected context string.
 * Zero API — pure aggregation. This string is injected into every AI prompt.
 */

import { Brain, BrainContext } from '../../base/Brain'

export interface PersonalizationBrainInput {
  memoryContext: string
  name: string
  businessName: string
  techStack: string[]
  writingTone: string
  preferredLanguage: string
  avoidPatterns: string[]
  preferredApproaches: string[]
  stackOverride: string[]
  verbosityLevel: 'low' | 'medium' | 'high'
}

export interface PersonalizationBrainOutput {
  /** Ready-to-inject string for AI prompts — max 400 tokens */
  injectedContext: string
  /** Key facts for architecture decisions */
  keyFacts: Record<string, string>
}

export class PersonalizationBrain extends Brain<PersonalizationBrainInput, PersonalizationBrainOutput> {
  readonly brainName = 'PersonalizationBrain'
  readonly orchestratorName = 'MemoryOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: PersonalizationBrainInput, _ctx: BrainContext): Promise<PersonalizationBrainOutput> {
    const lines: string[] = ['## About This User']

    if (input.name) lines.push(`- Name: ${input.name}`)
    if (input.businessName) lines.push(`- Business: ${input.businessName}`)

    const stack = input.stackOverride.length > 0 ? input.stackOverride : input.techStack
    if (stack.length > 0) lines.push(`- Preferred tech stack: ${stack.join(', ')}`)
    if (input.writingTone) lines.push(`- Preferred tone: ${input.writingTone}`)
    if (input.preferredLanguage && input.preferredLanguage !== 'en') {
      lines.push(`- Preferred language: ${input.preferredLanguage}`)
    }

    if (input.avoidPatterns.length > 0) {
      lines.push(`- Avoid: ${input.avoidPatterns.slice(0, 2).join('; ')}`)
    }
    if (input.preferredApproaches.length > 0) {
      lines.push(`- Prefers: ${input.preferredApproaches.slice(0, 2).join('; ')}`)
    }

    if (input.verbosityLevel === 'low') lines.push('- Skip basic explanations — experienced user')
    else if (input.verbosityLevel === 'high') lines.push('- Include detailed explanations — newer user')

    const injectedContext = lines.join('\n')

    const keyFacts: Record<string, string> = {}
    if (stack.length > 0) keyFacts.techStack = stack.join(', ')
    if (input.writingTone) keyFacts.tone = input.writingTone
    if (input.preferredLanguage) keyFacts.language = input.preferredLanguage

    return { injectedContext, keyFacts }
  }

  protected fallback(_: PersonalizationBrainInput): PersonalizationBrainOutput {
    return { injectedContext: '', keyFacts: {} }
  }
}
