/**
 * PreferenceBrain — Reads tech stack, language and style preferences.
 * Zero API — DB read.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface PreferenceBrainInput { userId: string }
export interface PreferenceBrainOutput {
  techStack: string[]
  preferredLanguage: string
  outputFormat: string
  writingTone: string
  codingStyle: string
}

const PREF_KEYS = ['tech_stack', 'coding_language', 'framework', 'output_format', 'writing_tone', 'language']

export class PreferenceBrain extends Brain<PreferenceBrainInput, PreferenceBrainOutput> {
  readonly brainName = 'PreferenceBrain'
  readonly orchestratorName = 'MemoryOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: PreferenceBrainInput, _ctx: BrainContext): Promise<PreferenceBrainOutput> {
    const memories = await prisma.userMemory.findMany({
      where: { userId: input.userId, key: { in: PREF_KEYS }, isActive: true },
    })

    const get = (key: string) => memories.find(m => m.key === key)?.value || ''

    const techStackRaw = get('tech_stack')
    const techStack = techStackRaw ? techStackRaw.split(',').map(s => s.trim()).filter(Boolean) : []

    return {
      techStack,
      preferredLanguage: get('language') || 'en',
      outputFormat: get('output_format') || 'markdown',
      writingTone: get('writing_tone') || 'professional',
      codingStyle: get('coding_language') || 'typescript',
    }
  }

  protected fallback(_: PreferenceBrainInput): PreferenceBrainOutput {
    return { techStack: [], preferredLanguage: 'en', outputFormat: 'markdown', writingTone: 'professional', codingStyle: 'typescript' }
  }
}
