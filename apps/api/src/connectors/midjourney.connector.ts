import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

/**
 * Midjourney connector.
 *
 * Midjourney does not have an official REST API.
 * Options:
 *   1. ImagineAPI / GoAPI (unofficial paid proxy) - available today
 *   2. Official API - waitlisted
 *
 * This connector uses ImagineAPI as the proxy.
 * Set MIDJOURNEY_API_KEY and MIDJOURNEY_API_URL in .env.
 *
 * Falls back to DALL-E 3 if Midjourney is not available.
 */
export class MidjourneyConnector extends BaseConnector {
  readonly model: AIModel = 'midjourney-v6'
  readonly provider = 'midjourney'

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    const start = Date.now()

    // Check if proxy is configured
    if (!process.env.MIDJOURNEY_API_KEY || !process.env.MIDJOURNEY_API_URL) {
      console.warn('[Midjourney] API not configured, falling back to DALL-E 3')
      const { DalleConnector } = await import('./dalle.connector')
      const dalle = new DalleConnector()
      return dalle.execute({ ...input, model: 'dalle-3' })
    }

    const imagePrompt = extractImagePrompt(input.prompt)

    return this.withRetry(async () => {
      // Submit to ImagineAPI proxy
      const submitResponse = await fetch(`${process.env.MIDJOURNEY_API_URL}/imagine`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MIDJOURNEY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `${imagePrompt} --v 6.1 --ar 16:9 --q 2`,
          webhook_url: '',
          webhook_type: 'result',
        }),
      })

      if (!submitResponse.ok) {
        throw new Error(`Midjourney submit error ${submitResponse.status}`)
      }

      const { task_id } = (await submitResponse.json()) as { task_id: string }

      // Poll for result (max 3 minutes)
      const imageUrl = await this.pollForResult(task_id, 180_000)

      // Midjourney via proxy: ~$0.01-0.04 per image
      return {
        type: 'image',
        content: `Midjourney image generated: ${imagePrompt.slice(0, 100)}`,
        fileUrl: imageUrl,
        costUsd: 0.02,
        latencyMs: Date.now() - start,
        metadata: { prompt: imagePrompt },
      }
    })
  }

  private async pollForResult(taskId: string, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000))

      const response = await fetch(
        `${process.env.MIDJOURNEY_API_URL}/tasks/${taskId}`,
        {
          headers: { 'Authorization': `Bearer ${process.env.MIDJOURNEY_API_KEY}` },
        }
      )

      if (!response.ok) continue

      const task = (await response.json()) as {
        status: string
        task_result?: { discord_image_url?: string; image_url?: string }
      }

      if (task.status === 'finished') {
        const url = task.task_result?.image_url || task.task_result?.discord_image_url
        if (url) return url
        throw new Error('Midjourney task finished but no image URL')
      }

      if (task.status === 'failed') {
        throw new Error('Midjourney generation failed')
      }
    }

    throw new Error('Midjourney generation timed out')
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.MIDJOURNEY_API_KEY && process.env.MIDJOURNEY_API_URL)
  }
}

function extractImagePrompt(fullPrompt: string): string {
  const taskMatch = fullPrompt.match(/# Your Task\n([\s\S]+?)(?:\n#|$)/)
  if (taskMatch) return taskMatch[1].trim().slice(0, 800)
  const paragraphs = fullPrompt.split('\n\n').filter(Boolean)
  return paragraphs[paragraphs.length - 1]?.trim().slice(0, 800) || fullPrompt.slice(0, 800)
}
