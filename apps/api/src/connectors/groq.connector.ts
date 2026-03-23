import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

/**
 * Groq connector — Llama 3.1 70B via Groq's inference API.
 * Groq is 10-20x faster than standard LLM APIs (uses LPU hardware).
 * Best for: fast drafts, quick Q&A, high-volume tasks.
 * Pricing: $0.59/1M input, $0.79/1M output
 */
interface GroqResponse {
  choices: Array<{ message: { content: string } }>
  usage: { prompt_tokens: number; completion_tokens: number }
  model: string
}

export class GroqConnector extends BaseConnector {
  readonly model: AIModel = 'gpt-4o' // re-uses gpt-4o slot as fallback model key
  // We'll give it its own model key in types once added
  readonly provider = 'groq'

  // Override model key for registry
  readonly groqModel = 'llama-3.1-70b-versatile'

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set')

    const start = Date.now()

    return this.withRetry(async () => {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.groqModel,
          messages: [
            {
              role: 'system',
              content: 'You are an expert AI assistant working as part of Arivarangam, a multi-AI orchestration platform. Produce high-quality, complete, actionable output quickly.',
            },
            { role: 'user', content: input.prompt },
          ],
          max_tokens: input.options?.maxTokens || 4096,
          temperature: input.options?.temperature || 0.7,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Groq API error ${response.status}: ${err}`)
      }

      const data = (await response.json()) as GroqResponse
      const inputTokens  = data.usage.prompt_tokens
      const outputTokens = data.usage.completion_tokens
      // $0.59/1M input, $0.79/1M output
      const costUsd = (inputTokens / 1_000_000) * 0.59 + (outputTokens / 1_000_000) * 0.79

      return {
        type: 'text',
        content: data.choices[0]?.message.content || '',
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs: Date.now() - start,
        metadata: { model: this.groqModel },
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.GROQ_API_KEY)
  }
}
