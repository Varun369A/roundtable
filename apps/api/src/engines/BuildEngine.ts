/**
 * BuildEngine — Engine 2 of 3.
 * Controls: ArchitectureOrchestrator → ImplementationOrchestrator → QualityOrchestrator
 *
 * Designs the architecture, generates the code, and validates quality.
 * Output flows into IntelligenceEngine for delivery and error handling.
 */

import { Engine } from './Engine'
import type { EngineInput, EngineOutput, OrchestratorResult } from './Engine'
import { ArchitectureOrchestrator } from '../orchestrators/build/ArchitectureOrchestrator'
import { ImplementationOrchestrator } from '../orchestrators/build/ImplementationOrchestrator'
import { QualityOrchestrator } from '../orchestrators/build/QualityOrchestrator'

export interface BuildEngineInput extends EngineInput {
  /** Context injected from UnderstandingEngine */
  understandingOutputs: Record<string, unknown>
  /** Fix instructions from a previous retry, if any */
  retryPromptAddition?: string
  retryCount?: number
}

export class BuildEngine extends Engine {
  readonly engineName = 'BuildEngine'

  private readonly orchestrators = [
    new ArchitectureOrchestrator(),
    new ImplementationOrchestrator(),
    new QualityOrchestrator(),
  ]

  async run(input: BuildEngineInput): Promise<EngineOutput> {
    const start = Date.now()
    console.log(`[BuildEngine] Starting — task ${input.taskId}`)

    const results: OrchestratorResult[] = []

    // Seed accumulated outputs with understanding context
    let accumulated: Record<string, unknown> = {
      ...input.understandingOutputs,
      retryPromptAddition: input.retryPromptAddition ?? '',
      retryCount: input.retryCount ?? 0,
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
    console.log(`[BuildEngine] Done in ${summary.totalDurationMs}ms — task ${input.taskId}`)

    return {
      engineName: this.engineName,
      orchestratorOutputs: accumulated,
      ...summary,
    }
  }
}
