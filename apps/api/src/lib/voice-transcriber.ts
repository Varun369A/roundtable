/**
 * Enterprise voice transcription library
 *
 * Supports two providers:
 *   - Whisper (OpenAI) — general purpose, multilingual
 *   - Sarvam AI        — specialised for Indian languages, higher accuracy
 *
 * Provider selection:
 *   If the requested language is in SARVAM_LANGUAGES AND SARVAM_API_KEY is set
 *   → Sarvam; otherwise → Whisper.
 */

import OpenAI, { toFile } from 'openai'
import FormData from 'form-data'
import fetch from 'node-fetch'  // Node 18 has native fetch; fallback is fine either way
import { prisma } from '@sabha/db'
import type { VoiceTranscription } from '@sabha/db'

// ─── Provider maps ────────────────────────────────────────────────────────────

/** Indian-language ISO 639-1 codes supported by Sarvam AI */
export const SARVAM_LANGUAGES: Record<string, string> = {
  hi: 'Hindi',
  bn: 'Bengali',
  te: 'Telugu',
  mr: 'Marathi',
  ta: 'Tamil',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  ur: 'Urdu',
}

/** Languages supported by OpenAI Whisper (superset of Sarvam) */
export const WHISPER_LANGUAGES: string[] = [
  'en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml',
]

/**
 * ISO 639-1 → BCP-47 mapping required by the Sarvam speech-to-text API.
 * All Indian regional languages use the IN country subtag.
 */
const SARVAM_BCP47: Record<string, string> = {
  hi: 'hi-IN',
  bn: 'bn-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  ur: 'ur-IN',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranscribeOptions {
  audioBuffer: Buffer
  mimeType: string    // 'audio/webm' | 'audio/mp3' | 'audio/wav' | 'audio/ogg'
  language?: string   // ISO 639-1; defaults to 'en'
  userId: string
  taskId?: string
}

export interface TranscribeResult {
  transcriptionId: string
  processedText: string
  language: string
  provider: 'whisper' | 'sarvam'
  confidence: number
  durationSecs: number
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Derive a file extension from a MIME type so that Whisper can identify the
 * codec.  Falls back to 'webm' which Whisper handles gracefully.
 */
function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a',
    'audio/flac': 'flac',
    'audio/opus': 'opus',
  }
  return map[mimeType.toLowerCase()] ?? 'webm'
}

/**
 * Rough duration estimate from buffer size for Whisper (which does not return
 * duration in its response).  Assumes ~128 kbps compressed audio.
 *   bytes / (bitrate_bps / 8) = seconds
 *   bytes / (128_000 / 8)     = bytes / 16_000
 */
function estimateDuration(buf: Buffer): number {
  return Math.max(0.1, buf.length / 16_000)
}

/**
 * Post-process raw transcription text:
 *   1. Trim leading/trailing whitespace.
 *   2. Capitalise the first letter.
 *   3. Ensure the string ends with sentence-terminating punctuation.
 */
function postProcess(text: string): string {
  let t = text.trim()
  if (!t) return t

  // Capitalise first character (works for ASCII and most Unicode scripts)
  t = t.charAt(0).toUpperCase() + t.slice(1)

  // Append a period if the text doesn't already end in punctuation
  if (!/[.!?।۔؟]$/.test(t)) {
    t = t + '.'
  }

  return t
}

// ─── Whisper provider ─────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface WhisperResult {
  rawText: string
  durationSecs: number
}

async function transcribeWithWhisper(
  audioBuffer: Buffer,
  mimeType: string,
  language: string,
): Promise<WhisperResult> {
  const ext = extFromMime(mimeType)
  const filename = `audio.${ext}`

  const file = await toFile(audioBuffer, filename, { type: mimeType })

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: language === 'en' ? undefined : language, // Whisper auto-detects English well
    response_format: 'text',
  })

  // response_format: 'text' returns the plain string directly
  const rawText = typeof response === 'string' ? response : (response as { text: string }).text ?? ''

  return {
    rawText,
    durationSecs: estimateDuration(audioBuffer),
  }
}

// ─── Sarvam provider ──────────────────────────────────────────────────────────

interface SarvamApiResponse {
  transcript?: string
  language_code?: string
  durationInSeconds?: number
  error?: string
}

interface SarvamResult {
  rawText: string
  durationSecs: number
  confidence: number
}

