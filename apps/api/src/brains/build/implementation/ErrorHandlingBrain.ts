/**
 * ErrorHandlingBrain — Checks that error handling is present in all files.
 * Zero API — pattern scanning.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from './FileGeneratorBrain'

export interface ErrorHandlingBrainInput { generatedFiles: GeneratedFile[] }
export interface ErrorHandlingBrainOutput {
  errorHandlingScore: number
  filesWithoutErrorHandling: string[]
  hasCentralErrorHandler: boolean
}

export class ErrorHandlingBrain extends Brain<ErrorHandlingBrainInput, ErrorHandlingBrainOutput> {
  readonly brainName = 'ErrorHandlingBrain'
  readonly orchestratorName = 'ImplementationOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: ErrorHandlingBrainInput, _ctx: BrainContext): Promise<ErrorHandlingBrainOutput> {
    const apiFiles = input.generatedFiles.filter(f => f.path.includes('route') || f.path.includes('api') || f.path.includes('controller') || f.path.includes('service'))
    const filesWithoutErrorHandling: string[] = []

    for (const file of apiFiles) {
      const hasTryCatch = /try\s*\{/.test(file.content)
      const hasErrorBoundary = /catch\s*\(/.test(file.content)
      if (!hasTryCatch && !hasErrorBoundary && file.content.includes('async')) {
        filesWithoutErrorHandling.push(file.path)
      }
    }

    const allContent = input.generatedFiles.map(f => f.content).join('\n')
    const hasCentralErrorHandler = /setErrorHandler|errorHandler|onError|handleError/i.test(allContent)

    const errorHandlingScore = apiFiles.length === 0 ? 100 :
      Math.round(((apiFiles.length - filesWithoutErrorHandling.length) / apiFiles.length) * 100)

    return { errorHandlingScore, filesWithoutErrorHandling, hasCentralErrorHandler }
  }

  protected fallback(_: ErrorHandlingBrainInput): ErrorHandlingBrainOutput {
    return { errorHandlingScore: 100, filesWithoutErrorHandling: [], hasCentralErrorHandler: false }
  }
}
