/**
 * ErrorDetectionBrain — Detects errors in generated code via static analysis.
 * Zero API — pattern matching on common error signatures.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../../build/implementation/FileGeneratorBrain'

export interface DetectedError {
  file: string
  line: number
  type: string
  message: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  snippet: string
}

export interface ErrorDetectionBrainInput {
  generatedFiles: GeneratedFile[]
}

export interface ErrorDetectionBrainOutput {
  errors: DetectedError[]
  errorCount: number
  criticalCount: number
  hasErrors: boolean
}

export class ErrorDetectionBrain extends Brain<ErrorDetectionBrainInput, ErrorDetectionBrainOutput> {
  readonly brainName = 'ErrorDetectionBrain'
  readonly orchestratorName = 'ErrorOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  // Patterns: [regex, type, message, severity]
  private readonly patterns: Array<[RegExp, string, string, DetectedError['severity']]> = [
    [/\bconsole\.error\s*\(\s*err\s*\)(?!\s*;?\s*(throw|return|process\.exit))/, 'SWALLOWED_ERROR', 'Error logged but not re-thrown or returned', 'medium'],
    [/catch\s*\([^)]*\)\s*\{?\s*\}/, 'EMPTY_CATCH', 'Empty catch block — error silently swallowed', 'high'],
    [/\.then\([^)]*\)(?!\s*\.catch)/, 'UNHANDLED_PROMISE', 'Promise .then() without .catch()', 'medium'],
    [/require\s*\(\s*[`'"]\.\//,'DYNAMIC_REQUIRE', 'Dynamic require may fail at runtime', 'low'],
    [/JSON\.parse\s*\([^)]+\)(?!\s*\/\/ safe)/, 'UNSAFE_JSON_PARSE', 'JSON.parse without try/catch', 'medium'],
    [/process\.env\.\w+(?!\s*\?\?)(?!\s*\|\|)(?!\s*!)/, 'ENV_NO_DEFAULT', 'process.env access without fallback', 'low'],
    [/res\.send\s*\(\s*err/, 'LEAK_ERROR_TO_CLIENT', 'Raw error sent to client — exposes internals', 'high'],
    [/undefined\s*\.\s*\w+/, 'NULL_DEREF', 'Potential undefined property access', 'critical'],
    [/throw\s+['"`]/, 'STRING_THROW', 'Throwing a string instead of Error object', 'low'],
  ]

  protected async process(input: ErrorDetectionBrainInput, _ctx: BrainContext): Promise<ErrorDetectionBrainOutput> {
    const errors: DetectedError[] = []

    for (const file of input.generatedFiles) {
      if (!['typescript', 'javascript'].includes(file.language)) continue
      const lines = file.content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        for (const [pattern, type, message, severity] of this.patterns) {
          if (pattern.test(line)) {
            errors.push({
              file: file.path,
              line: i + 1,
              type,
              message,
              severity,
              snippet: line.trim().slice(0, 80),
            })
          }
        }
      }
    }

    const criticalCount = errors.filter(e => e.severity === 'critical').length

    return {
      errors: errors.slice(0, 20), // cap output
      errorCount: errors.length,
      criticalCount,
      hasErrors: errors.length > 0,
    }
  }

  protected fallback(_: ErrorDetectionBrainInput): ErrorDetectionBrainOutput {
    return { errors: [], errorCount: 0, criticalCount: 0, hasErrors: false }
  }
}
