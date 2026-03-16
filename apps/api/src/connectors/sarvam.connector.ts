import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@sabha/types'

const SARVAM_LANGUAGE_MAP: Record<string, string> = {
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  or: 'or-IN',
}

interface SarvamTranslateResponse {
  request_id: string
  translated_text: string
}

export class SarvamConnector extends BaseConnector {
  readonly model: AIModel = 'sarvam-1'
  readonly provider = 'sarvam'

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    if (!process.env.SARVAM_API_KEY) throw new Error('SARVAM_API_KEY not set')

    const start = Date.now()
    const targetLanguage = SARVAM_LANGUAGE_MAP[input.options?.language || 'hi'] || 'hi-IN'

    // Extract text to translate
    const textToTranslate = extractTranslatableText(input.prompt)

    return this.withRetry(async () => {
      const response = await fetch('https://api.sarvam.ai/translate', {
        method: 'POST',
        headers: {
          'api-subscription-key': process.env.SARVAM_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: textToTranslate,
          source_language_code: 'en-IN',
          target_language_code: targetLanguage,
          speaker_gender: 'Female',
          mode: 'formal',
          model: 'mayura:v1',
          enable_preprocessing: true,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Sarvam API error ${response.status}: ${err}`)
      }

      const data = (await response.json()) as SarvamTranslateResponse
      // Sarvam: ~$0.50/1M characters
      const costUsd = (textToTranslate.length / 1_000_000) * 0.50

      return {
        type: 'text',
        content: data.translated_text,
        costUsd,
        latencyMs: Date.now() - start,
        metadata: { sourceLanguage: 'en-IN', targetLanguage, charCount: textToTranslate.length },
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.SARVAM_API_KEY)
  }
}

function extractTranslatableText(fullPrompt: string): string {
  // Find the most recent completed output to translate
  const outputs = fullPrompt.match(/## .*\n([\s\S]+?)(?:\n##|# Your Task|$)/g) || []
  if (outputs.length > 0) {
    const lastOutput = outputs[outputs.length - 1]
    const content = lastOutput.replace(/^## .*\n/, '').trim()
    return content.slice(0, 4000)
  }
  const taskMatch = fullPrompt.match(/# Your Task\n([\s\S]+?)(?:\n#|$)/)
  if (taskMatch) return taskMatch[1].trim().slice(0, 4000)
  return fullPrompt.slice(0, 4000)
}
