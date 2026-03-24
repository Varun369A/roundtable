import OpenAI from 'openai'
import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

export class ImageConnector extends BaseConnector {
  readonly model: AIModel = 'gpt-image-1'
  readonly provider = 'openai'
  private client: OpenAI

  constructor() {
    super()
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not set')

    const start = Date.now()
    const client = this.client

    return this.withRetry(async () => {
      const response = await client.images.generate({
        model: 'gpt-image-1',
        prompt: input.prompt,
        n: 1,
        size: '1024x1024',
        quality: 'high',
      })

      const imageData = response.data?.[0]
      // gpt-image-1 returns base64 by default
      const b64 = imageData?.b64_json
      const url = imageData?.url

      // Cost: $0.04 per image at high quality
      const costUsd = 0.04

      return {
        type:      'image',
        content:   b64 ? `data:image/png;base64,${b64}` : '',
        fileUrl:   url || undefined,
        costUsd,
        latencyMs: Date.now() - start,
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.OPENAI_API_KEY)
  }
}
