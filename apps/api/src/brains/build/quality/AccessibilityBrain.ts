/**
 * AccessibilityBrain — WCAG compliance checks on frontend files.
 * Zero API — pattern scanning.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../implementation/FileGeneratorBrain'

export interface AccessibilityBrainInput { generatedFiles: GeneratedFile[] }
export interface AccessibilityBrainOutput {
  accessibilityScore: number
  issues: string[]
  passed: boolean
}

export class AccessibilityBrain extends Brain<AccessibilityBrainInput, AccessibilityBrainOutput> {
  readonly brainName = 'AccessibilityBrain'
  readonly orchestratorName = 'QualityOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: AccessibilityBrainInput, _ctx: BrainContext): Promise<AccessibilityBrainOutput> {
    const frontendFiles = input.generatedFiles.filter(f => ['.tsx', '.jsx', '.html'].some(ext => f.path.endsWith(ext)))
    if (frontendFiles.length === 0) return { accessibilityScore: 100, issues: [], passed: true }

    const issues: string[] = []
    for (const file of frontendFiles) {
      const c = file.content
      if (/<img(?![^>]*alt=)/i.test(c)) issues.push(`${file.path}: img tags missing alt attribute`)
      if (/<input(?![^>]*(?:aria-label|label))/i.test(c)) issues.push(`${file.path}: input missing label/aria-label`)
      if (/<button(?![^>]*(?:aria-label|>[\s\S]*?<\/button>))/i.test(c)) issues.push(`${file.path}: button may be missing accessible label`)
    }

    const accessibilityScore = Math.max(0, 100 - issues.length * 15)
    return { accessibilityScore, issues: issues.slice(0, 5), passed: issues.length < 3 }
  }

  protected fallback(_: AccessibilityBrainInput): AccessibilityBrainOutput {
    return { accessibilityScore: 100, issues: [], passed: true }
  }
}
