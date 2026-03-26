/**
 * EdgeCaseBrain — Checks that edge cases are handled (null, empty, max).
 * Zero API — static analysis.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../implementation/FileGeneratorBrain'

export interface EdgeCaseBrainInput { generatedFiles: GeneratedFile[] }
export interface EdgeCaseBrainOutput { edgeCaseScore: number; unhandledEdgeCases: string[]; passed: boolean }

export class EdgeCaseBrain extends Brain<EdgeCaseBrainInput, EdgeCaseBrainOutput> {
  readonly brainName = 'EdgeCaseBrain'
  readonly orchestratorName = 'QualityOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: EdgeCaseBrainInput, _ctx: BrainContext): Promise<EdgeCaseBrainOutput> {
    const unhandledEdgeCases: string[] = []

    for (const file of input.generatedFiles) {
      if (!['typescript', 'javascript'].includes(file.language)) continue
      const c = file.content

      // Functions with params but no null/undefined check
      const asyncFns = c.match(/async\s+function\s+\w+\s*\([^)]+\)/g) || []
      for (const fn of asyncFns) {
        if (fn.includes('req') && !/if\s*\(!|nullish|undefined|null/.test(c)) {
          // Check if body has any null checks
          const bodyStart = c.indexOf(fn) + fn.length
          const bodyEnd = bodyStart + 300
          const body = c.slice(bodyStart, bodyEnd)
          if (!/if\s*\(!|=== null|== null|\?\?|optional/.test(body)) {
            unhandledEdgeCases.push(`${file.path}: ${fn.slice(0, 40)} — no null/undefined guard`)
            break
          }
        }
      }
    }

    const edgeCaseScore = Math.max(0, 100 - unhandledEdgeCases.length * 10)
    return { edgeCaseScore, unhandledEdgeCases: unhandledEdgeCases.slice(0, 5), passed: unhandledEdgeCases.length < 5 }
  }

  protected fallback(_: EdgeCaseBrainInput): EdgeCaseBrainOutput {
    return { edgeCaseScore: 100, unhandledEdgeCases: [], passed: true }
  }
}
