/**
 * GateBrain — Final pass/fail gate. Decides if output moves forward.
 * Zero API — score threshold logic.
 *
 * PASS  (score >= 70, no CRITICAL) → proceed to delivery
 * FAIL  (score < 70 or CRITICAL)   → send back to ImplementationBrain with fix instructions
 */

import { Brain, BrainContext } from '../../base/Brain'

export interface GateBrainInput {
  overallScore: number
  securityScore: number
  criticalIssues: Array<{ file: string; type: string; fix: string }>
  coverageScore: number
  consistencyScore: number
  integrationPassed: boolean
  authScore: number
  hasAuthRequirement: boolean
}

export interface GateBrainOutput {
  decision: 'PASS' | 'WARN' | 'FAIL'
  passed: boolean
  reasons: string[]
  fixInstructions: string[]
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export class GateBrain extends Brain<GateBrainInput, GateBrainOutput> {
  readonly brainName = 'GateBrain'
  readonly orchestratorName = 'QualityOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: GateBrainInput, _ctx: BrainContext): Promise<GateBrainOutput> {
    const { overallScore, securityScore, criticalIssues, coverageScore, consistencyScore, integrationPassed, authScore, hasAuthRequirement } = input
    const reasons: string[] = []
    const fixInstructions: string[] = []

    // Hard blockers
    if (criticalIssues.length > 0) {
      reasons.push(`${criticalIssues.length} CRITICAL security issue(s) found`)
      for (const issue of criticalIssues.slice(0, 3)) {
        fixInstructions.push(`[${issue.type}] in ${issue.file}: ${issue.fix}`)
      }
    }

    if (!integrationPassed) {
      reasons.push('Integration check failed — missing entry point or package.json')
      fixInstructions.push('Ensure an application entry point (index.ts / page.tsx) exists')
    }

    if (hasAuthRequirement && authScore < 50) {
      reasons.push('Authentication implementation incomplete')
      fixInstructions.push('Add JWT token generation and verification to auth routes')
    }

    // Soft warnings
    if (coverageScore < 60) reasons.push(`Requirements coverage low: ${coverageScore}%`)
    if (consistencyScore < 60) reasons.push(`File consistency issues detected: ${consistencyScore}/100`)

    // Decision
    const hasCriticalBlocker = criticalIssues.length > 0 || !integrationPassed
    let decision: GateBrainOutput['decision'] = 'PASS'
    if (hasCriticalBlocker || overallScore < 50) decision = 'FAIL'
    else if (overallScore < 70 || reasons.length > 2) decision = 'WARN'

    // Grade
    let qualityGrade: GateBrainOutput['qualityGrade'] = 'F'
    if (overallScore >= 90) qualityGrade = 'A'
    else if (overallScore >= 80) qualityGrade = 'B'
    else if (overallScore >= 70) qualityGrade = 'C'
    else if (overallScore >= 50) qualityGrade = 'D'

    return { decision, passed: decision !== 'FAIL', reasons, fixInstructions, qualityGrade }
  }

  protected fallback(_: GateBrainInput): GateBrainOutput {
    return { decision: 'WARN', passed: true, reasons: [], fixInstructions: [], qualityGrade: 'C' }
  }
}
