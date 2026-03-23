import OpenAI from 'openai'
import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

const MODEL_MAP: Partial<Record<AIModel, string>> = {
  'gpt-4o':      'gpt-4o',
  'gpt-4-turbo': 'gpt-4-turbo',
}

// Pricing per 1M tokens
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':      { input: 5.0,  output: 15.0 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
}

export class OpenAIConnector extends BaseConnector {
  readonly model: AIModel
  readonly provider = 'openai'
  private client: OpenAI

  constructor(model: AIModel = 'gpt-4o') {
    super()
    this.model = model
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    const apiKey = input.userApiKey || process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not set')

    const start = Date.now()
    const apiModel = MODEL_MAP[this.model] || 'gpt-4o'
    // Reuse the singleton client unless a user-provided key was given
    const client = input.userApiKey ? new OpenAI({ apiKey }) : this.client

    return this.withRetry(async () => {
      const response = await client.chat.completions.create({
        model: apiModel,
        max_tokens: input.options?.maxTokens || 4096,
        temperature: input.options?.temperature || 0.7,
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI assistant working as part of Arivarangam, a multi-AI orchestration platform. Produce high-quality, complete, actionable output.',
          },
          { role: 'user', content: input.prompt },
        ],
      }, { signal: AbortSignal.timeout(60_000) })

      const choice = response.choices[0]
      const inputTokens  = response.usage?.prompt_tokens     || 0
      const outputTokens = response.usage?.completion_tokens || 0
      const pricing      = PRICING[apiModel] || PRICING['gpt-4o']
      const costUsd      = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

      return {
        type: 'text',
        content: choice.message.content || '',
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs: Date.now() - start,
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.OPENAI_API_KEY)
  }
}