async function transcribeWithSarvam(
  audioBuffer: Buffer,
  mimeType: string,
  language: string,
): Promise<SarvamResult> {
  const apiKey = process.env.SARVAM_API_KEY!
  const bcp47 = SARVAM_BCP47[language] ?? `${language}-IN`
  const ext = extFromMime(mimeType)

  const form = new FormData()
  form.append('file', audioBuffer, {
    filename: `audio.${ext}`,
    contentType: mimeType,
  })
  form.append('language_code', bcp47)
  form.append('model', 'saarika:v2')

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    body: form,
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '(no body)')
    throw new Error(`Sarvam API error ${response.status}: ${errBody}`)
  }

  const data = (await response.json()) as SarvamApiResponse

  if (!data.transcript) {
    throw new Error('Sarvam API returned empty transcript')
  }

  return {
    rawText: data.transcript,
    durationSecs: data.durationInSeconds ?? estimateDuration(audioBuffer),
    // Sarvam doesn't expose a confidence score; use a high default
    confidence: 0.92,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Transcribe an audio buffer.
 *
 * Provider selection:
 *   - Sarvam if language ∈ SARVAM_LANGUAGES AND SARVAM_API_KEY is configured
 *   - Whisper otherwise
 */
export async function transcribeAudio(opts: TranscribeOptions): Promise<TranscribeResult> {
  const language = opts.language ?? 'en'
  const useSarvam =
    language in SARVAM_LANGUAGES &&
    Boolean(process.env.SARVAM_API_KEY?.trim())

  const provider: 'whisper' | 'sarvam' = useSarvam ? 'sarvam' : 'whisper'

  let rawText: string
  let durationSecs: number
  let confidence: number

  if (useSarvam) {
    const result = await transcribeWithSarvam(opts.audioBuffer, opts.mimeType, language)
    rawText = result.rawText
    durationSecs = result.durationSecs
    confidence = result.confidence
  } else {
    const result = await transcribeWithWhisper(opts.audioBuffer, opts.mimeType, language)
    rawText = result.rawText
    durationSecs = result.durationSecs
    // Whisper does not expose a per-transcription confidence score
    confidence = 0.90
  }

  let processedText = postProcess(rawText)

  // Advisory note when using Whisper for Indian languages: Sarvam may be more
  // accurate but is not configured.  Append a metadata comment to processedText
  // only when SARVAM_API_KEY is absent so operators can act on it.
  if (!useSarvam && language in SARVAM_LANGUAGES && !process.env.SARVAM_API_KEY?.trim()) {
    processedText += ' [Note: Configure SARVAM_API_KEY for higher accuracy on Indian languages]'
  }

  // Persist to database
  const record = await prisma.voiceTranscription.create({
    data: {
      userId: opts.userId,
      taskId: opts.taskId ?? null,
      provider,
      language,
      durationSecs,
      originalText: rawText,
      processedText,
      confidence,
    },
  })

  return {
    transcriptionId: record.id,
    processedText,
    language,
    provider,
    confidence,
    durationSecs,
  }
}

/**
 * Fetch a single VoiceTranscription by ID, scoped to the requesting user.
 * Returns null if not found or if the record belongs to a different user.
 */
export async function getTranscription(
  id: string,
  userId: string,
): Promise<VoiceTranscription | null> {
  const record = await prisma.voiceTranscription.findUnique({ where: { id } })
  if (!record || record.userId !== userId) return null
  return record
}

// ─── Language detection heuristic ────────────────────────────────────────────

/**
 * Lightweight language detection based on Unicode script ranges.
 *
 * Returns an ISO 639-1 code if a non-Latin script is predominant, otherwise
 * falls back to 'en'.
 *
 * This is intentionally simple — for production use consider a dedicated
 * library such as `franc` or `@lenghia/languagedetect`.
 */
export function detectLanguageFromText(text: string): string {
  if (!text) return 'en'

  // Count characters in each script range
  const counts: Record<string, number> = {
    devanagari: 0,  // Hindi, Marathi — U+0900–U+097F
    bengali: 0,     // Bengali        — U+0980–U+09FF
    telugu: 0,      // Telugu         — U+0C00–U+0C7F
    tamil: 0,       // Tamil          — U+0B80–U+0BFF
    gujarati: 0,    // Gujarati       — U+0A80–U+0AFF
    kannada: 0,     // Kannada        — U+0C80–U+0CFF
    malayalam: 0,   // Malayalam      — U+0D00–U+0D7F
    gurmukhi: 0,    // Punjabi        — U+0A00–U+0A7F
    arabic: 0,      // Urdu           — U+0600–U+06FF
  }

  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp >= 0x0900 && cp <= 0x097f) counts.devanagari++
    else if (cp >= 0x0980 && cp <= 0x09ff) counts.bengali++
    else if (cp >= 0x0c00 && cp <= 0x0c7f) counts.telugu++
    else if (cp >= 0x0b80 && cp <= 0x0bff) counts.tamil++
    else if (cp >= 0x0a80 && cp <= 0x0aff) counts.gujarati++
    else if (cp >= 0x0c80 && cp <= 0x0cff) counts.kannada++
    else if (cp >= 0x0d00 && cp <= 0x0d7f) counts.malayalam++
    else if (cp >= 0x0a00 && cp <= 0x0a7f) counts.gurmukhi++
    else if (cp >= 0x0600 && cp <= 0x06ff) counts.arabic++
  }

  // Find the script with the most characters
  let maxScript = ''
  let maxCount = 0
  for (const [script, count] of Object.entries(counts)) {
    if (count > maxCount) { maxCount = count; maxScript = script }
  }

  // Require at least 5% of characters to be in a non-Latin script
  const threshold = Math.max(3, text.length * 0.05)
  if (maxCount < threshold) return 'en'

  const scriptToIso: Record<string, string> = {
    devanagari: 'hi',
    bengali:    'bn',
    telugu:     'te',
    tamil:      'ta',
    gujarati:   'gu',
    kannada:    'kn',
    malayalam:  'ml',
    gurmukhi:   'pa',
    arabic:     'ur',
  }

  return scriptToIso[maxScript] ?? 'en'
}
