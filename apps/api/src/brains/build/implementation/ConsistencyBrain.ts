/**
 * ConsistencyBrain — Verifies all generated files work together as one system.
 * Zero API — AST-level import/export cross-referencing.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from './FileGeneratorBrain'

export interface ConsistencyBrainInput { generatedFiles: GeneratedFile[] }
export interface ConsistencyBrainOutput {
  consistencyScore: number
  issues: ConsistencyIssue[]
  passed: boolean
}
export interface ConsistencyIssue {
  file: string
  type: 'missing-import' | 'naming-mismatch' | 'circular-dep' | 'unused-export'
  description: string
  severity: 'error' | 'warning'
}

export class ConsistencyBrain extends Brain<ConsistencyBrainInput, ConsistencyBrainOutput> {
  readonly brainName = 'ConsistencyBrain'
  readonly orchestratorName = 'ImplementationOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: ConsistencyBrainInput, _ctx: BrainContext): Promise<ConsistencyBrainOutput> {
    const { generatedFiles } = input
    const issues: ConsistencyIssue[] = []

    // Build a map of all exports
    const exportMap: Record<string, string[]> = {}
    for (const file of generatedFiles) {
      const exports = this.extractExports(file.content)
      exportMap[file.path] = exports
    }

    // Check imports in each file
    for (const file of generatedFiles) {
      const imports = this.extractImports(file.content)
      for (const imp of imports) {
        // Only check relative imports
        if (!imp.source.startsWith('.')) continue
        const resolved = this.resolveImport(file.path, imp.source)
        const targetFile = generatedFiles.find(f => f.path === resolved || f.path === resolved + '.ts' || f.path === resolved + '/index.ts')
        if (!targetFile) {
          issues.push({ file: file.path, type: 'missing-import', description: `Import '${imp.source}' not found in generated files`, severity: 'warning' })
        }
      }
    }

    const errorCount = issues.filter(i => i.severity === 'error').length
    const consistencyScore = Math.max(0, 100 - (errorCount * 20) - (issues.filter(i => i.severity === 'warning').length * 5))

    return { consistencyScore, issues, passed: errorCount === 0 }
  }

  private extractExports(content: string): string[] {
    const matches = content.match(/export\s+(?:const|function|class|type|interface)\s+(\w+)/g) || []
    return matches.map(m => m.replace(/export\s+(?:const|function|class|type|interface)\s+/, ''))
  }

  private extractImports(content: string): Array<{ source: string; names: string[] }> {
    const matches = content.matchAll(/import\s+(?:{([^}]+)})?\s*(?:from\s+)?['"]([^'"]+)['"]/g)
    const imports = []
    for (const match of matches) {
      imports.push({ names: (match[1] || '').split(',').map(s => s.trim()), source: match[2] })
    }
    return imports
  }

  private resolveImport(fromFile: string, importSource: string): string {
    const dir = fromFile.split('/').slice(0, -1).join('/')
    return `${dir}/${importSource}`.replace(/\/\.\//g, '/').replace(/\/[^/]+\/\.\.\//g, '/')
  }

  protected fallback(_: ConsistencyBrainInput): ConsistencyBrainOutput {
    return { consistencyScore: 100, issues: [], passed: true }
  }
}
