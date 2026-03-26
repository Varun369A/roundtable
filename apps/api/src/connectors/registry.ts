import type { AIModel } from '@arivarangam/types'
import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import { ClaudeConnector } from './claude.connector'
import { circuitBreakerRegistry } from '../lib/circuit-breaker'
import { metrics } from '../lib/metrics'

/**
 * ConnectorRegistry — stripped to Claude only.
 * Claude is reserved for future use (not wired into any pipeline operations).
 * All code generation runs through the 3-Engine pipeline via Groq (FileGeneratorBrain).
 * All external AI APIs (GPT-4o, Gemini, Perplexity, ElevenLabs, Whisper, Sarvam, Image)
 * have been removed from platform operations.
 */
class ConnectorRegistry {
  private connectors: Map<AIModel, BaseConnector> = new Map()

  constructor() {
    // Claude — reserved for future use, not active in engine operations
    this.register(new ClaudeConnector('claude-3-5-sonnet'))
    this.register(new ClaudeConnector('claude-3-opus'))
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
    const connector = this.connectors.get(model)
    if (!connector) throw new Error(`No connector for model: ${model}`)

    const start = Date.now()
    try {
      const output = await circuitBreakerRegistry.execute(model, async () => {
        return connector.execute({ ...input, model })
      })
      metrics.recordAiCall(model, Date.now() - start, output.costUsd, true)
      return output
    } catch (err) {
      metrics.recordAiCall(model, Date.now() - start, 0, false)
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

  listAll(): AIModel[] {
    return Array.from(this.connectors.keys())
  }
}

export const connectorRegistry = new ConnectorRegistry()
