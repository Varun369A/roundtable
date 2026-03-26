/**
 * IntelligenceEngine — Engine 3 of 3.
 * Controls: DeliveryOrchestrator → ErrorOrchestrator → LearningOrchestrator
 *
 * Packages and delivers the build, handles errors/retries, learns from outcomes.
 * This is the final engine in the pipeline.
 */

import { Engine } from './Engine'
import type { EngineInput, EngineOutput, OrchestratorResult } from './Engine'
import { DeliveryOrchestrator } from '../orchestrators/intelligence/DeliveryOrchestrator'
import { ErrorOrchestrator } from '../orchestrators/intelligence/ErrorOrchestrator'
import { LearningOrchestrator } from '../orchestrators/intelligence/LearningOrchestrator'

export interface IntelligenceEngineInput extends EngineInput {
  /** All outputs from UnderstandingEngine + BuildEngine */
  previousOutputs: Record<string, unknown>
  retryCount?: number
  processingStartTime?: number
}

export interface IntelligenceEngineOutput extends EngineOutput {
  /** The final deliverable files */
  finalFiles: unknown[]
  /** Whether to retry (Gate FAIL + retries remaining) */
  shouldRetry: boolean
  retryInstructions: string[]
  /** Quality summary for the user */
  qualitySummary: string
  qualityGrade: string
  overallScore: number
}

export class IntelligenceEngine extends Engine {
  readonly engineName = 'IntelligenceEngine'

  private readonly orchestrators = [
    new DeliveryOrchestrator(),
    new ErrorOrchestrator(),
    new LearningOrchestrator(),
  ]

  async run(input: IntelligenceEngineInput): Promise<IntelligenceEngineOutput> {
    const start = Date.now()
    console.log(`[IntelligenceEngine] Starting — task ${input.taskId}`)

    const results: OrchestratorResult[] = []
    let accumulated: Record<string, unknown> = {
      ...input.previousOutputs,
      retryCount: input.retryCount ?? 0,
      totalTokensUsed: (input.previousOutputs?.['totalTokensUsed'] as number) ?? 0,
    }

    for (const orchestrator of this.orchestrators) {
      const result = await orchestrator.run({
        taskId: input.taskId,
        userId: input.userId,
        goal: input.goal,
        previousEngineOutputs: accumulated,
      })

      results.push(result)
      accumulated = this.mergeOutputs(accumulated, result)
    }

    const summary = this.summariseResults(results)
    const totalMs = Date.now() - start
    console.log(`[IntelligenceEngine] Done in ${totalMs}ms — task ${input.taskId}`)

    // Extract final deliverable
    const deliveryOutput = accumulated['DeliveryOrchestrator'] as Record<string, unknown> | undefined
    const errorOutput = accumulated['ErrorOrchestrator'] as Record<string, unknown> | undefined
    const packagingOutput = deliveryOutput?.['PackagingBrain'] as Record<string, unknown> | undefined
    const fallbackOutput = errorOutput?.['FallbackBrain'] as Record<string, unknown> | undefined

    const finalFiles = fallbackOutput?.['isFallback']
      ? (fallbackOutput?.['fallbackFiles'] as unknown[]) ?? []
      : (packagingOutput?.['allFiles'] as unknown[]) ?? []

    const shouldRetry = (errorOutput?.['RetryBrain'] as { willRetry?: boolean })?.willRetry ?? false
    const retryInstructions = (errorOutput?.['RetryBrain'] as { retryInstructions?: string[] })?.retryInstructions ?? []
    const summaryBrain = deliveryOutput?.['SummaryBrain'] as Record<string, unknown> | undefined
    const gateBrain = (accumulated['QualityOrchestrator'] as Record<string, unknown> | undefined)?.['GateBrain'] as Record<string, unknown> | undefined
    const reviewBrain = (accumulated['QualityOrchestrator'] as Record<string, unknown> | undefined)?.['ReviewBrain'] as Record<string, unknown> | undefined

    return {
      engineName: this.engineName,
      orchestratorOutputs: accumulated,
      ...summary,
      totalDurationMs: totalMs,
      finalFiles,
      shouldRetry,
      retryInstructions,
      qualitySummary: (summaryBrain?.['summary'] as string) ?? '',
      qualityGrade: (gateBrain?.['qualityGrade'] as string) ?? 'C',
      overallScore: (reviewBrain?.['overallScore'] as number) ?? 70,
    }
  }
}
