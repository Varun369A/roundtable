/**
 * RetryBrain — Decides whether to retry generation and builds retry context.
 * Zero API — decision logic based on error state + retry history.
 */

import { Brain, BrainContext } from '../../base/Brain'

export interface RetryBrainInput {
  shouldRetry: boolean
  retryCount: number
  retryInstructions: string[]
  healthScore: number
  originalGoal: string
  failedFilePaths: string[]
}

export interface RetryBrainOutput {
  willRetry: boolean
  retryPromptAddition: string
  maxRetriesReached: boolean
  retryStrategy: 'full' | 'targeted' | 'none'
  targetedFiles: string[]
}

export class RetryBrain extends Brain<RetryBrainInput, RetryBrainOutput> {
  readonly brainName = 'RetryBrain'
  readonly orchestratorName = 'ErrorOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false
  private static readonly MAX_RETRIES = 3

  protected async process(input: RetryBrainInput, _ctx: BrainContext): Promise<RetryBrainOutput> {
    const { shouldRetry, retryCount, retryInstructions, healthScore, failedFilePaths } = input

    if (retryCount >= RetryBrain.MAX_RETRIES) {
      return {
        willRetry: false,
        retryPromptAddition: '',
        maxRetriesReached: true,
        retryStrategy: 'none',
        targetedFiles: [],
      }
    }

    if (!shouldRetry || healthScore >= 85) {
      return {
        willRetry: false,
        retryPromptAddition: '',
        maxRetriesReached: false,
        retryStrategy: 'none',
        targetedFiles: [],
      }
    }

    // Targeted retry — only re-generate broken files
    if (failedFilePaths.length > 0 && failedFilePaths.length <= 5) {
      const prompt = retryInstructions.length > 0
        ? `\n\nPREVIOUS ATTEMPT HAD ISSUES — fix these:\n${retryInstructions.map(i => `- ${i}`).join('\n')}`
        : ''

      return {
        willRetry: true,
        retryPromptAddition: prompt,
        maxRetriesReached: false,
        retryStrategy: 'targeted',
        targetedFiles: failedFilePaths,
      }
    }

    // Full retry — too many broken files
    const prompt = retryInstructions.length > 0
      ? `\n\nPREVIOUS ATTEMPT HAD ISSUES (retry ${retryCount + 1}/${RetryBrain.MAX_RETRIES}) — fix these:\n${retryInstructions.map(i => `- ${i}`).join('\n')}`
      : ''

    return {
      willRetry: true,
      retryPromptAddition: prompt,
      maxRetriesReached: false,
      retryStrategy: 'full',
      targetedFiles: [],
    }
  }

  protected fallback(_: RetryBrainInput): RetryBrainOutput {
    return {
      willRetry: false,
      retryPromptAddition: '',
      maxRetriesReached: false,
      retryStrategy: 'none',
      targetedFiles: [],
    }
  }
}
