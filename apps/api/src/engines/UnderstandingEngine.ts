/**
 * UnderstandingEngine — Engine 1 of 3.
 * Controls: IntentOrchestrator → EmotionOrchestrator → MemoryOrchestrator
 *
 * Understands what the user wants, how they feel, and who they are.
 * Output flows into BuildEngine as full context.
 */

import { Engine } from './Engine'
import type { EngineInput, EngineOutput, OrchestratorResult } from './Engine'
import { IntentOrchestrator } from '../orchestrators/understanding/IntentOrchestrator'
import { EmotionOrchestrator } from '../orchestrators/understanding/EmotionOrchestrator'
import { MemoryOrchestrator } from '../orchestrators/understanding/MemoryOrchestrator'

export class UnderstandingEngine extends Engine {
  readonly engineName = 'UnderstandingEngine'

  private readonly orchestrators = [
    new IntentOrchestrator(),
    new EmotionOrchestrator(),
    new MemoryOrchestrator(),
  ]

  async run(input: EngineInput): Promise<EngineOutput> {
    const start = Date.now()
    console.log(`[UnderstandingEngine] Starting — task ${input.taskId}`)

    const results: OrchestratorResult[] = []
    let accumulated: Record<string, unknown> = {}

    for (const orchestrator of this.orchestrators) {
      const ctx = this.buildBrainContext(input, accumulated)

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
    console.log(`[UnderstandingEngine] Done in ${summary.totalDurationMs}ms — task ${input.taskId}`)

    return {
      engineName: this.engineName,
      orchestratorOutputs: accumulated,
      ...summary,
    }
  }
}
