/**
 * Language detection for Sabha's India language layer.
 *
 * Strategy:
 * 1. Unicode script detection (zero-cost, instant) — covers all Indian scripts
 * 2. Sarvam AI language detection API (when available) — for mixed/ambiguous text
 * 3. Fallback to English
 */

export interface DetectedLanguage {
  code: string        // ISO 639-1: 'hi', 'ta', 'te', etc.
  sarvamCode: string  // Sarvam API code: 'hi-IN', 'ta-IN', etc.
  name: string        // Display name: 'Hindi', 'Tamil', etc.
  confidence: 'high' | 'medium' | 'low'
  needsTranslation: boolean
}

// Unicode script ranges for Indian languages
const SCRIPT_RANGES: Array<{ range: RegExp; code: string; sarvamCode: string; name: string }> = [
  { range: /[\u0900-\u097F]/, code: 'hi', sarvamCode: 'hi-IN', name: 'Hindi'     },
  { range: /[\u0B80-\u0BFF]/, code: 'ta', sarvamCode: 'ta-IN', name: 'Tamil'     },
  { range: /[\u0C00-\u0C7F]/, code: 'te', sarvamCode: 'te-IN', name: 'Telugu'    },
  { range: /[\u0C80-\u0CFF]/, code: 'kn', sarvamCode: 'kn-IN', name: 'Kannada'   },
  { range: /[\u0D00-\u0D7F]/, code: 'ml', sarvamCode: 'ml-IN', name: 'Malayalam' },
  { range: /[\u0900-\u097F]/, code: 'mr', sarvamCode: 'mr-IN', name: 'Marathi'   }, // shares Devanagari with Hindi
  { range: /[\u0980-\u09FF]/, code: 'bn', sarvamCode: 'bn-IN', name: 'Bengali'   },
  { range: /[\u0A80-\u0AFF]/, code: 'gu', sarvamCode: 'gu-IN', name: 'Gujarati'  },
  { range: /[\u0A00-\u0A7F]/, code: 'pa', sarvamCode: 'pa-IN', name: 'Punjabi'   },
  { range: /[\u0B00-\u0B7F]/, code: 'or', sarvamCode: 'or-IN', name: 'Odia'      },
]

export const SUPPORTED_LANGUAGES: Record<string, { name: string; sarvamCode: string; nativeName: string }> = {
  en: { name: 'English',    sarvamCode: 'en-IN', nativeName: 'English'    },
  hi: { name: 'Hindi',      sarvamCode: 'hi-IN', nativeName: 'हिन्दी'      },
  ta: { name: 'Tamil',      sarvamCode: 'ta-IN', nativeName: 'தமிழ்'       },
  te: { name: 'Telugu',     sarvamCode: 'te-IN', nativeName: 'తెలుగు'      },
  kn: { name: 'Kannada',    sarvamCode: 'kn-IN', nativeName: 'ಕನ್ನಡ'       },
  ml: { name: 'Malayalam',  sarvamCode: 'ml-IN', nativeName: 'മലയാളം'      },
  mr: { name: 'Marathi',    sarvamCode: 'mr-IN', nativeName: 'मराठी'       },
  bn: { name: 'Bengali',    sarvamCode: 'bn-IN', nativeName: 'বাংলা'        },
  gu: { name: 'Gujarati',   sarvamCode: 'gu-IN', nativeName: 'ગુજરાતી'      },
  pa: { name: 'Punjabi',    sarvamCode: 'pa-IN', nativeName: 'ਪੰਜਾਬੀ'       },
  or: { name: 'Odia',       sarvamCode: 'or-IN', nativeName: 'ଓଡ଼ିଆ'        },
}

/**
 * Fast, zero-cost language detection using Unicode script analysis.
 * Reliable for pure-script inputs. For Roman-script Indian languages
 * (Hinglish etc.) it defaults to English.
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.trim().length === 0) {
    return makeResult('en', 'low')
  }

  // Count characters per script
  const scriptCounts = new Map<string, number>()
  let totalNonAscii = 0

  for (const char of text) {
    const code = char.codePointAt(0) || 0
    if (code > 127) totalNonAscii++

    for (const script of SCRIPT_RANGES) {
      if (script.range.test(char)) {
        scriptCounts.set(script.code, (scriptCounts.get(script.code) || 0) + 1)
      }
    }
  }

  if (scriptCounts.size === 0) {
    // All ASCII — English (or Romanized Indian language)
    return makeResult('en', 'high')
  }

  // Find dominant script
  let maxCode = ''
  let maxCount = 0
  for (const [code, count] of scriptCounts) {
    if (count > maxCount) {
      maxCount = count
      maxCode = code
    }
  }

  // Confidence based on proportion of non-ASCII chars matching the dominant script
  const dominanceRatio = totalNonAscii > 0 ? maxCount / totalNonAscii : 0
  const confidence: 'high' | 'medium' | 'low' =
    dominanceRatio > 0.8 ? 'high' :
    dominanceRatio > 0.5 ? 'medium' : 'low'

  return makeResult(maxCode, confidence)
}

function makeResult(code: string, confidence: 'high' | 'medium' | 'low'): DetectedLanguage {
  const lang = SUPPORTED_LANGUAGES[code] || SUPPORTED_LANGUAGES['en']
  return {
    code,
    sarvamCode: lang.sarvamCode,
    name: lang.name,
    confidence,
    needsTranslation: code !== 'en',
  }
}

/**
 * Detect language using Sarvam API (more accurate for ambiguous cases).
 * Falls back to Unicode detection if API is unavailable.
 */
export async function detectLanguageWithAI(text: string): Promise<DetectedLanguage> {
  if (!process.env.SARVAM_API_KEY) {
    return detectLanguage(text)
  }

  try {
    const response = await fetch('https://api.sarvam.ai/text-lid', {
      method: 'POST',
      headers: {
        'api-subscription-key': process.env.SARVAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text.slice(0, 500) }),
    })

    if (!response.ok) throw new Error(`Sarvam LID error ${response.status}`)

    const data = (await response.json()) as { language_code: string }
    const sarvamCode = data.language_code // e.g. "hi-IN"
    const langCode = sarvamCode.split('-')[0]

    if (SUPPORTED_LANGUAGES[langCode]) {
      return makeResult(langCode, 'high')
    }
  } catch {
    // fall through to Unicode detection
  }

  return detectLanguage(text)
}
