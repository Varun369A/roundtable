/**
 * ErrorClassificationBrain — Classifies detected errors by category and priority.
 * Zero API — rule-based classification.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { DetectedError } from './ErrorDetectionBrain'

export interface ErrorClassificationBrainInput {
  errors: DetectedError[]
  goal: string
  isCodeTask: boolean
}

export interface ClassifiedError extends DetectedError {
  category: 'runtime' | 'security' | 'logic' | 'style' | 'performance'
  priority: 1 | 2 | 3 | 4 | 5
  fixable: boolean
}

export interface ErrorClassificationBrainOutput {
  classified: ClassifiedError[]
  byCategory: Record<string, ClassifiedError[]>
  topPriority: ClassifiedError[]
  fixableCount: number
}

export class ErrorClassificationBrain extends Brain<ErrorClassificationBrainInput, ErrorClassificationBrainOutput> {
  readonly brainName = 'ErrorClassificationBrain'
  readonly orchestratorName = 'ErrorOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  private readonly categoryMap: Record<string, ClassifiedError['category']> = {
    EMPTY_CATCH: 'runtime',
    SWALLOWED_ERROR: 'runtime',
    UNHANDLED_PROMISE: 'runtime',
    UNSAFE_JSON_PARSE: 'runtime',
    NULL_DEREF: 'runtime',
    LEAK_ERROR_TO_CLIENT: 'security',
    ENV_NO_DEFAULT: 'security',
    DYNAMIC_REQUIRE: 'logic',
    STRING_THROW: 'style',
    N_PLUS_ONE: 'performance',
    MISSING_INDEX: 'performance',
  }

  private readonly priorityMap: Record<DetectedError['severity'], ClassifiedError['priority']> = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
  }

  protected async process(input: ErrorClassificationBrainInput, _ctx: BrainContext): Promise<ErrorClassificationBrainOutput> {
    const classified: ClassifiedError[] = input.errors.map(err => ({
      ...err,
      category: this.categoryMap[err.type] ?? 'logic',
      priority: this.priorityMap[err.severity] ?? 5,
      fixable: ['EMPTY_CATCH', 'UNHANDLED_PROMISE', 'STRING_THROW', 'ENV_NO_DEFAULT'].includes(err.type),
    }))

    classified.sort((a, b) => a.priority - b.priority)

    const byCategory: Record<string, ClassifiedError[]> = {}
    for (const err of classified) {
      if (!byCategory[err.category]) byCategory[err.category] = []
      byCategory[err.category].push(err)
    }

    return {
      classified,
      byCategory,
      topPriority: classified.slice(0, 5),
      fixableCount: classified.filter(e => e.fixable).length,
    }
  }

  protected fallback(_: ErrorClassificationBrainInput): ErrorClassificationBrainOutput {
    return { classified: [], byCategory: {}, topPriority: [], fixableCount: 0 }
  }
}
