/**
 * FallbackBrain — Provides safe fallback output when generation fails completely.
 * Zero API — generates minimal viable scaffolding.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../../build/implementation/FileGeneratorBrain'

export interface FallbackBrainInput {
  goal: string
  mainTechStack: string[]
  projectName: string
  maxRetriesReached: boolean
  healthScore: number
}

export interface FallbackBrainOutput {
  fallbackFiles: GeneratedFile[]
  fallbackReason: string
  isFallback: boolean
}

export class FallbackBrain extends Brain<FallbackBrainInput, FallbackBrainOutput> {
  readonly brainName = 'FallbackBrain'
  readonly orchestratorName = 'ErrorOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: FallbackBrainInput, _ctx: BrainContext): Promise<FallbackBrainOutput> {
    const { goal, mainTechStack, projectName, maxRetriesReached, healthScore } = input

    // Only activate if truly failed
    if (!maxRetriesReached && healthScore >= 40) {
      return { fallbackFiles: [], fallbackReason: '', isFallback: false }
    }

    const isNext = mainTechStack.some(t => t.toLowerCase().includes('next'))
    const isNode = mainTechStack.some(t => ['express', 'fastify', 'node'].some(x => t.toLowerCase().includes(x)))
    const slug = projectName.toLowerCase().replace(/\s+/g, '-')

    const fallbackFiles: GeneratedFile[] = []

    // Minimal package.json
    const pkgJson = JSON.stringify({
      name: slug,
      version: '0.1.0',
      description: goal.slice(0, 100),
      scripts: {
        dev: isNext ? 'next dev' : 'ts-node src/index.ts',
        build: isNext ? 'next build' : 'tsc',
        start: isNext ? 'next start' : 'node dist/index.js',
      },
      dependencies: isNext
        ? { next: '^14.0.0', react: '^18.0.0', 'react-dom': '^18.0.0' }
        : isNode
          ? { express: '^4.18.0', typescript: '^5.0.0' }
          : {},
    }, null, 2)

    fallbackFiles.push({
      path: 'package.json',
      content: pkgJson,
      language: 'json',
      linesOfCode: pkgJson.split('\n').length,
      purpose: 'Package configuration (fallback)',
    })

    // Minimal entry point
    let entryContent = ''
    if (isNext) {
      entryContent = `export default function Home() {\n  return <main><h1>${projectName}</h1><p>Setup incomplete — please regenerate.</p></main>\n}\n`
      fallbackFiles.push({ path: 'app/page.tsx', content: entryContent, language: 'typescript', linesOfCode: 3, purpose: 'Next.js root page (fallback)' })
    } else if (isNode) {
      entryContent = `import express from 'express'\nconst app = express()\napp.get('/health', (_, res) => res.json({ status: 'ok' }))\napp.listen(3001, () => console.log('Running on :3001'))\n`
      fallbackFiles.push({ path: 'src/index.ts', content: entryContent, language: 'typescript', linesOfCode: 4, purpose: 'Server entry point (fallback)' })
    } else {
      entryContent = `// ${projectName}\n// Generation incomplete — please try again.\nconsole.log('Hello from ${projectName}')\n`
      fallbackFiles.push({ path: 'index.ts', content: entryContent, language: 'typescript', linesOfCode: 3, purpose: 'Entry point (fallback)' })
    }

    // README
    const readme = `# ${projectName}\n\n> ${goal.slice(0, 200)}\n\n## Note\n\nThis is a fallback scaffold — automatic generation encountered errors. Please review and complete the implementation.\n`
    fallbackFiles.push({ path: 'README.md', content: readme, language: 'markdown', linesOfCode: readme.split('\n').length, purpose: 'README (fallback)' })

    return {
      fallbackFiles,
      fallbackReason: maxRetriesReached ? 'Maximum retries reached' : 'Health score too low for delivery',
      isFallback: true,
    }
  }

  protected fallback(_: FallbackBrainInput): FallbackBrainOutput {
    return { fallbackFiles: [], fallbackReason: 'Fallback brain failed', isFallback: true }
  }
}
