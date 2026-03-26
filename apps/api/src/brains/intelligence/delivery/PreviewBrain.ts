/**
 * PreviewBrain — Prepares live preview metadata and entry point info.
 * Zero API — derives preview config from generated files.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../../build/implementation/FileGeneratorBrain'

export interface PreviewBrainInput {
  generatedFiles: GeneratedFile[]
  architecturePattern: string
  mainTechStack: string[]
  packageJsonScripts: Record<string, string>
}

export interface PreviewBrainOutput {
  previewAvailable: boolean
  previewType: 'nextjs' | 'react-vite' | 'node-api' | 'static' | 'none'
  entryPoint: string | null
  devCommand: string | null
  port: number
  previewNotes: string[]
}

export class PreviewBrain extends Brain<PreviewBrainInput, PreviewBrainOutput> {
  readonly brainName = 'PreviewBrain'
  readonly orchestratorName = 'DeliveryOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: PreviewBrainInput, _ctx: BrainContext): Promise<PreviewBrainOutput> {
    const { generatedFiles, mainTechStack, packageJsonScripts } = input
    const filePaths = generatedFiles.map(f => f.path)
    const previewNotes: string[] = []

    const isNext = mainTechStack.some(t => t.toLowerCase().includes('next')) ||
      filePaths.some(p => p.includes('next.config'))
    const isVite = filePaths.some(p => p.includes('vite.config'))
    const isNode = mainTechStack.some(t => ['express', 'fastify', 'nestjs'].some(x => t.toLowerCase().includes(x)))
    const hasHtml = filePaths.some(p => p.endsWith('.html'))

    let previewType: PreviewBrainOutput['previewType'] = 'none'
    let port = 3000
    let entryPoint: string | null = null
    let devCommand: string | null = null

    if (isNext) {
      previewType = 'nextjs'
      port = 3000
      entryPoint = filePaths.find(p => p.includes('app/page') || p.includes('pages/index')) ?? null
      devCommand = packageJsonScripts['dev'] ? 'npm run dev' : 'npx next dev'
      previewNotes.push('Next.js app — run `npm run dev` and open http://localhost:3000')
    } else if (isVite) {
      previewType = 'react-vite'
      port = 5173
      entryPoint = filePaths.find(p => p.includes('App.tsx') || p.includes('App.jsx') || p.includes('main.tsx')) ?? null
      devCommand = packageJsonScripts['dev'] ? 'npm run dev' : 'npx vite'
      previewNotes.push('Vite app — run `npm run dev` and open http://localhost:5173')
    } else if (isNode) {
      previewType = 'node-api'
      port = 3001
      entryPoint = filePaths.find(p => p.includes('index.ts') || p.includes('main.ts') || p.includes('app.ts')) ?? null
      devCommand = packageJsonScripts['dev'] ? 'npm run dev' : 'npx ts-node src/index.ts'
      previewNotes.push('Node.js API — run `npm run dev` and test endpoints at http://localhost:3001')
    } else if (hasHtml) {
      previewType = 'static'
      port = 8080
      entryPoint = filePaths.find(p => p.endsWith('index.html')) ?? null
      devCommand = 'npx serve .'
      previewNotes.push('Static site — open index.html directly or run `npx serve .`')
    }

    if (!entryPoint) {
      previewNotes.push('No entry point detected — check the file list and run manually')
    }

    return {
      previewAvailable: previewType !== 'none',
      previewType,
      entryPoint,
      devCommand,
      port,
      previewNotes,
    }
  }

  protected fallback(_: PreviewBrainInput): PreviewBrainOutput {
    return {
      previewAvailable: false,
      previewType: 'none',
      entryPoint: null,
      devCommand: null,
      port: 3000,
      previewNotes: [],
    }
  }
}
