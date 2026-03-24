import type { AIModel } from '@arivarangam/types'
import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import { ClaudeConnector } from './claude.connector'
import { OpenAIConnector } from './openai.connector'
import { DalleConnector } from './dalle.connector'
import { PerplexityConnector } from './perplexity.connector'
import { GeminiConnector } from './gemini.connector'
import { ElevenLabsConnector } from './elevenlabs.connector'
import { StabilityConnector } from './stability.connector'
import { RunwayConnector } from './runway.connector'
import { GammaConnector } from './gamma.connector'
import { MidjourneyConnector } from './midjourney.connector'
import { SarvamConnector } from './sarvam.connector'
import { GroqConnector } from './groq.connector'
import { CohereConnector } from './cohere.connector'
import { WhisperConnector } from './whisper.connector'
import { ArivarangamConnector } from './sabha.connector'
import { circuitBreakerRegistry } from '../lib/circuit-breaker'
import { metrics } from '../lib/metrics'
import { redis } from '../lib/redis'

// ─── Fallback Chains ──────────────────────────────────────────────────────────
// When a model is unavailable (circuit open, timeout, rate limit),
// the registry automatically tries the next model in the chain.
// Chains are ordered: preferred → acceptable → last resort

const FALLBACK_CHAINS: Partial<Record<AIModel, AIModel[]>> = {
  // Arivarangam falls back to Claude
  'sabha-ai':          ['claude-3-5-sonnet', 'gpt-4o'],

  // Text — reasoning tier
  'claude-3-opus':       ['claude-3-5-sonnet', 'gpt-4o', 'gpt-4-turbo'],
  'claude-3-5-sonnet':   ['gpt-4o', 'gpt-4-turbo', 'gemini-pro'],
  'gpt-4o':              ['gpt-4-turbo', 'claude-3-5-sonnet', 'gemini-pro'],
  'gpt-4-turbo':         ['gpt-4o', 'claude-3-5-sonnet', 'gemini-pro'],
  'gemini-pro':          ['claude-3-5-sonnet', 'gpt-4o'],

  // Image generation
  'midjourney-v6':       ['dalle-3', 'stability-xl'],
  'dalle-3':             ['stability-xl', 'midjourney-v6'],
  'stability-xl':        ['dalle-3'],

  // Video — no fallback (single provider)
  'runway-gen3':         [],

  // Audio / speech
  'elevenlabs':          [],

  // Specialized — fall back to Claude when no API key available
  'perplexity-sonar':    ['gemini-pro', 'claude-3-5-sonnet'],
  'sarvam-1':            ['claude-3-5-sonnet'],
  'gamma':               ['gpt-4o', 'claude-3-5-sonnet'],
  'groq':                ['claude-3-5-sonnet'],
  'cohere':              ['claude-3-5-sonnet'],
}

// ─── Fallback depth limit ─────────────────────────────────────────────────────
const MAX_FALLBACK_DEPTH = 3

// ─── Fallback error types that warrant trying the next model ──────────────────
const FALLBACK_ERROR_CODES = new Set([
  'CIRCUIT_OPEN',
  'RATE_LIMIT',
  'TIMEOUT',
  'OVERLOADED',
  'SERVICE_UNAVAILABLE',
])

function isFallbackableError(err: unknown): boolean {
  if (!err) return false
  const code = (err as NodeJS.ErrnoException).code || ''
  const msg  = (err instanceof Error ? err.message : String(err)).toLowerCase()
  const status = (err as any).status || (err as any).statusCode || 0
  return (
    FALLBACK_ERROR_CODES.has(code) ||
    msg.includes('rate limit') ||
    msg.includes('overloaded') ||
    msg.includes('timeout') ||
    msg.includes('service unavailable') ||
    msg.includes('circuit') ||
    // Missing or invalid API key — fall back to next model in chain
    msg.includes('api key') ||
    msg.includes('not set') ||
    msg.includes('not configured') ||
    msg.includes('no connector') ||
    msg.includes('unauthorized') ||
    msg.includes('invalid_api_key') ||
    status === 401 ||
    status === 403
  )
}

