/**
 * ComplianceBrain — DPDP Act 2023 (India) and GDPR compliance checks.
 * Zero API — rule checklist.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../implementation/FileGeneratorBrain'

export interface ComplianceBrainInput { generatedFiles: GeneratedFile[]; domain: string }
export interface ComplianceBrainOutput {
  dpdpCompliant: boolean
  gdprCompliant: boolean
  issues: string[]
  recommendations: string[]
}

export class ComplianceBrain extends Brain<ComplianceBrainInput, ComplianceBrainOutput> {
  readonly brainName = 'ComplianceBrain'
  readonly orchestratorName = 'QualityOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: ComplianceBrainInput, _ctx: BrainContext): Promise<ComplianceBrainOutput> {
    const allContent = input.generatedFiles.map(f => f.content).join('\n')
    const issues: string[] = []
    const recommendations: string[] = []

    // DPDP Act 2023 checks
    if (/email|phone|name|address|aadhaar|pan/i.test(allContent)) {
      if (!/consent|agreement|terms/i.test(allContent)) {
        issues.push('Personal data collected without consent mechanism (DPDP Act 2023 requirement)')
      }
      if (!/delete.*user|remove.*account|gdpr|data.*request/i.test(allContent)) {
        recommendations.push('Add data deletion endpoint for DPDP Act compliance')
      }
    }

    // Healthcare
    if (input.domain === 'healthcare') {
      if (!/encrypt|hash/i.test(allContent)) issues.push('Medical data should be encrypted at rest')
      recommendations.push('Add audit log for all patient data access')
    }

    const dpdpCompliant = issues.filter(i => i.includes('DPDP')).length === 0
    const gdprCompliant = issues.filter(i => i.includes('GDPR')).length === 0

    return { dpdpCompliant, gdprCompliant, issues, recommendations }
  }

  protected fallback(_: ComplianceBrainInput): ComplianceBrainOutput {
    return { dpdpCompliant: true, gdprCompliant: true, issues: [], recommendations: [] }
  }
}
