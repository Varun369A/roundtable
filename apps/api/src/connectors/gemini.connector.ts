import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

interface GeminiPart { text: string }
interface GeminiCandidate {
  content: { parts: GeminiPart[]; role: string }
  finishReason: string
}
interface GeminiResponse {
  candidates: GeminiCandidate[]
  usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number }
}

const SYSTEM = 'You are an expert AI assistant working as part of Arivarangam, a multi-AI orchestration platform. Produce high-quality, complete, actionable output.'

export class GeminiConnector extends BaseConnector {
  readonly model: AIModel = 'gemini-2.5-pro'
  readonly provider = 'google'

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    const apiKey = input.userApiKey || process.env.GOOGLE_AI_API_KEY
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set')

    const start = Date.now()
    const body  = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
      generationConfig: {
        maxOutputTokens: input.options?.maxTokens || 8192,
        temperature:     input.options?.temperature || 0.7,
      },
      systemInstruction: { parts: [{ text: SYSTEM }] },
    })

    return this.withRetry(async () => {
      // ── Streaming mode ──────────────────────────────────────────────────────
      if (input.onToken) {
        const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?key=${apiKey}&alt=sse`
        const response  = await fetch(streamUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        if (!response.ok) {
          throw new Error(`Gemini API error ${response.status}: ${await response.text()}`)
        }

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
            if (!line.startsWith('data: ')) continue
            try {
              const chunk = JSON.parse(line.slice(6)) as GeminiResponse
              const text  = chunk.candidates?.[0]?.content?.parts?.[0]?.text || ''
              if (text) { input.onToken(text); fullContent += text }
              if (chunk.usageMetadata) {
                inputTokens  = chunk.usageMetadata.promptTokenCount     || 0
                outputTokens = chunk.usageMetadata.candidatesTokenCount || 0
              }
            } catch { /* ignore malformed chunks */ }
          }
        }

        const costUsd = (inputTokens / 1_000_000) * 1.25 + (outputTokens / 1_000_000) * 10.0
        return { type: 'text', content: fullContent, inputTokens, outputTokens, costUsd, latencyMs: Date.now() - start }
      }

      // ── Non-streaming ────────────────────────────────────────────────────────
      const apiUrl  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!response.ok) throw new Error(`Gemini API error ${response.status}: ${await response.text()}`)

      const data         = (await response.json()) as GeminiResponse
      const content      = data.candidates[0]?.content?.parts[0]?.text || ''
      const inputTokens  = data.usageMetadata?.promptTokenCount     || 0
      const outputTokens = data.usageMetadata?.candidatesTokenCount || 0
      const costUsd      = (inputTokens / 1_000_000) * 1.25 + (outputTokens / 1_000_000) * 10.0

      return { type: 'text', content, inputTokens, outputTokens, costUsd, latencyMs: Date.now() - start }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.GOOGLE_AI_API_KEY)
  }
}
