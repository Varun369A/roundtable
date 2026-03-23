import OpenAI from 'openai'
import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

// DALL-E 3 pricing per image
const PRICING: Record<string, number> = {
  '1024x1024':  0.040,
  '1792x1024':  0.080,
  '1024x1792':  0.080,
}

export class DalleConnector extends BaseConnector {
  readonly model: AIModel = 'dalle-3'
  readonly provider = 'openai'
  private client: OpenAI

  constructor() {
    super()
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set')

    const start = Date.now()
    const size = input.options?.imageSize || '1024x1024'

    return this.withRetry(async () => {
      // Extract the actual image prompt from the full context prompt
      const imagePrompt = extractImagePrompt(input.prompt)

      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size,
        quality: 'hd',
        response_format: 'url',
      })

      const firstImage = response.data?.[0]
      const imageUrl = firstImage?.url
      if (!imageUrl) throw new Error('No image URL in response')

      return {
        type: 'image',
        content: `Generated image: ${imagePrompt.slice(0, 100)}`,
        fileUrl: imageUrl,
        costUsd: PRICING[size] || PRICING['1024x1024'],
        latencyMs: Date.now() - start,
        metadata: { prompt: imagePrompt, size, revisedPrompt: firstImage?.revised_prompt },
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.OPENAI_API_KEY)
  }
}

/**
 * Extract a clean image generation prompt from the full context prompt.
 * DALL-E needs a direct visual description, not a full context block.
 */
function extractImagePrompt(fullPrompt: string): string {
  // Look for "Your Task" section first
  const taskMatch = fullPrompt.match(/# Your Task\n([\s\S]+?)(?:\n#|$)/)
  if (taskMatch) {
    return taskMatch[1].trim().slice(0, 1000)
  }
  // Fallback: last paragraph
  const paragraphs = fullPrompt.split('\n\n').filter(Boolean)
  return paragraphs[paragraphs.length - 1]?.trim().slice(0, 1000) || fullPrompt.slice(0, 1000)
}
