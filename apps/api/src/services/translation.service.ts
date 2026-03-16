import { redis } from '../lib/redis'
import { SUPPORTED_LANGUAGES } from '../lib/language-detector'

const CACHE_TTL = 60 * 60 * 24 * 7 // 7 days — translations are deterministic

interface SarvamTranslateResponse {
  translated_text: string
  request_id: string
}

interface SarvamTTSResponse {
  audios: string[] // base64 encoded audio
  request_id: string
}

/**
 * Translate text between languages using Sarvam AI.
 * Results are cached in Redis to minimize API costs.
 */
export async function translate(params: {
  text: string
  sourceLang: string  // ISO code: 'en', 'hi', 'ta', etc.
  targetLang: string
}): Promise<{ translated: string; costUsd: number; cached: boolean }> {
  const { text, sourceLang, targetLang } = params

  // No-op: same language
  if (sourceLang === targetLang) {
    return { translated: text, costUsd: 0, cached: true }
  }

  // Cache key
  const cacheKey = `translate:${sourceLang}:${targetLang}:${hashText(text)}`
  const cached = await redis.get(cacheKey)
  if (cached) {
    return { translated: cached, costUsd: 0, cached: true }
  }

  const sourceSarvam = SUPPORTED_LANGUAGES[sourceLang]?.sarvamCode || 'en-IN'
  const targetSarvam = SUPPORTED_LANGUAGES[targetLang]?.sarvamCode || 'en-IN'

  const translated = await callSarvamTranslate(text, sourceSarvam, targetSarvam)

  // Cache result
  await redis.setex(cacheKey, CACHE_TTL, translated)

  // Sarvam: ~$0.50/1M characters
  const costUsd = (text.length / 1_000_000) * 0.50

  return { translated, costUsd, cached: false }
}

/**
 * Translate a full task output back to the user's language.
 * Handles large outputs by chunking at sentence/paragraph boundaries.
 */
export async function translateOutput(params: {
  text: string
  targetLang: string
  maxChunkSize?: number
}): Promise<{ translated: string; costUsd: number }> {
  const { text, targetLang, maxChunkSize = 4000 } = params

  if (targetLang === 'en' || !text) {
    return { translated: text, costUsd: 0 }
  }

  // Split into chunks at paragraph boundaries
  const chunks = splitIntoChunks(text, maxChunkSize)
  let totalCost = 0
  const translatedChunks: string[] = []

  for (const chunk of chunks) {
    const result = await translate({ text: chunk, sourceLang: 'en', targetLang })
    translatedChunks.push(result.translated)
    totalCost += result.costUsd
  }

  return {
    translated: translatedChunks.join('\n\n'),
    costUsd: totalCost,
  }
}

/**
 * Translate user input from their language to English for AI processing.
 */
export async function translateToEnglish(params: {
  text: string
  sourceLang: string
}): Promise<{ translated: string; costUsd: number; cached: boolean }> {
  return translate({ text: params.text, sourceLang: params.sourceLang, targetLang: 'en' })
}

/**
 * Text-to-speech in Indian languages via Sarvam.
 * Returns base64-encoded audio.
 */
export async function textToSpeechIndian(params: {
  text: string
  language: string
  speaker?: string
}): Promise<{ audioBase64: string; costUsd: number }> {
  if (!process.env.SARVAM_API_KEY) {
    throw new Error('SARVAM_API_KEY not set')
  }

  const sarvamCode = SUPPORTED_LANGUAGES[params.language]?.sarvamCode || 'hi-IN'

  const response = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'api-subscription-key': process.env.SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: [params.text.slice(0, 500)],
      target_language_code: sarvamCode,
      speaker: params.speaker || 'meera',
      pitch: 0,
      pace: 1.0,
      loudness: 1.5,
      speech_sample_rate: 8000,
      enable_preprocessing: true,
      model: 'bulbul:v1',
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Sarvam TTS error ${response.status}: ${err}`)
  }

  const data = (await response.json()) as SarvamTTSResponse
  const audioBase64 = data.audios[0] || ''
  const costUsd = (params.text.length / 1_000_000) * 0.30

  return { audioBase64, costUsd }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function callSarvamTranslate(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  if (!process.env.SARVAM_API_KEY) {
    // Fallback: prefix text with a note (for dev/testing without API key)
    return `[${targetLang} translation] ${text}`
  }

  const response = await fetch('https://api.sarvam.ai/translate', {
    method: 'POST',
    headers: {
      'api-subscription-key': process.env.SARVAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      source_language_code: sourceLang,
      target_language_code: targetLang,
      speaker_gender: 'Female',
      mode: 'formal',
      model: 'mayura:v1',
      enable_preprocessing: true,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Sarvam translate error ${response.status}: ${err}`)
  }

  const data = (await response.json()) as SarvamTranslateResponse
  return data.translated_text
}

function splitIntoChunks(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text]

  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  let current = ''

  for (const para of paragraphs) {
    if ((current + para).length > maxSize && current) {
      chunks.push(current.trim())
      current = para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }

  if (current) chunks.push(current.trim())
  return chunks.filter(Boolean)
}

function hashText(text: string): string {
  let hash = 0
  for (let i = 0; i < Math.min(text.length, 200); i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}
