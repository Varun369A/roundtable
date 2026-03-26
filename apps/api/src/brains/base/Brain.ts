/**
 * Brain.ts — Abstract base class for all 81 Arivarangam brains
 *
 * Every brain in the system extends this class.
 * Brains are the atomic units of intelligence — each has one job only.
 *
 * Architecture:
 *   3 Engines → 9 Orchestrators → 81 Brains
 */

export interface BrainResult<TOutput> {
  /** The brain's computed output */
  output: TOutput
  /** Which brain produced this */
  brainName: string
  /** Which orchestrator this brain belongs to */
  orchestratorName: string
  /** Which engine this brain belongs to */
  engineName: string
  /** How long the brain took in milliseconds */
  durationMs: number
  /** Whether this brain made an external AI API call */
  usedAI: boolean
  /** How many tokens were used (0 if no AI call) */
  tokensUsed: number
  /** Whether the brain succeeded */
  success: boolean
  /** Error message if brain failed */
  error?: string
}

export interface BrainContext {
  /** The user's original task goal */
  taskId: string
  userId: string
  /** Accumulated outputs from previously run brains in this pipeline */
  previousOutputs: Record<string, unknown>
}

/**
 * Abstract base class for all 81 brains.
 *
 * TInput  — the shape of data this brain receives
 * TOutput — the shape of data this brain produces
 */
export abstract class Brain<TInput, TOutput> {
  /** Unique name for this brain — used in logs and tracking */
  abstract readonly brainName: string

  /** Which orchestrator this brain belongs to */
  abstract readonly orchestratorName: string

  /** Which engine this brain belongs to */
  abstract readonly engineName: string

  /**
   * Whether this brain uses an external AI API.
   * Most brains are false (pure logic).
   * Only FileGeneratorBrain and a few others are true.
   */
  abstract readonly usesAI: boolean

  /**
   * Core logic — every brain implements this.
   * Must be deterministic given the same input + context.
   */
  protected abstract process(input: TInput, context: BrainContext): Promise<TOutput>

  /**
   * Public entry point — wraps process() with timing, logging, error handling.
   * Never override this — override process() instead.
   */
  async execute(input: TInput, context: BrainContext): Promise<BrainResult<TOutput>> {
    const start = Date.now()
    console.log(`[${this.brainName}] Starting — task ${context.taskId}`)

    try {
      const output = await this.process(input, context)
      const durationMs = Date.now() - start

      console.log(`[${this.brainName}] Completed in ${durationMs}ms — task ${context.taskId}`)

      return {
        output,
        brainName: this.brainName,
        orchestratorName: this.orchestratorName,
        engineName: this.engineName,
        durationMs,
        usedAI: this.usesAI,
        tokensUsed: this.getTokensUsed(),
        success: true,
      }
    } catch (err) {
      const durationMs = Date.now() - start
      const error = err instanceof Error ? err.message : String(err)

      console.error(`[${this.brainName}] Failed after ${durationMs}ms — task ${context.taskId}:`, err)

      return {
        output: this.fallback(input),
        brainName: this.brainName,
        orchestratorName: this.orchestratorName,
        engineName: this.engineName,
        durationMs,
        usedAI: this.usesAI,
        tokensUsed: 0,
        success: false,
        error,
      }
    }
  }

  /**
   * Fallback output when process() throws.
   * Override in brains that need a specific safe default.
   * Base implementation returns empty object cast to TOutput.
   */
  protected fallback(_input: TInput): TOutput {
    return {} as TOutput
  }

  /**
   * Override in AI-using brains to report token usage.
   * Called after process() completes.
   */
  protected getTokensUsed(): number {
    return 0
  }

  /**
   * Utility: retry a function up to maxRetries times with exponential backoff.
   * Use in brains that call external APIs or flaky operations.
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 500,
  ): Promise<T> {
    let lastErr: unknown
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (err) {
        lastErr = err
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1)
          console.warn(`[${this.brainName}] Attempt ${attempt} failed, retrying in ${delay}ms`)
          await new Promise(r => setTimeout(r, delay))
        }
      }
    }
    throw lastErr
  }

  /**
   * Utility: run multiple async tasks in parallel and collect all results.
   * Even if some fail, returns all results (success or error).
   */
  protected async runParallel<T>(tasks: Array<() => Promise<T>>): Promise<Array<T | null>> {
    const results = await Promise.allSettled(tasks.map(t => t()))
    return results.map(r => (r.status === 'fulfilled' ? r.value : null))
  }
}
