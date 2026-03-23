import { BaseConnector, ConnectorInput, ConnectorOutput } from './base.connector'
import type { AIModel } from '@arivarangam/types'
import { uploadToStorage } from '../lib/storage'

// Default voice: Rachel — natural, clear, professional
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

// ElevenLabs voices registry
export const ELEVENLABS_VOICES: Record<string, string> = {
  'rachel':    '21m00Tcm4TlvDq8ikWAM',
  'domi':      'AZnzlk1XvdvUeBnXmlld',
  'bella':     'EXAVITQu4vr4xnSDxMaL',
  'antonio':   'ErXwobaYiN019PkySvjV',
  'elli':      'MF3mGyEYCl7XYWbV9V6O',
  'josh':      'TxGEqnHWrfWFTfGW9XjX',
  'arnold':    'VR6AewLTigWG4xSOukaG',
  'adam':      'pNInz6obpgDQGcFmaJgB',
  'sam':       'yoZ06aMxZJJ28mfd3POQ',
}

export class ElevenLabsConnector extends BaseConnector {
  readonly model: AIModel = 'elevenlabs'
  readonly provider = 'elevenlabs'

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set')

    const start = Date.now()
    const voiceId = ELEVENLABS_VOICES[input.options?.voice || 'rachel'] || DEFAULT_VOICE_ID

    // Extract the text to speak from the prompt
    const textToSpeak = extractSpeakableText(input.prompt)

    return this.withRetry(async () => {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY!,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text: textToSpeak,
            model_id: 'eleven_turbo_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.5,
              use_speaker_boost: true,
            },
          }),
        }
      )

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`ElevenLabs API error ${response.status}: ${err}`)
      }

      const audioBuffer = await response.arrayBuffer()
      const audioBytes = Buffer.from(audioBuffer)

      // Upload to storage (S3/R2)
      const fileName = `audio/${input.taskId}/${input.subtaskId}.mp3`
      const fileUrl = await uploadToStorage(fileName, audioBytes, 'audio/mpeg')

      // ElevenLabs charges ~$0.30 per 1000 characters
      const charCount = textToSpeak.length
      const costUsd = (charCount / 1000) * 0.30

      return {
        type: 'audio',
        content: `Voiceover generated: ${charCount} characters`,
        fileUrl,
        fileSizeBytes: audioBytes.length,
        costUsd,
        latencyMs: Date.now() - start,
        metadata: { charCount, voiceId, textPreview: textToSpeak.slice(0, 100) },
      }
    })
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.ELEVENLABS_API_KEY)
  }
}

function extractSpeakableText(fullPrompt: string): string {
  // Look for completed copywriting output first
  const copyMatch = fullPrompt.match(/## .*(?:Write|Copy|Script|Content).*\n([\s\S]+?)(?:\n##|$)/i)
  if (copyMatch) return copyMatch[1].trim().slice(0, 5000)

  // Look for Your Task section
  const taskMatch = fullPrompt.match(/# Your Task\n([\s\S]+?)(?:\n#|$)/)
  if (taskMatch) return taskMatch[1].trim().slice(0, 5000)

  return fullPrompt.slice(0, 5000)
}
