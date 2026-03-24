import type { AIModel } from '@arivarangam/types'
import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import { ClaudeConnector } from './claude.connector'
import { OpenAIConnector } from './openai.connector'
import { GeminiConnector } from './gemini.connector'
import { PerplexityConnector } from './perplexity.connector'
import { SarvamConnector } from './sarvam.connector'
import { ElevenLabsConnector } from './elevenlabs.connector'
import { WhisperConnector } from './whisper.connector'
import { ImageConnector } from './image.connector'
import { ArivarangamConnector } from './sabha.connector'
import { circuitBreakerRegistry } from '../lib/circuit-breaker'
import { metrics } from '../lib/metrics'
import { redis } from '../lib/redis'

// ─── Fallback Chains ──────────────────────────────────────────────────────────
// When a model fails (circuit open, rate limit, timeout) try the next in chain.

const FALLBACK_CHAINS: Partial<Record<AIModel, AIModel[]>> = {
  // Arivarangam AI — synthesiser, falls back to Claude
  'sabha-ai':        ['claude-3-5-sonnet', 'gpt-4o'],

  // Code — Claude is primary, GPT-4o backup
  'claude-3-5-sonnet': ['gpt-4o', 'gemini-2.5-pro'],
  'claude-3-opus':     ['claude-3-5-sonnet', 'gpt-4o'],

  // Reasoning — GPT-4o primary, Claude backup
  'gpt-4o':            ['claude-3-5-sonnet', 'gemini-2.5-pro'],

  // Analysis/guidance — Gemini primary, GPT-4o backup
  'gemini-2.5-pro':    ['gpt-4o', 'claude-3-5-sonnet'],

  // Research — Perplexity primary, Gemini for analysis backup
  'perplexity-sonar':  ['gemini-2.5-pro', 'claude-3-5-sonnet'],

  // Indian language — Sarvam primary, Claude backup
  'sarvam-1':          ['claude-3-5-sonnet'],

  // Voice output — ElevenLabs only
  'elevenlabs':        [],

  // Voice input — Whisper only
  'whisper':           [],

  // Image — GPT Image 1 only
  'gpt-image-1':       [],
}

const MAX_FALLBACK_DEPTH = 3

const FALLBACK_ERROR_CODES = new Set([
  'CIRCUIT_OPEN', 'RATE_LIMIT', 'TIMEOUT', 'OVERLOADED', 'SERVICE_UNAVAILABLE',
])

function isFallbackableError(err: unknown): boolean {
  if (!err) return false
  const code   = (err as NodeJS.ErrnoException).code || ''
  const msg    = (err instanceof Error ? err.message : String(err)).toLowerCase()
  const status = (err as any).status || (err as any).statusCode || 0
  return (
    FALLBACK_ERROR_CODES.has(code) ||
    msg.includes('rate limit') ||
    msg.includes('overloaded') ||
    msg.includes('timeout') ||
    msg.includes('service unavailable') ||
    msg.includes('circuit') ||
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
 * Central registry for Arivarangam's 8 specialist AI connectors.
 * Singleton — connectors are instantiated once and reused.
 * Wraps every execute() with:
 *   - Circuit-breaker protection
 *   - Automatic model fallback on transient failures
 *   - Prometheus metrics recording
 *   - Fallback event published to Valkey
 */
class ConnectorRegistry {
  private connectors: Map<AIModel, BaseConnector> = new Map()

  constructor() {
    // ── 8 specialist AIs ────────────────────────────────────────────────────
    this.register(new ClaudeConnector('claude-3-5-sonnet'))  // Coding
    this.register(new ClaudeConnector('claude-3-opus'))       // Deep reasoning
    this.register(new OpenAIConnector('gpt-4o'))              // Reasoning
    this.register(new GeminiConnector())                      // Analysis / guidance
    this.register(new PerplexityConnector())                  // Research
    this.register(new SarvamConnector())                      // Indian languages
    this.register(new ElevenLabsConnector())                  // Voice output
    this.register(new WhisperConnector())                     // Voice input
    this.register(new ImageConnector())                       // Image generation
    // ── Arivarangam AI — synthesiser / orchestrator ─────────────────────────
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

  async execute(model: AIModel, input: ConnectorInput): Promise<ConnectorOutput> {
    return this._executeWithFallback(model, input, model, 0)
  }

  private async _executeWithFallback(
    model: AIModel,
    input: ConnectorInput,
    originalModel: AIModel,
    fallbackDepth: number,
  ): Promise<ConnectorOutput> {
    const connector = this.connectors.get(model)
    if (!connector) throw new Error(`No connector for model: ${model}`)

    const start = Date.now()

    try {
      const output = await circuitBreakerRegistry.execute(model, async () => {
        return connector.execute({ ...input, model })
      })

      const durationMs = Date.now() - start
      metrics.recordAiCall(model, durationMs, output.costUsd, true)
      metrics.subtasksRun.inc({ model })

      if (model !== originalModel) {
        output.metadata = { ...(output.metadata || {}), fallbackFrom: originalModel, fallbackDepth }
        metrics.aiCallErrors.inc({ model: originalModel })
      }

      return output

    } catch (err) {
      const durationMs = Date.now() - start
      metrics.recordAiCall(model, durationMs, 0, false)

      if (isFallbackableError(err) && fallbackDepth < MAX_FALLBACK_DEPTH) {
        const chain     = FALLBACK_CHAINS[originalModel] || []
        const nextModel = chain[fallbackDepth] as AIModel | undefined

        if (nextModel && this.connectors.has(nextModel)) {
          console.warn(
            `[ConnectorRegistry] ${model} failed (${(err as Error).message}), ` +
            `falling back to ${nextModel} (depth=${fallbackDepth + 1})`
          )

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

export const connectorRegistry = new ConnectorRegistry()
