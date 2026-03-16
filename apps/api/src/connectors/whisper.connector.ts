import OpenAI from 'openai'
import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@sabha/types'

/**
 * Whisper connector — OpenAI speech-to-text.
 * Best for: transcribing audio, meeting notes, podcast transcripts.
 * Pricing: $0.006/minute
 *
 * Input: the prompt should contain a URL to an audio file, or
 * the task context will include it.
 */
export class WhisperConnector extends BaseConnector {
  readonly model: AIModel = 'elevenlabs' // shares audio category
  readonly provider = 'openai-whisper'
  private client: OpenAI

  constructor() {
    super()
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set')

    const start = Date.now()

    // Extract audio URL from prompt if present
    const audioUrl = extractAudioUrl(input.prompt)

    if (!audioUrl) {
      // No audio to transcribe — return transcription instructions instead
      return {
        type: 'text',
        content: 'No audio file provided for transcription. Please provide an audio file URL in your task.',
        costUsd: 0,
        latencyMs: Date.now() - start,
      }
    }

    return this.withRetry(async () => {
      // Download audio file
      const audioResponse = await fetch(audioUrl)
      if (!audioResponse.ok) throw new Error(`Could not fetch audio from ${audioUrl}`)

      const audioBuffer = await audioResponse.arrayBuffer()
      const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' })

      const transcription = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
      })

      // $0.006/minute
      const durationMinutes = (transcription as { duration?: number }).duration
        ? ((transcription as { duration: number }).duration / 60)
        : 1
      const costUsd = durationMinutes * 0.006

      return {
        type: 'text',
        content: transcription.text,
        costUsd,
        latencyMs: Date.now() - start,
        metadata: {
          durationSeconds: (transcription as { duration?: number }).duration,
          language: (transcription as { language?: string }).language,
        },
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.OPENAI_API_KEY)
  }
}

function extractAudioUrl(prompt: string): string | null {
  const urlMatch = prompt.match(/https?:\/\/[^\s]+\.(mp3|wav|m4a|ogg|flac)/i)
  return urlMatch ? urlMatch[0] : null
}
