import Anthropic from '@anthropic-ai/sdk'
import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

const MODEL_MAP: Partial<Record<AIModel, string>> = {
  'claude-3-5-sonnet': 'claude-sonnet-4-5',
  'claude-3-opus':     'claude-opus-4-5',
}

export class ClaudeConnector extends BaseConnector {
  readonly model: AIModel
  readonly provider = 'anthropic'
  private client: Anthropic

  constructor(model: AIModel = 'claude-3-5-sonnet') {
    super()
    this.model = model
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    const apiKey = input.userApiKey || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set')
    }

    const start = Date.now()
    const apiModel = MODEL_MAP[this.model] || 'claude-sonnet-4-5'
    // Reuse the singleton client unless a user-provided key was given
    const client = input.userApiKey ? new Anthropic({ apiKey }) : this.client

    return this.withRetry(async () => {
      const response = await client.messages.create({
        model: apiModel,
        max_tokens: input.options?.maxTokens || 4096,
        messages: [{ role: 'user', content: input.prompt }],
        system: 'You are an expert AI assistant working as part of Arivarangam, a multi-AI orchestration platform. Produce high-quality, complete, actionable output. Do not add unnecessary preamble.',
      }, { signal: AbortSignal.timeout(60_000) })

      const content = response.content[0]
      if (content.type !== 'text') throw new Error('Unexpected response type')

      const inputTokens  = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      // Pricing: $3/1M input, $15/1M output
      const costUsd = (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0

      return {
        type: 'text',
        content: content.text,
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs: Date.now() - start,
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.ANTHROPIC_API_KEY)
  }
}
