/**
 * ExplainerBrain — Translates technical errors into plain-language explanations for users.
 * Zero API — template-based translation.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { ClassifiedError } from './ErrorClassificationBrain'
import type { Diagnosis } from './DiagnosticBrain'

export interface ExplainerBrainInput {
  errors: ClassifiedError[]
  diagnoses: Diagnosis[]
  healthScore: number
  fixCount: number
  escalated: boolean
  userMessage: string
}

export interface ExplainerBrainOutput {
  plainEnglishSummary: string
  actionItems: string[]
  severity: 'none' | 'minor' | 'moderate' | 'serious'
  showToUser: boolean
}

export class ExplainerBrain extends Brain<ExplainerBrainInput, ExplainerBrainOutput> {
  readonly brainName = 'ExplainerBrain'
  readonly orchestratorName = 'ErrorOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: ExplainerBrainInput, _ctx: BrainContext): Promise<ExplainerBrainOutput> {
    const { errors, diagnoses, healthScore, fixCount, escalated, userMessage } = input

    const criticalCount = errors.filter(e => e.severity === 'critical').length
    const highCount = errors.filter(e => e.severity === 'high').length
    const totalCount = errors.length

    // Determine overall severity
    let severity: ExplainerBrainOutput['severity'] = 'none'
    if (escalated || criticalCount > 0) severity = 'serious'
    else if (highCount > 0 || healthScore < 60) severity = 'moderate'
    else if (totalCount > 0) severity = 'minor'

    // Build plain-english summary
    let plainEnglishSummary = ''
    if (severity === 'none' || totalCount === 0) {
      plainEnglishSummary = fixCount > 0
        ? `The code was generated successfully. ${fixCount} minor issue(s) were automatically fixed.`
        : 'The code was generated successfully with no issues detected.'
    } else if (severity === 'minor') {
      plainEnglishSummary = `The code looks good overall (score: ${healthScore}/100). Found ${totalCount} minor style issue(s)${fixCount > 0 ? `, ${fixCount} were auto-fixed` : ''}.`
    } else if (severity === 'moderate') {
      plainEnglishSummary = `The code has some issues to address (score: ${healthScore}/100). Found ${highCount} notable problem(s) in the generated files${fixCount > 0 ? `, ${fixCount} were fixed automatically` : ''}.`
    } else {
      plainEnglishSummary = userMessage || `The generated code has serious issues (score: ${healthScore}/100) that need attention before it can be used.`
    }

    // Action items
    const actionItems: string[] = []
    if (escalated) {
      actionItems.push('Try breaking your request into smaller, more specific goals')
      actionItems.push('Review the error report for specific issues to address')
    }
    for (const d of diagnoses.slice(0, 3)) {
      actionItems.push(d.recommendation)
    }
    if (actionItems.length === 0 && totalCount > 0) {
      actionItems.push('Review the generated files before running in production')
    }

    const showToUser = severity !== 'none' || fixCount > 0

    return { plainEnglishSummary, actionItems, severity, showToUser }
  }

  protected fallback(_: ExplainerBrainInput): ExplainerBrainOutput {
    return {
      plainEnglishSummary: 'Code generation complete.',
      actionItems: [],
      severity: 'none',
      showToUser: false,
    }
  }
}
