/**
 * DiagnosticBrain — Diagnoses root causes behind error patterns.
 * Zero API — pattern correlation logic.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { ClassifiedError } from './ErrorClassificationBrain'

export interface DiagnosticBrainInput {
  classified: ClassifiedError[]
  overallScore: number
  totalFiles: number
}

export interface Diagnosis {
  rootCause: string
  affectedFiles: string[]
  pattern: string
  recommendation: string
}

export interface DiagnosticBrainOutput {
  diagnoses: Diagnosis[]
  systemicIssues: string[]
  healthScore: number
}

export class DiagnosticBrain extends Brain<DiagnosticBrainInput, DiagnosticBrainOutput> {
  readonly brainName = 'DiagnosticBrain'
  readonly orchestratorName = 'ErrorOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: DiagnosticBrainInput, _ctx: BrainContext): Promise<DiagnosticBrainOutput> {
    const { classified, overallScore, totalFiles } = input
    const diagnoses: Diagnosis[] = []
    const systemicIssues: string[] = []

    // Group by error type to find patterns
    const byType = new Map<string, ClassifiedError[]>()
    for (const err of classified) {
      if (!byType.has(err.type)) byType.set(err.type, [])
      byType.get(err.type)!.push(err)
    }

    // Systemic: same error in 3+ files = architectural problem
    for (const [type, errors] of byType) {
      const files = [...new Set(errors.map(e => e.file))]
      if (files.length >= 3) {
        systemicIssues.push(`${type} appears in ${files.length} files — likely missing a shared error handler`)
      }
      if (errors.length >= 2) {
        diagnoses.push({
          rootCause: this.getRootCause(type),
          affectedFiles: files.slice(0, 5),
          pattern: type,
          recommendation: this.getRecommendation(type),
        })
      }
    }

    // Single critical errors always get a diagnosis
    for (const err of classified.filter(e => e.severity === 'critical')) {
      const alreadyDiagnosed = diagnoses.some(d => d.pattern === err.type)
      if (!alreadyDiagnosed) {
        diagnoses.push({
          rootCause: this.getRootCause(err.type),
          affectedFiles: [err.file],
          pattern: err.type,
          recommendation: this.getRecommendation(err.type),
        })
      }
    }

    const errorPenalty = Math.min(40, classified.length * 3)
    const healthScore = Math.max(0, overallScore - errorPenalty)

    return { diagnoses: diagnoses.slice(0, 8), systemicIssues, healthScore }
  }

  private getRootCause(type: string): string {
    const causes: Record<string, string> = {
      EMPTY_CATCH: 'Missing error propagation — errors silently discarded',
      SWALLOWED_ERROR: 'Error logged but not re-thrown — caller unaware of failure',
      UNHANDLED_PROMISE: 'Promise chain missing rejection handler',
      UNSAFE_JSON_PARSE: 'No defensive parsing — malformed input will crash',
      LEAK_ERROR_TO_CLIENT: 'Internal error details exposed to end users',
      NULL_DEREF: 'Missing null guard before property access',
      ENV_NO_DEFAULT: 'Environment variable assumed to exist without fallback',
    }
    return causes[type] ?? `Pattern ${type} detected without proper handling`
  }

  private getRecommendation(type: string): string {
    const recs: Record<string, string> = {
      EMPTY_CATCH: 'Add `throw err` or `next(err)` inside catch blocks',
      SWALLOWED_ERROR: 'Re-throw or return the error after logging',
      UNHANDLED_PROMISE: 'Add `.catch(next)` or use async/await with try/catch',
      UNSAFE_JSON_PARSE: 'Wrap JSON.parse in try/catch and validate the result',
      LEAK_ERROR_TO_CLIENT: 'Return a generic error message; log the real error server-side',
      NULL_DEREF: 'Add `if (!value)` guard or use optional chaining `value?.prop`',
      ENV_NO_DEFAULT: 'Use `process.env.VAR ?? "default"` or validate at startup',
    }
    return recs[type] ?? 'Review and add appropriate error handling'
  }

  protected fallback(_: DiagnosticBrainInput): DiagnosticBrainOutput {
    return { diagnoses: [], systemicIssues: [], healthScore: 70 }
  }
}
