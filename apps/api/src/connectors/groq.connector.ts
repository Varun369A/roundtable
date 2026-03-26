/**
 * groq.connector.ts — Groq AI connector (free tier)
 *
 * Replaces: claude.connector.ts, openai.connector.ts, gemini.connector.ts,
 *           perplexity.connector.ts
 *
 * Model: llama-3.3-70b-versatile (free tier)
 * Free tier: 14,400 requests/day, 30 req/min, 6,000 tokens/min
 *
 * Used by: FileGeneratorBrain, ClarificationBrain, ContextBrain,
 *          ReviewBrain, SummaryBrain, FixGeneratorBrain, DatabaseBrain
 *
 * All other brains are pure logic — zero API calls.
 */

import { BaseConnector } from './base.connector'
import type { ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

// Groq model IDs
const GROQ_MODELS = {
  'groq-llama-70b': 'llama-3.3-70b-versatile',
  'groq-llama-8b': 'llama-3.1-8b-instant',      // faster, for small tasks
  'groq-deepseek': 'deepseek-r1-distill-llama-70b', // for complex reasoning
} as const

type GroqModelKey = keyof typeof GROQ_MODELS

// Groq API is OpenAI-compatible — no SDK needed, plain fetch
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_PROMPT = `You are Arivarangam AI — an expert intelligence system built to research, design, and build production-grade software. You think step by step. You produce complete, accurate, immediately usable output. Never truncate. Never add unnecessary preamble.`

export class GroqConnector extends BaseConnector {
  readonly model: AIModel
  readonly provider = 'groq'
  private groqModel: string
  private tokensUsed = 0

  constructor(model: GroqModelKey = 'groq-llama-70b') {
    super()
    this.model = model as AIModel
    this.groqModel = GROQ_MODELS[model]
  }

  getLastTokensUsed(): number {
    return this.tokensUsed
  }

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    const apiKey = input.userApiKey || process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY not set')

    const start = Date.now()
    this.tokensUsed = 0

    return this.withRetry(async () => {
      const body = {
        model: this.groqModel,
        max_tokens: input.options?.maxTokens || 8192,
        temperature: input.options?.temperature ?? 0.3,
        stream: Boolean(input.onToken),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: input.prompt },
        ],
      }

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: this.createAbortSignal(120_000),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Groq API error ${response.status}: ${err}`)
      }

      // ── Streaming mode ──────────────────────────────────────────────────────
      if (input.onToken && response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        let inputTokens = 0
        let outputTokens = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

          for (const line of lines) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                input.onToken(delta)
                fullText += delta
              }
              // Groq streams usage in final chunk
              if (parsed.x_groq?.usage) {
                inputTokens = parsed.x_groq.usage.prompt_tokens || 0
                outputTokens = parsed.x_groq.usage.completion_tokens || 0
              }
            } catch {
              // ignore parse errors on stream chunks
            }
          }
        }

        this.tokensUsed = inputTokens + outputTokens
        // Groq is free tier — cost = 0
        return {
          type: 'text',
          content: fullText,
          inputTokens,
          outputTokens,
          costUsd: 0,
          latencyMs: Date.now() - start,
        }
      }

      // ── Non-streaming mode ──────────────────────────────────────────────────
      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>
        usage: { prompt_tokens: number; completion_tokens: number }
      }

      const content = data.choices?.[0]?.message?.content || ''
      const inputTokens = data.usage?.prompt_tokens || 0
      const outputTokens = data.usage?.completion_tokens || 0
      this.tokensUsed = inputTokens + outputTokens

      return {
        type: 'text',
        content,
        inputTokens,
        outputTokens,
        costUsd: 0,
        latencyMs: Date.now() - start,
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.GROQ_API_KEY)
  }
}

// Singleton instances — one per model size
export const groqLarge = new GroqConnector('groq-llama-70b')
export const groqFast = new GroqConnector('groq-llama-8b')
export const groqReason = new GroqConnector('groq-deepseek')

/**
 * Simple helper used by AI-powered brains.
 * Returns just the text content from Groq.
 */
export async function callGroq(
  prompt: string,
  options: { maxTokens?: number; fast?: boolean; onToken?: (chunk: string) => void } = {},
): Promise<string> {
  const connector = options.fast ? groqFast : groqLarge
  const result = await connector.execute({
    prompt,
    model: connector.model,
    taskId: 'internal',
    subtaskId: 'internal',
    onToken: options.onToken,
    options: { maxTokens: options.maxTokens || 4096 },
  })
  return result.content || ''
}
