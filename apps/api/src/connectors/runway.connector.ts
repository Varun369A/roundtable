import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'

/**
 * Runway Gen-3 connector.
 * Runway API is async — generate → poll → download.
 *
 * NOTE: Runway API is in limited beta. This connector handles
 * the full async flow with polling.
 */
export class RunwayConnector extends BaseConnector {
  readonly model: AIModel = 'runway-gen3'
  readonly provider = 'runway'

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    if (!process.env.RUNWAY_API_KEY) throw new Error('RUNWAY_API_KEY not set')

    const start = Date.now()
    const videoPrompt = extractVideoPrompt(input.prompt)

    return this.withRetry(async () => {
      // Step 1: Submit generation task
      const submitResponse = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-11-06',
        },
        body: JSON.stringify({
          promptText: videoPrompt,
          model: 'gen3a_turbo',
          duration: 5,
          ratio: '1280:768',
        }),
      })

      if (!submitResponse.ok) {
        const err = await submitResponse.text()
        throw new Error(`Runway submit error ${submitResponse.status}: ${err}`)
      }

      const { id: taskId } = (await submitResponse.json()) as { id: string }

      // Step 2: Poll for completion (max 5 minutes)
      const videoUrl = await this.pollForCompletion(taskId, 300_000)

      // Runway Gen-3: ~$0.05 per second, 5 sec = $0.25
      return {
        type: 'video',
        content: `Video generated: ${videoPrompt.slice(0, 100)}`,
        fileUrl: videoUrl,
        costUsd: 0.25,
        latencyMs: Date.now() - start,
        metadata: { prompt: videoPrompt, duration: 5, taskId },
      }
    })
  }

  private async pollForCompletion(taskId: string, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs
    const pollIntervalMs = 5000

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollIntervalMs))

      const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
          'X-Runway-Version': '2024-11-06',
        },
      })

      if (!response.ok) continue

      const task = (await response.json()) as {
        status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
        output?: string[]
        failure?: string
      }

      if (task.status === 'SUCCEEDED' && task.output?.[0]) {
        return task.output[0]
      }

      if (task.status === 'FAILED') {
        throw new Error(`Runway generation failed: ${task.failure || 'Unknown error'}`)
      }
    }

    throw new Error('Runway generation timed out after 5 minutes')
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.RUNWAY_API_KEY)
  }
}

function extractVideoPrompt(fullPrompt: string): string {
  const taskMatch = fullPrompt.match(/# Your Task\n([\s\S]+?)(?:\n#|$)/)
  if (taskMatch) return taskMatch[1].trim().slice(0, 500)
  return fullPrompt.slice(0, 500)
}
