import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }>; role: string }
    finishReason: string
  }>
  usageMetadata: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

export class GeminiConnector extends BaseConnector {
  readonly model: AIModel = 'gemini-pro'
  readonly provider = 'google'

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    const apiKey = input.userApiKey || process.env.GOOGLE_AI_API_KEY
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

    const start = Date.now()
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`

    return this.withRetry(async () => {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
          generationConfig: {
            maxOutputTokens: input.options?.maxTokens || 4096,
            temperature: input.options?.temperature || 0.7,
          },
          systemInstruction: {
            parts: [{
              text: 'You are an expert AI assistant working as part of Arivarangam, a multi-AI orchestration platform. Produce high-quality, complete, actionable output.',
            }],
          },
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Gemini API error ${response.status}: ${err}`)
      }

      const data = (await response.json()) as GeminiResponse
      const content = data.candidates[0]?.content?.parts[0]?.text || ''
      const inputTokens  = data.usageMetadata?.promptTokenCount     || 0
      const outputTokens = data.usageMetadata?.candidatesTokenCount || 0
      // $3.5/1M input, $10.5/1M output (Gemini 1.5 Pro)
      const costUsd = (inputTokens / 1_000_000) * 3.5 + (outputTokens / 1_000_000) * 10.5

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
    return Boolean(process.env.GOOGLE_AI_API_KEY)
  }
}
