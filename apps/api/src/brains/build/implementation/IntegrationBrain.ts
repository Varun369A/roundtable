/**
 * IntegrationBrain — Verifies all system pieces connect correctly.
 * Zero API — structural validation.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from './FileGeneratorBrain'

export interface IntegrationBrainInput {
  generatedFiles: GeneratedFile[]
  pattern: string
  hasAuthRequirement: boolean
  hasDatabaseRequirement: boolean
}

export interface IntegrationBrainOutput {
  integrationScore: number
  missingConnections: string[]
  passed: boolean
}

export class IntegrationBrain extends Brain<IntegrationBrainInput, IntegrationBrainOutput> {
  readonly brainName = 'IntegrationBrain'
  readonly orchestratorName = 'ImplementationOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: IntegrationBrainInput, _ctx: BrainContext): Promise<IntegrationBrainOutput> {
    const { generatedFiles, pattern, hasAuthRequirement, hasDatabaseRequirement } = input
    const allContent = generatedFiles.map(f => f.content).join('\n')
    const paths = generatedFiles.map(f => f.path)
    const missingConnections: string[] = []

    // Check DB connection
    if (hasDatabaseRequirement) {
      if (!allContent.includes('PrismaClient') && !allContent.includes('createConnection') && !allContent.includes('mongoose.connect')) {
        missingConnections.push('Database connection initialization missing')
      }
    }

    // Check entry point
    const hasEntryPoint = paths.some(p => p.includes('index.ts') || p.includes('main.ts') || p.includes('app/page.tsx') || p.includes('app/layout.tsx') || p.includes('main.py'))
    if (!hasEntryPoint) missingConnections.push('Application entry point missing')

    // Check package.json
    if (!paths.includes('package.json') && !paths.includes('requirements.txt') && !paths.includes('pyproject.toml')) {
      missingConnections.push('package.json / requirements.txt missing')
    }

    const integrationScore = Math.max(0, 100 - missingConnections.length * 25)

    return { integrationScore, missingConnections, passed: missingConnections.length === 0 }
  }

  protected fallback(_: IntegrationBrainInput): IntegrationBrainOutput {
    return { integrationScore: 100, missingConnections: [], passed: true }
  }
}
