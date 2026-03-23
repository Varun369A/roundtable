import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'
import { uploadToStorage } from '../lib/storage'

export class StabilityConnector extends BaseConnector {
  readonly model: AIModel = 'stability-xl'
  readonly provider = 'stability'

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    if (!process.env.STABILITY_API_KEY) throw new Error('STABILITY_API_KEY not set')

    const start = Date.now()
    const imagePrompt = extractImagePrompt(input.prompt)

    return this.withRetry(async () => {
      const formData = new FormData()
      formData.append('prompt', imagePrompt)
      formData.append('output_format', 'png')
      formData.append('aspect_ratio', '1:1')

      const response = await fetch(
        'https://api.stability.ai/v2beta/stable-image/generate/ultra',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
            'Accept': 'image/*',
          },
          body: formData,
        }
      )

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Stability AI error ${response.status}: ${err}`)
      }

      const imageBuffer = await response.arrayBuffer()
      const imageBytes = Buffer.from(imageBuffer)

      const fileName = `images/${input.taskId}/${input.subtaskId}.png`
      const fileUrl = await uploadToStorage(fileName, imageBytes, 'image/png')

      // Stability AI Ultra: ~$0.08 per image
      return {
        type: 'image',
        content: `Image generated: ${imagePrompt.slice(0, 100)}`,
        fileUrl,
        fileSizeBytes: imageBytes.length,
        costUsd: 0.08,
        latencyMs: Date.now() - start,
        metadata: { prompt: imagePrompt },
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.STABILITY_API_KEY)
  }
}

function extractImagePrompt(fullPrompt: string): string {
  const taskMatch = fullPrompt.match(/# Your Task\n([\s\S]+?)(?:\n#|$)/)
  if (taskMatch) return taskMatch[1].trim().slice(0, 1000)
  const paragraphs = fullPrompt.split('\n\n').filter(Boolean)
  return paragraphs[paragraphs.length - 1]?.trim().slice(0, 1000) || fullPrompt.slice(0, 1000)
}
