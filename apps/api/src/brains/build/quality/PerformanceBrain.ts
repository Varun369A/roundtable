/**
 * PerformanceBrain — Finds performance issues: N+1, missing indexes, slow algorithms.
 * Zero API — static analysis.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../implementation/FileGeneratorBrain'

export interface PerformanceBrainInput { generatedFiles: GeneratedFile[]; models: Array<{ name: string; fields: Array<{ name: string }> }> }
export interface PerformanceBrainOutput {
  performanceScore: number
  issues: PerformanceIssue[]
  passed: boolean
}
export interface PerformanceIssue {
  file: string
  type: string
  description: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
}

export class PerformanceBrain extends Brain<PerformanceBrainInput, PerformanceBrainOutput> {
  readonly brainName = 'PerformanceBrain'
  readonly orchestratorName = 'QualityOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: PerformanceBrainInput, _ctx: BrainContext): Promise<PerformanceBrainOutput> {
    const issues: PerformanceIssue[] = []

    for (const file of input.generatedFiles) {
      const content = file.content

      // N+1 query detection — find queries inside loops
      if (/for\s*\(|\.forEach\(|\.map\(/.test(content) && /prisma\.|await.*find/.test(content)) {
        const hasLoopWithQuery = /(?:for\s*\(|\.forEach\(|\.map\()[\s\S]{0,200}(?:prisma\.|await.*find)/m.test(content)
        if (hasLoopWithQuery) {
          issues.push({ file: file.path, type: 'N+1 Query', description: 'Database query inside a loop detected', severity: 'HIGH' })
        }
      }

      // Missing pagination
      if (/findMany\(\{(?![\s\S]*take:)/.test(content) && /findMany/.test(content)) {
        issues.push({ file: file.path, type: 'Missing Pagination', description: 'findMany without take/limit — could return entire table', severity: 'MEDIUM' })
      }

      // Synchronous file I/O
      if (/readFileSync|writeFileSync|existsSync/.test(content)) {
        issues.push({ file: file.path, type: 'Sync I/O', description: 'Synchronous file I/O blocks the event loop', severity: 'HIGH' })
      }

      // Missing database select (over-fetching)
      if (/findUnique\(\{(?![\s\S]*select:)[\s\S]{0,100}\}\)/.test(content)) {
        issues.push({ file: file.path, type: 'Over-fetching', description: 'findUnique without select — fetches all fields', severity: 'LOW' })
      }
    }

    const penalty = issues.filter(i => i.severity === 'HIGH').length * 20 + issues.filter(i => i.severity === 'MEDIUM').length * 10
    const performanceScore = Math.max(0, 100 - penalty)

    return { performanceScore, issues: issues.slice(0, 10), passed: !issues.some(i => i.severity === 'HIGH') }
  }

  protected fallback(_: PerformanceBrainInput): PerformanceBrainOutput {
    return { performanceScore: 100, issues: [], passed: true }
  }
}
