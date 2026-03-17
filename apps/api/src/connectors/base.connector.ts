import type { AIModel } from '@sabha/types'

export interface ConnectorInput {
  prompt: string
  model: AIModel
  taskId: string
  subtaskId: string
  userApiKey?: string
  options?: {
    maxTokens?: number
    temperature?: number
    imageSize?: '1024x1024' | '1792x1024' | '1024x1792'
    voice?: string
    language?: string
  }
}

export interface ConnectorOutput {
  type: 'text' | 'image' | 'audio' | 'video' | 'json'
  content?: string          // for text outputs
  fileUrl?: string          // for media outputs
  fileSizeBytes?: number
  inputTokens?: number
  outputTokens?: number
  costUsd: number
  latencyMs: number
  metadata?: Record<string, unknown>
}

export abstract class BaseConnector {
  abstract readonly model: AIModel
  abstract readonly provider: string

  abstract execute(input: ConnectorInput): Promise<ConnectorOutput>

  abstract isAvailable(): Promise<boolean>

  protected handleError(err: unknown, context: string): never {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`[${this.provider}:${this.model}] ${context}: ${message}`)
  }

  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000
  ): Promise<T> {
    let lastErr: unknown
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (err) {
        lastErr = err
        const isRateLimit =
          err instanceof Error &&
          (err.message.includes('429') || err.message.toLowerCase().includes('rate limit'))

        if (!isRateLimit && attempt > 0) throw err

        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
        console.warn(`[${this.provider}] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
    throw lastErr
  }
}
