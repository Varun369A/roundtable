import Anthropic from '@anthropic-ai/sdk'
import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

const MODEL_MAP: Partial<Record<AIModel, string>> = {
  'claude-3-5-sonnet': 'claude-sonnet-4-5',
  'claude-3-opus':     'claude-opus-4-5',
}

const SYSTEM = 'You are an expert AI assistant working as part of Arivarangam, a multi-AI orchestration platform. Produce high-quality, complete, actionable output. Do not add unnecessary preamble.'

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
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

    const start    = Date.now()
    const apiModel = MODEL_MAP[this.model] || 'claude-sonnet-4-5'
    const client   = input.userApiKey ? new Anthropic({ apiKey }) : this.client

    return this.withRetry(async () => {
      // ── Streaming mode ──────────────────────────────────────────────────────
      if (input.onToken) {
        const stream = client.messages.stream({
          model:      apiModel,
          max_tokens: input.options?.maxTokens || 8192,
          system:     SYSTEM,
          messages:   [{ role: 'user', content: input.prompt }],
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta' &&
            event.delta.text
          ) {
            input.onToken(event.delta.text)
          }
        }

        const message      = await stream.finalMessage()
        const content      = message.content[0]
        if (content.type !== 'text') throw new Error('Unexpected response type')
        const inputTokens  = message.usage.input_tokens
        const outputTokens = message.usage.output_tokens
        const costUsd      = (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0

        return { type: 'text', content: content.text, inputTokens, outputTokens, costUsd, latencyMs: Date.now() - start }
      }

      // ── Non-streaming (fallback) ─────────────────────────────────────────────
      const response = await client.messages.create(
        {
          model:      apiModel,
          max_tokens: input.options?.maxTokens || 8192,
          system:     SYSTEM,
          messages:   [{ role: 'user', content: input.prompt }],
        },
        { signal: AbortSignal.timeout(300_000) },
      )

      const content = response.content[0]
      if (content.type !== 'text') throw new Error('Unexpected response type')
      const inputTokens  = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const costUsd      = (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0

      return { type: 'text', content: content.text, inputTokens, outputTokens, costUsd, latencyMs: Date.now() - start }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.ANTHROPIC_API_KEY)
  }
}
