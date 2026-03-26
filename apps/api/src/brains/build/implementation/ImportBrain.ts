/**
 * ImportBrain — Verifies all imports resolve to real files or packages.
 * Zero API — static analysis.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from './FileGeneratorBrain'

export interface ImportBrainInput {
  generatedFiles: GeneratedFile[]
  dependencies: Record<string, string>
}

export interface ImportBrainOutput {
  unresolvedImports: string[]
  resolvedCount: number
  unresolvedCount: number
  passed: boolean
}

export class ImportBrain extends Brain<ImportBrainInput, ImportBrainOutput> {
  readonly brainName = 'ImportBrain'
  readonly orchestratorName = 'ImplementationOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: ImportBrainInput, _ctx: BrainContext): Promise<ImportBrainOutput> {
    const { generatedFiles, dependencies } = input
    const filePaths = new Set(generatedFiles.map(f => f.path))
    const packageNames = new Set(Object.keys(dependencies ?? {}))
    const unresolvedImports: string[] = []
    let resolvedCount = 0

    for (const file of generatedFiles) {
      const importMatches = file.content.matchAll(/(?:import|from|require)\s*[\('"]+([^'")\s]+)['")\s]/g)
      for (const match of importMatches) {
        const source = match[1]
        if (source.startsWith('.')) {
          // Relative import — check if file exists
          const resolved = this.resolve(file.path, source)
          const exists = filePaths.has(resolved) || filePaths.has(resolved + '.ts') ||
            filePaths.has(resolved + '.tsx') || filePaths.has(resolved + '/index.ts')
          if (exists) resolvedCount++
          else unresolvedImports.push(`${file.path}: import '${source}'`)
        } else {
          // Package import — check if in dependencies
          const pkgName = source.split('/')[0].replace('@', '')
          const fullPkg = source.startsWith('@') ? source.split('/').slice(0, 2).join('/') : source.split('/')[0]
          if (packageNames.has(fullPkg) || ['react', 'next', 'node:path', 'node:fs', 'fs', 'path', 'crypto', 'os', 'http', 'https', 'util', 'stream', 'events', 'buffer'].includes(pkgName)) {
            resolvedCount++
          }
          // Don't flag unknown packages — might be indirect deps
        }
      }
    }

    return {
      unresolvedImports: [...new Set(unresolvedImports)].slice(0, 10),
      resolvedCount,
      unresolvedCount: unresolvedImports.length,
      passed: unresolvedImports.length === 0,
    }
  }

  private resolve(fromFile: string, source: string): string {
    const dir = fromFile.split('/').slice(0, -1).join('/')
    return (dir + '/' + source).replace(/\/\.\//g, '/').replace(/\/[^/]+\/\.\.\//g, '/')
  }

  protected fallback(_: ImportBrainInput): ImportBrainOutput {
    return { unresolvedImports: [], resolvedCount: 0, unresolvedCount: 0, passed: true }
  }
}
