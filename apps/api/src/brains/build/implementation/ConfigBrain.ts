/**
 * ConfigBrain — Generates .env.example and config files from detected env vars.
 * Zero API — scans generated files for process.env references.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from './FileGeneratorBrain'

export interface ConfigBrainInput {
  generatedFiles: GeneratedFile[]
  envVariables: string[]
  language: 'typescript' | 'javascript' | 'python'
}

export interface ConfigBrainOutput {
  envExampleFile: GeneratedFile
  configFile: GeneratedFile | null
  detectedEnvVars: string[]
}

export class ConfigBrain extends Brain<ConfigBrainInput, ConfigBrainOutput> {
  readonly brainName = 'ConfigBrain'
  readonly orchestratorName = 'ImplementationOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: ConfigBrainInput, _ctx: BrainContext): Promise<ConfigBrainOutput> {
    const { generatedFiles, envVariables = [], language } = input

    // Scan all files for process.env or os.environ references
    const allContent = generatedFiles.map(f => f.content).join('\n')
    const envMatches = allContent.match(/process\.env\.(\w+)|os\.environ(?:\.get)?\(['"](\w+)['"]\)/g) || []
    const detectedEnvVars = [...new Set([
      ...envVariables,
      ...envMatches.map(m => m.replace(/process\.env\.|os\.environ\.get\(['"]|os\.environ\['"]/g, '').replace(/['")\]]/g, '')),
    ])].filter(Boolean)

    // Generate .env.example
    const envLines = ['# Environment Variables', '# Copy this to .env and fill in your values', '']
    const categories: Record<string, string[]> = {
      'Application': ['NODE_ENV', 'PORT', 'APP_URL'],
      'Database': ['DATABASE_URL', 'MONGODB_URI'],
      'Authentication': ['JWT_SECRET', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'SESSION_SECRET'],
      'OAuth': ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
      'Other': [],
    }

    const categorized = new Set<string>()
    for (const [category, vars] of Object.entries(categories)) {
      const relevant = detectedEnvVars.filter(v => vars.includes(v))
      if (relevant.length > 0) {
        envLines.push(`# ${category}`)
        for (const v of relevant) {
          envLines.push(`${v}=`)
          categorized.add(v)
        }
        envLines.push('')
      }
    }

    // Any uncategorized
    const uncategorized = detectedEnvVars.filter(v => !categorized.has(v))
    if (uncategorized.length > 0) {
      envLines.push('# Other')
      for (const v of uncategorized) envLines.push(`${v}=`)
    }

    const envExampleContent = envLines.join('\n')
    const envExampleFile: GeneratedFile = {
      path: '.env.example',
      content: envExampleContent,
      language: 'bash',
      linesOfCode: envLines.length,
      purpose: 'Environment variable template',
    }

    return { envExampleFile, configFile: null, detectedEnvVars }
  }

  protected fallback(input: ConfigBrainInput): ConfigBrainOutput {
    return {
      envExampleFile: { path: '.env.example', content: '# Add your environment variables here\n', language: 'bash', linesOfCode: 1, purpose: '.env template' },
      configFile: null,
      detectedEnvVars: input.envVariables,
    }
  }
}
