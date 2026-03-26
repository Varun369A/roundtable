/**
 * Engine.ts — Abstract base class for the 3 top-level engines
 *
 * Architecture:
 *   3 Engines → 9 Orchestrators → 81 Brains
 *
 * Engines are the highest level of the intelligence hierarchy.
 * Each engine controls 3 orchestrators and passes context between them.
 */

import type { BrainContext } from '../brains/base/Brain'

export interface EngineInput {
  taskId: string
  userId: string
  goal: string
  /** Any data passed in from outside the engine */
  initialData?: Record<string, unknown>
}

export interface EngineOutput {
  engineName: string
  /** All outputs produced by orchestrators within this engine */
  orchestratorOutputs: Record<string, unknown>
  /** Total time across all orchestrators and brains */
  totalDurationMs: number
  /** Total AI tokens used across all brains in this engine */
  totalTokensUsed: number
  /** Whether all orchestrators succeeded */
  success: boolean
  errors: string[]
}

export interface OrchestratorResult {
  orchestratorName: string
  output: Record<string, unknown>
  durationMs: number
  tokensUsed: number
  success: boolean
  error?: string
}

/**
 * Abstract base for all 3 engines.
 * Each engine runs its 3 orchestrators in sequence,
 * passing accumulated context forward.
 */
export abstract class Engine {
  abstract readonly engineName: string

  /**
   * Run all orchestrators in this engine in order.
   * Each orchestrator receives outputs from all previous orchestrators.
   */
  abstract run(input: EngineInput): Promise<EngineOutput>

  /**
   * Build a BrainContext from the engine input + accumulated outputs.
   * Passed to every brain via its orchestrator.
   */
  protected buildBrainContext(
    input: EngineInput,
    previousOutputs: Record<string, unknown> = {},
  ): BrainContext {
    return {
      taskId: input.taskId,
      userId: input.userId,
      previousOutputs,
    }
  }

  /**
   * Merge orchestrator result into the accumulated outputs map.
   * Key = orchestratorName, value = orchestrator output.
   */
  protected mergeOutputs(
    accumulated: Record<string, unknown>,
    result: OrchestratorResult,
  ): Record<string, unknown> {
    return {
      ...accumulated,
      [result.orchestratorName]: result.output,
    }
  }

  protected summariseResults(results: OrchestratorResult[]): Omit<EngineOutput, 'engineName' | 'orchestratorOutputs'> {
    const totalDurationMs = results.reduce((sum, r) => sum + r.durationMs, 0)
    const totalTokensUsed = results.reduce((sum, r) => sum + r.tokensUsed, 0)
    const errors = results.filter(r => !r.success).map(r => r.error ?? 'Unknown error')
    const success = errors.length === 0

    return { totalDurationMs, totalTokensUsed, success, errors }
  }
}
