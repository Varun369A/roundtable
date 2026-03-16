import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@sabha/types'

interface PerplexityResponse {
  id: string
  model: string
  choices: Array<{
    message: { role: string; content: string }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class PerplexityConnector extends BaseConnector {
  readonly model: AIModel = 'perplexity-sonar'
  readonly provider = 'perplexity'

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    if (!process.env.PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY not set')

    const start = Date.now()

    return this.withRetry(async () => {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-large-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are a research assistant. Provide accurate, well-structured research with current information. Include key statistics and cite sources where possible.',
            },
            { role: 'user', content: input.prompt },
          ],
          max_tokens: input.options?.maxTokens || 2048,
          temperature: 0.2,
          return_citations: true,
          return_images: false,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Perplexity API error ${response.status}: ${err}`)
      }

      const data = (await response.json()) as PerplexityResponse
      const content = data.choices[0]?.message?.content || ''
      const inputTokens  = data.usage?.prompt_tokens     || 0
      const outputTokens = data.usage?.completion_tokens || 0
      // $1/1M input, $1/1M output
      const costUsd = (inputTokens + outputTokens) / 1_000_000

      return {
        type: 'text',
        content,
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs: Date.now() - start,
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.PERPLEXITY_API_KEY)
  }
}
