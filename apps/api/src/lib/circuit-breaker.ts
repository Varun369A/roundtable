/**
 * Circuit Breaker for AI connectors.
 *
 * States:
 *   CLOSED   — normal operation, requests flow through
 *   OPEN     — connector is failing, requests fail fast for `openDurationMs`
 *   HALF_OPEN — trial period: one request is allowed through to test recovery
 *
 * Configuration per model can be passed via `CircuitBreakerRegistry.configure()`.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  failureThreshold: number    // # of failures to trip the breaker
  successThreshold: number    // # of successes in HALF_OPEN to close it
  openDurationMs: number      // how long to stay OPEN before trying HALF_OPEN
  windowMs: number            // rolling window for counting failures
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  openDurationMs: 30_000,   // 30 seconds
  windowMs: 60_000,          // 1 minute
}

interface BreakerState {
  state: CircuitState
  failures: number
  successes: number
  lastFailureAt: number | null
  openedAt: number | null
  failureTimestamps: number[]
}

class CircuitBreaker {
  private state: BreakerState = {
    state: 'CLOSED',
    failures: 0,
    successes: 0,
    lastFailureAt: null,
    openedAt: null,
    failureTimestamps: [],
  }

  constructor(
    public readonly name: string,
    private readonly config: CircuitBreakerConfig = DEFAULT_CONFIG
  ) {}

  get currentState(): CircuitState {
    return this.state.state
  }

  isOpen(): boolean {
    this.maybeTransitionFromOpen()
    return this.state.state === 'OPEN'
  }

  onSuccess(): void {
    this.state.lastFailureAt = null

    if (this.state.state === 'HALF_OPEN') {
      this.state.successes++
      if (this.state.successes >= this.config.successThreshold) {
        this.close()
      }
    } else if (this.state.state === 'CLOSED') {
      // Remove stale failures outside the window
      this.pruneOldFailures()
    }
  }

  onFailure(): void {
    const now = Date.now()
    this.state.lastFailureAt = now
    this.state.failureTimestamps.push(now)
    this.pruneOldFailures()
    this.state.failures = this.state.failureTimestamps.length

    if (this.state.state === 'HALF_OPEN') {
      // One failure in HALF_OPEN → back to OPEN
      this.open()
      return
    }

    if (this.state.state === 'CLOSED' && this.state.failures >= this.config.failureThreshold) {
      this.open()
    }
  }

  getStats(): {
    state: CircuitState
    failures: number
    successes: number
    lastFailureAt: number | null
  } {
    return {
      state: this.state.state,
      failures: this.state.failures,
      successes: this.state.successes,
      lastFailureAt: this.state.lastFailureAt,
    }
  }

  private open(): void {
    console.warn(`[CircuitBreaker] ${this.name} → OPEN`)
    this.state.state = 'OPEN'
    this.state.openedAt = Date.now()
    this.state.successes = 0
  }

  private close(): void {
    console.info(`[CircuitBreaker] ${this.name} → CLOSED`)
    this.state.state = 'CLOSED'
    this.state.failures = 0
    this.state.successes = 0
    this.state.failureTimestamps = []
    this.state.openedAt = null
  }

  private maybeTransitionFromOpen(): void {
    if (this.state.state !== 'OPEN') return
    if (!this.state.openedAt) return

    const elapsed = Date.now() - this.state.openedAt
    if (elapsed >= this.config.openDurationMs) {
      console.info(`[CircuitBreaker] ${this.name} → HALF_OPEN`)
      this.state.state = 'HALF_OPEN'
      this.state.successes = 0
    }
  }

  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.config.windowMs
    this.state.failureTimestamps = this.state.failureTimestamps.filter((t) => t > cutoff)
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>()
  private configs = new Map<string, Partial<CircuitBreakerConfig>>()

  configure(name: string, config: Partial<CircuitBreakerConfig>): void {
    this.configs.set(name, config)
  }

  get(name: string): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const config = { ...DEFAULT_CONFIG, ...(this.configs.get(name) || {}) }
      this.breakers.set(name, new CircuitBreaker(name, config))
    }
    return this.breakers.get(name)!
  }

  /**
   * Wraps an async function with circuit-breaker protection.
   * Throws with code 'CIRCUIT_OPEN' if the breaker is open.
   */
  async execute<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const breaker = this.get(name)

    if (breaker.isOpen()) {
      const err = new Error(`Circuit breaker for ${name} is OPEN — requests are being rejected`)
      ;(err as NodeJS.ErrnoException).code = 'CIRCUIT_OPEN'
      throw err
    }

    try {
      const result = await fn()
      breaker.onSuccess()
      return result
    } catch (err) {
      breaker.onFailure()
      throw err
    }
  }

  getAllStats(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
    const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {}
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats()
    }
    return stats
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry()

// ── Image / video generation — slow, expensive; keep open longer ─────────────
circuitBreakerRegistry.configure('runway-gen3',    { openDurationMs: 60_000, failureThreshold: 3 })
circuitBreakerRegistry.configure('midjourney-v6',  { openDurationMs: 60_000, failureThreshold: 3 })
circuitBreakerRegistry.configure('dalle-3',        { openDurationMs: 60_000, failureThreshold: 3 })
circuitBreakerRegistry.configure('stability-xl',   { openDurationMs: 60_000, failureThreshold: 3 })

// ── Premium text models — 20s window; Opus is expensive, recover conservatively
circuitBreakerRegistry.configure('claude-3-opus',  { openDurationMs: 20_000, failureThreshold: 4 })

// ── Standard text models — 15s recovery window ───────────────────────────────
circuitBreakerRegistry.configure('claude-3-5-sonnet', { openDurationMs: 15_000 })
circuitBreakerRegistry.configure('gpt-4o',            { openDurationMs: 15_000 })
circuitBreakerRegistry.configure('gpt-4-turbo',       { openDurationMs: 15_000 })
circuitBreakerRegistry.configure('gemini-pro',         { openDurationMs: 15_000 })
circuitBreakerRegistry.configure('gemini-1-5-pro',     { openDurationMs: 15_000 })
circuitBreakerRegistry.configure('cohere',             { openDurationMs: 15_000 })

// ── Research / specialised — moderate recovery ───────────────────────────────
circuitBreakerRegistry.configure('perplexity-sonar', { openDurationMs: 20_000 })
circuitBreakerRegistry.configure('sarvam-1',         { openDurationMs: 20_000 }) // Indian language model
circuitBreakerRegistry.configure('gamma',            { openDurationMs: 30_000, failureThreshold: 3 })

// ── Ultra-fast inference (Groq) — recover very quickly ───────────────────────
circuitBreakerRegistry.configure('groq', { openDurationMs: 10_000, failureThreshold: 6 })

// ── Arivarangam's own model ─────────────────────────────────────────────────────────
circuitBreakerRegistry.configure('sabha-ai', { openDurationMs: 15_000 })
