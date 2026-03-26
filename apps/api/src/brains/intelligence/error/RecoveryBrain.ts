/**
 * RecoveryBrain — Generates recovery strategies for detected errors.
 * Zero API — rule-based fix strategy generation.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { ClassifiedError } from './ErrorClassificationBrain'
import type { Diagnosis } from './DiagnosticBrain'

export interface RecoveryBrainInput {
  classified: ClassifiedError[]
  diagnoses: Diagnosis[]
  systemicIssues: string[]
  canRetry: boolean
  retryCount: number
}

export interface RecoveryStrategy {
  type: 'auto-fix' | 'retry-with-instruction' | 'partial-fix' | 'escalate'
  description: string
  instructions: string[]
  confidence: number
  estimatedImpact: 'high' | 'medium' | 'low'
}

export interface RecoveryBrainOutput {
  strategy: RecoveryStrategy
  shouldRetry: boolean
  retryInstructions: string[]
  autoFixable: ClassifiedError[]
}

export class RecoveryBrain extends Brain<RecoveryBrainInput, RecoveryBrainOutput> {
  readonly brainName = 'RecoveryBrain'
  readonly orchestratorName = 'ErrorOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: RecoveryBrainInput, _ctx: BrainContext): Promise<RecoveryBrainOutput> {
    const { classified, diagnoses, canRetry, retryCount } = input

    const criticals = classified.filter(e => e.severity === 'critical')
    const autoFixable = classified.filter(e => e.fixable)
    const highCount = classified.filter(e => e.severity === 'high').length

    // Too many retries — escalate
    if (retryCount >= 3) {
      return {
        strategy: {
          type: 'escalate',
          description: 'Maximum retries reached — manual intervention required',
          instructions: diagnoses.map(d => d.recommendation),
          confidence: 100,
          estimatedImpact: 'high',
        },
        shouldRetry: false,
        retryInstructions: [],
        autoFixable: [],
      }
    }

    // Critical errors that are auto-fixable
    if (criticals.length > 0 && canRetry) {
      const instructions = criticals.map(e => {
        return `In ${e.file} line ${e.line}: ${e.message}. Fix: ${this.getQuickFix(e.type)}`
      })
      return {
        strategy: {
          type: 'retry-with-instruction',
          description: `${criticals.length} critical error(s) — regenerate with specific fix instructions`,
          instructions,
          confidence: 75,
          estimatedImpact: 'high',
        },
        shouldRetry: true,
        retryInstructions: instructions,
        autoFixable,
      }
    }

    // Only fixable non-critical errors
    if (autoFixable.length > 0 && criticals.length === 0) {
      return {
        strategy: {
          type: 'auto-fix',
          description: `${autoFixable.length} auto-fixable issue(s) — applying standard patterns`,
          instructions: autoFixable.map(e => `Fix ${e.type} in ${e.file}: ${this.getQuickFix(e.type)}`),
          confidence: 90,
          estimatedImpact: autoFixable.length > 5 ? 'high' : 'medium',
        },
        shouldRetry: false,
        retryInstructions: [],
        autoFixable,
      }
    }

    // High severity — partial fix + instructions
    if (highCount > 0 && canRetry) {
      const instructions = classified
        .filter(e => e.severity === 'high')
        .map(e => `${e.file}: ${e.message}`)
      return {
        strategy: {
          type: 'partial-fix',
          description: `${highCount} high-severity issue(s) — partial improvements applied`,
          instructions,
          confidence: 60,
          estimatedImpact: 'medium',
        },
        shouldRetry: true,
        retryInstructions: instructions.slice(0, 3),
        autoFixable,
      }
    }

    // Low severity only — proceed
    return {
      strategy: {
        type: 'auto-fix',
        description: 'Only minor issues detected — proceeding with delivery',
        instructions: [],
        confidence: 95,
        estimatedImpact: 'low',
      },
      shouldRetry: false,
      retryInstructions: [],
      autoFixable,
    }
  }

  private getQuickFix(type: string): string {
    const fixes: Record<string, string> = {
      EMPTY_CATCH: 'Add `throw err` inside the catch block',
      UNHANDLED_PROMISE: 'Add `.catch(err => next(err))` at the end of the promise chain',
      STRING_THROW: 'Replace `throw "message"` with `throw new Error("message")`',
      ENV_NO_DEFAULT: 'Use `process.env.VAR ?? "default"` pattern',
      UNSAFE_JSON_PARSE: 'Wrap in try/catch: `try { JSON.parse(x) } catch { return null }`',
    }
    return fixes[type] ?? 'Apply proper error handling pattern'
  }

  protected fallback(_: RecoveryBrainInput): RecoveryBrainOutput {
    return {
      strategy: { type: 'escalate', description: 'Recovery failed', instructions: [], confidence: 0, estimatedImpact: 'low' },
      shouldRetry: false,
      retryInstructions: [],
      autoFixable: [],
    }
  }
}
