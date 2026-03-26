/**
 * Orchestrator.ts — Abstract base class for all 9 orchestrators
 *
 * Architecture:
 *   3 Engines → 9 Orchestrators → 81 Brains
 *
 * Each orchestrator controls 9 brains and runs them in sequence.
 * Outputs from earlier brains are available to later brains via context.
 */

import type { Brain, BrainContext, BrainResult } from '../../brains/base/Brain'
import type { OrchestratorResult } from '../../engines/Engine'

export interface OrchestratorInput {
  taskId: string
  userId: string
  goal: string
  /** Outputs from orchestrators that ran before this one */
  previousEngineOutputs: Record<string, unknown>
}

/**
 * Abstract base for all 9 orchestrators.
 * Each orchestrator defines its brain list and runs them in order.
 */
export abstract class Orchestrator {
  abstract readonly orchestratorName: string
  abstract readonly engineName: string

  /**
   * Return the ordered list of brains this orchestrator runs.
   * Order matters — later brains can access earlier brains' outputs.
   */
  protected abstract getBrains(): Array<Brain<unknown, unknown>>

  /**
   * Run all brains in order, accumulating outputs.
   * Each brain receives all previous brain outputs via context.previousOutputs.
   */
  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    const start = Date.now()
    const brains = this.getBrains()
    const brainOutputs: Record<string, unknown> = {}
    let totalTokens = 0
    const errors: string[] = []

    console.log(`[${this.orchestratorName}] Starting — ${brains.length} brains — task ${input.taskId}`)

    const context: BrainContext = {
      taskId: input.taskId,
      userId: input.userId,
      previousOutputs: {
        ...input.previousEngineOutputs,
      },
    }

    for (const brain of brains) {
      // Build input for this brain from all previously accumulated outputs
      const brainInput = this.buildBrainInput(brain.brainName, brainOutputs, input)

      // Update context with latest accumulated outputs
      context.previousOutputs = {
        ...input.previousEngineOutputs,
        ...brainOutputs,
      }

      const result: BrainResult<unknown> = await brain.execute(brainInput, context)

      brainOutputs[brain.brainName] = result.output
      totalTokens += result.tokensUsed

      if (!result.success && result.error) {
        errors.push(`${brain.brainName}: ${result.error}`)
        console.warn(`[${this.orchestratorName}] Brain ${brain.brainName} failed: ${result.error}`)
      }
    }

    const durationMs = Date.now() - start
    console.log(`[${this.orchestratorName}] Completed in ${durationMs}ms — task ${input.taskId}`)

    return {
      orchestratorName: this.orchestratorName,
      output: brainOutputs,
      durationMs,
      tokensUsed: totalTokens,
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    }
  }

  /**
   * Override to customise how each brain's input is built.
   * Default: pass the full accumulated outputs as the input.
   */
  protected buildBrainInput(
    _brainName: string,
    accumulated: Record<string, unknown>,
    orchestratorInput: OrchestratorInput,
  ): unknown {
    return {
      goal: orchestratorInput.goal,
      taskId: orchestratorInput.taskId,
      userId: orchestratorInput.userId,
      ...accumulated,
    }
  }
}
