import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@sabha/types'

/**
 * Cohere connector — Command R+ for RAG-optimised reasoning.
 * Best for: document analysis, structured data extraction, enterprise search.
 * Pricing: $3/1M input, $15/1M output
 */
interface CohereResponse {
  text: string
  meta: {
    tokens: { input_tokens: number; output_tokens: number }
  }
}

export class CohereConnector extends BaseConnector {
  readonly model: AIModel = 'gemini-pro' // uses gemini slot as fallback
  readonly provider = 'cohere'

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    if (!process.env.COHERE_API_KEY) throw new Error('COHERE_API_KEY not set')

    const start = Date.now()

    return this.withRetry(async () => {
      const response = await fetch('https://api.cohere.com/v1/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          model: 'command-r-plus-08-2024',
          message: input.prompt,
          preamble: 'You are an expert AI assistant working as part of Sabha, a multi-AI orchestration platform. Produce high-quality, complete, actionable output.',
          max_tokens: input.options?.maxTokens || 4096,
          temperature: input.options?.temperature || 0.7,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Cohere API error ${response.status}: ${err}`)
      }

      const data = (await response.json()) as CohereResponse
      const inputTokens  = data.meta?.tokens?.input_tokens  || 0
      const outputTokens = data.meta?.tokens?.output_tokens || 0
      const costUsd = (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0

      return {
        type: 'text',
        content: data.text || '',
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs: Date.now() - start,
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.COHERE_API_KEY)
  }
}