/**
 * Central registry for all AI connectors.
 * Singleton — connectors are instantiated once and reused.
 * Wraps every execute() call with:
 *   - Circuit-breaker protection
 *   - Automatic model fallback on transient failures
 *   - Prometheus metrics recording
 *   - Fallback usage notification (published to Valkey)
 */
class ConnectorRegistry {
  private connectors: Map<AIModel, BaseConnector> = new Map()

  constructor() {
    this.register(new ClaudeConnector('claude-3-5-sonnet'))
    this.register(new ClaudeConnector('claude-3-opus'))
    this.register(new OpenAIConnector('gpt-4o'))
    this.register(new OpenAIConnector('gpt-4-turbo'))
    this.register(new DalleConnector())
    this.register(new PerplexityConnector())
    this.register(new GeminiConnector())
    this.register(new ElevenLabsConnector())
    this.register(new StabilityConnector())
    this.register(new RunwayConnector())
    this.register(new GammaConnector())
    this.register(new MidjourneyConnector())
    this.register(new SarvamConnector())
    this.register(new GroqConnector())
    this.register(new CohereConnector())
    this.register(new WhisperConnector())
    this.register(new ArivarangamConnector())
  }

  private register(connector: BaseConnector) {
    this.connectors.set(connector.model, connector)
  }

  get(model: AIModel): BaseConnector {
    const connector = this.connectors.get(model)
    if (!connector) throw new Error(`No connector registered for model: ${model}`)
    return connector
  }

  // ─── Core execute with fallback ─────────────────────────────────────────────

  async execute(model: AIModel, input: ConnectorInput): Promise<ConnectorOutput> {
    const result = await this._executeWithFallback(model, input, model, 0)
    return result
  }

  private async _executeWithFallback(
    model: AIModel,
    input: ConnectorInput,
    originalModel: AIModel,
    fallbackDepth: number,
  ): Promise<ConnectorOutput> {
    const connector = this.connectors.get(model)
    if (!connector) {
      throw new Error(`No connector for model: ${model}`)
    }

    const start = Date.now()

    try {
      const output = await circuitBreakerRegistry.execute(model, async () => {
        return connector.execute({ ...input, model })
      })

      const durationMs = Date.now() - start
      metrics.recordAiCall(model, durationMs, output.costUsd, true)
      metrics.subtasksRun.inc({ model })

      // Tag output with which model actually ran (may differ from requested)
      if (model !== originalModel) {
        output.metadata = { ...(output.metadata || {}), fallbackFrom: originalModel, fallbackDepth }
        metrics.aiCallErrors.inc({ model: originalModel })  // count original as error
      }

      return output

    } catch (err) {
      const durationMs = Date.now() - start
      metrics.recordAiCall(model, durationMs, 0, false)

      // Try fallback if error is transient and depth limit not exceeded
      if (isFallbackableError(err) && fallbackDepth < MAX_FALLBACK_DEPTH) {
        const chain = FALLBACK_CHAINS[model] || []
        const nextModel = chain[fallbackDepth] as AIModel | undefined

        if (nextModel && this.connectors.has(nextModel)) {
          console.warn(
            `[ConnectorRegistry] ${model} failed (${(err as Error).message}), ` +
            `falling back to ${nextModel} (depth=${fallbackDepth + 1})`
          )

          // Publish fallback event to Valkey for notification system
          redis.publish('sabha:admin', JSON.stringify({
            event: 'model_fallback',
            originalModel,
            fallbackModel: nextModel,
            reason: (err as Error).message,
            taskId: input.taskId,
            timestamp: Date.now(),
          })).catch(() => {})

          return this._executeWithFallback(nextModel, input, originalModel, fallbackDepth + 1)
        }
      }

      throw err
    }
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  async getAvailableModels(): Promise<AIModel[]> {
    const results = await Promise.all(
      Array.from(this.connectors.entries()).map(async ([model, connector]) => ({
        model,
        available: await connector.isAvailable(),
      }))
    )
    return results.filter((r) => r.available).map((r) => r.model)
  }

  getFallbackChain(model: AIModel): AIModel[] {
    return (FALLBACK_CHAINS[model] || []) as AIModel[]
  }

  listAll(): AIModel[] {
    return Array.from(this.connectors.keys())
  }
}

// Singleton export
export const connectorRegistry = new ConnectorRegistry()
