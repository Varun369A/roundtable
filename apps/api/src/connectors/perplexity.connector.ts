import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

interface PerplexityChoice {
  message?: { role: string; content: string }
  delta?:   { content?: string }
  finish_reason?: string
}
interface PerplexityChunk {
  choices: PerplexityChoice[]
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export class PerplexityConnector extends BaseConnector {
  readonly model: AIModel = 'perplexity-sonar'
  readonly provider = 'perplexity'

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    const apiKey = input.userApiKey || process.env.PERPLEXITY_API_KEY
    if (!apiKey) throw new Error('PERPLEXITY_API_KEY not set')

    const start   = Date.now()
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
    const baseBody = {
      model:            'sonar-pro',
      messages: [
        { role: 'system', content: 'You are a research assistant. Provide accurate, well-structured research with current information. Include key statistics and cite sources where possible.' },
        { role: 'user',   content: input.prompt },
      ],
      max_tokens:      input.options?.maxTokens || 2048,
      temperature:     0.2,
      return_citations: true,
      return_images:   false,
    }

    return this.withRetry(async () => {
      // ── Streaming mode ──────────────────────────────────────────────────────
      if (input.onToken) {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...baseBody, stream: true }),
        })
        if (!response.ok) throw new Error(`Perplexity API error ${response.status}: ${await response.text()}`)

        const reader  = response.body!.getReader()
        const decoder = new TextDecoder()
        let   buf     = ''
        let   fullContent  = ''
        let   inputTokens  = 0
        let   outputTokens = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
            try {
              const chunk = JSON.parse(line.slice(6)) as PerplexityChunk
              const delta = chunk.choices[0]?.delta?.content || ''
              if (delta) { input.onToken(delta); fullContent += delta }
              if (chunk.usage) {
                inputTokens  = chunk.usage.prompt_tokens     || 0
                outputTokens = chunk.usage.completion_tokens || 0
              }
            } catch { /* ignore */ }
          }
        }

        const costUsd = (inputTokens + outputTokens) / 1_000_000
        return { type: 'text', content: fullContent, inputTokens, outputTokens, costUsd, latencyMs: Date.now() - start }
      }

      // ── Non-streaming ────────────────────────────────────────────────────────
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify(baseBody),
      })
      if (!response.ok) throw new Error(`Perplexity API error ${response.status}: ${await response.text()}`)

      const data         = (await response.json()) as PerplexityChunk
      const content      = data.choices[0]?.message?.content || ''
      const inputTokens  = data.usage?.prompt_tokens     || 0
      const outputTokens = data.usage?.completion_tokens || 0
      const costUsd      = (inputTokens + outputTokens) / 1_000_000

      return { type: 'text', content, inputTokens, outputTokens, costUsd, latencyMs: Date.now() - start }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.PERPLEXITY_API_KEY)
  }
}
