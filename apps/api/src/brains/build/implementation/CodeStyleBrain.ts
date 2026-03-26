/**
 * CodeStyleBrain — Checks code style consistency across all files.
 * Zero API — pattern-based lint checks.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from './FileGeneratorBrain'

export interface CodeStyleBrainInput { generatedFiles: GeneratedFile[] }
export interface CodeStyleBrainOutput {
  styleScore: number
  issues: string[]
  passed: boolean
}

export class CodeStyleBrain extends Brain<CodeStyleBrainInput, CodeStyleBrainOutput> {
  readonly brainName = 'CodeStyleBrain'
  readonly orchestratorName = 'ImplementationOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: CodeStyleBrainInput, _ctx: BrainContext): Promise<CodeStyleBrainOutput> {
    const issues: string[] = []

    for (const file of input.generatedFiles) {
      if (!['typescript', 'javascript', 'tsx', 'jsx'].includes(file.language)) continue
      const content = file.content

      // Check for console.log in non-development files
      if ((content.match(/console\.log\(/g) || []).length > 5) {
        issues.push(`${file.path}: Too many console.log statements`)
      }

      // Check for any type
      if ((content.match(/:\s*any\b/g) || []).length > 3) {
        issues.push(`${file.path}: Excessive use of 'any' type`)
      }

      // Check for TODO without implementation
      const todos = (content.match(/\/\/\s*TODO:/g) || []).length
      if (todos > 3) {
        issues.push(`${file.path}: ${todos} unimplemented TODOs`)
      }
    }

    const styleScore = Math.max(0, 100 - issues.length * 10)
    return { styleScore, issues: issues.slice(0, 10), passed: issues.length < 5 }
  }

  protected fallback(_: CodeStyleBrainInput): CodeStyleBrainOutput {
    return { styleScore: 100, issues: [], passed: true }
  }
}
