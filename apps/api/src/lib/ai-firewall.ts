/**
 * AI Firewall — runs on every prompt before it reaches an AI model.
 *
 * Two-phase pipeline:
 *   1. SANITIZE  — redact PII and secrets (always runs, non-blocking)
 *   2. THREAT    — detect prompt injection / jailbreak (blocks if riskScore >= 80)
 *
 * Produces a FirewallResult with: sanitized text, detected threats, riskScore 0-100.
 * Logs all threats to DB (FirewallLog model) for audit.
 */

import { PrismaClient } from '@arivarangam/db'

const prisma = new PrismaClient()

export enum FirewallThreatType {
  PII_EMAIL = 'PII_EMAIL',
  PII_PHONE = 'PII_PHONE',
  PII_CREDIT_CARD = 'PII_CREDIT_CARD',
  PII_SSN = 'PII_SSN',
  PII_AADHAAR = 'PII_AADHAAR',
  API_KEY = 'API_KEY',
  PROMPT_INJECTION = 'PROMPT_INJECTION',
  JAILBREAK = 'JAILBREAK',
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',
  EXCESSIVE_LENGTH = 'EXCESSIVE_LENGTH',
}

export interface FirewallThreat {
  type: FirewallThreatType
  description: string
  redacted: boolean
  position?: number
}

export interface FirewallResult {
  allowed: boolean
  sanitized: string
  threats: FirewallThreat[]
  riskScore: number
  originalLength: number
  sanitizedLength: number
}

export interface FirewallOptions {
  blockOnRiskScore?: number
  maxLength?: number
  context?: 'user_input' | 'ai_prompt' | 'ai_output'
}

// ---------------------------------------------------------------------------
// PII Patterns
// ---------------------------------------------------------------------------

interface PiiPattern {
  regex: RegExp
  placeholder: string
  threatType: FirewallThreatType
  description: string
}

const PII_PATTERNS: PiiPattern[] = [
  {
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    placeholder: '[EMAIL]',
    threatType: FirewallThreatType.PII_EMAIL,
    description: 'Email address detected and redacted',
  },
  {
    // Indian mobile numbers (6-9 starting digit, 10 digits total) — linear pattern, no backtracking
    regex: /(?<!\d)[6-9]\d{9}(?!\d)/g,
    placeholder: '[PHONE]',
    threatType: FirewallThreatType.PII_PHONE,
    description: 'Indian phone number detected and redacted',
  },
  {
    // International phone numbers (10-15 digits, optional leading +) — linear pattern
    regex: /(?<!\d)[+]?[0-9]{10,15}(?!\d)/g,
    placeholder: '[PHONE]',
    threatType: FirewallThreatType.PII_PHONE,
    description: 'International phone number detected and redacted',
  },
  {
    // Credit/debit card 16 digits (various separators)
    regex: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g,
    placeholder: '[CARD]',
    threatType: FirewallThreatType.PII_CREDIT_CARD,
    description: 'Credit/debit card number detected and redacted',
  },
  {
    // Indian Aadhaar 12 digit (with optional spaces every 4)
    regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    placeholder: '[AADHAAR]',
    threatType: FirewallThreatType.PII_AADHAAR,
    description: 'Aadhaar number detected and redacted',
  },
  {
    // PAN card: ABCDE1234F format
    regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
    placeholder: '[PAN]',
    threatType: FirewallThreatType.PII_SSN,
    description: 'PAN card number detected and redacted',
  },
  {
    // US SSN: 123-45-6789 or 123456789
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    placeholder: '[SSN]',
    threatType: FirewallThreatType.PII_SSN,
    description: 'US SSN detected and redacted',
  },
  {
    // API keys: sk-*, ghp_*, gsk_*, AKIA*, ya29.*
    regex: /\b(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36,}|gsk_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|ya29\.[A-Za-z0-9._\-]{40,})\b/g,
    placeholder: '[API_KEY]',
    threatType: FirewallThreatType.API_KEY,
    description: 'API key detected and redacted',
  },
  {
    // Bearer tokens in text
    regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
    placeholder: 'Bearer [API_KEY]',
    threatType: FirewallThreatType.API_KEY,
    description: 'Bearer token detected and redacted',
  },
  {
    // Private key blocks
    regex: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/g,
    placeholder: '[PRIVATE_KEY]',
    threatType: FirewallThreatType.API_KEY,
    description: 'Private key block detected and redacted',
  },
]

// ---------------------------------------------------------------------------
// Injection / Jailbreak Patterns
// ---------------------------------------------------------------------------

interface ThreatPattern {
  regex: RegExp
  score: number
  type: FirewallThreatType
  description: string
}

const INJECTION_PATTERNS: ThreatPattern[] = [
  {
    regex: /ignore\s+(previous|all|above)\s+instructions/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: instruction override attempt',
  },
  {
    regex: /you\s+are\s+now\b/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: role reassignment attempt',
  },
  {
    regex: /\bact\s+as\b/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: persona substitution attempt',
  },
  {
    regex: /pretend\s+to\s+be\b/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: persona substitution attempt',
  },
  {
    regex: /roleplay\s+as\b/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: roleplay persona attempt',
  },
  {
    regex: /system\s+prompt/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: system prompt reference',
  },
  {
    regex: /initial\s+prompt/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: initial prompt reference',
  },
  {
    regex: /your\s+instructions/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: instruction reference',
  },
  {
    regex: /\bjailbreak\b/gi,
    score: 20,
    type: FirewallThreatType.JAILBREAK,
    description: 'Jailbreak keyword detected',
  },
  {
    regex: /\bDAN\b/g,
    score: 20,
    type: FirewallThreatType.JAILBREAK,
    description: 'Jailbreak: DAN (Do Anything Now) pattern',
  },
  {
    regex: /do\s+anything\s+now/gi,
    score: 20,
    type: FirewallThreatType.JAILBREAK,
    description: 'Jailbreak: DAN pattern detected',
  },
  {
    regex: /\bbypass\b/gi,
    score: 20,
    type: FirewallThreatType.JAILBREAK,
    description: 'Jailbreak: bypass attempt',
  },
  {
    regex: /\boverride\b/gi,
    score: 20,
    type: FirewallThreatType.JAILBREAK,
    description: 'Jailbreak: override attempt',
  },
  {
    regex: /disable\s+(?:your|the)\s+(?:safety|filter|restriction)/gi,
    score: 20,
    type: FirewallThreatType.JAILBREAK,
    description: 'Jailbreak: safety disable attempt',
  },
  // Additional patterns from spec
  {
    regex: /forget\s+(?:your|all|previous)?\s*instructions/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: instruction erasure attempt',
  },
  {
    regex: /reveal\s+(?:your|the)?\s*(?:system\s+)?prompt/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: system prompt exfiltration attempt',
  },
  {
    regex: /(?:print|show|list|display)\s+(?:all\s+)?(?:users|accounts|records|data)/gi,
    score: 30,
    type: FirewallThreatType.DATA_EXFILTRATION,
    description: 'Data exfiltration: bulk data dump attempt',
  },
  {
    regex: /show\s+(?:me\s+)?(?:other|another)\s+(?:user|users|account)/gi,
    score: 30,
    type: FirewallThreatType.DATA_EXFILTRATION,
    description: 'Data exfiltration: cross-user data access attempt',
  },
  {
    regex: /what\s+is\s+(?:your\s+)?(?:system\s+)?prompt/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: system prompt probing',
  },
  {
    regex: /\bdisregard\b/gi,
    score: 15,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: disregard instruction attempt',
  },
  {
    regex: /new\s+instructions?(?:\s+are|\s+follow|\s*:)/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: new instructions substitution',
  },
  // ── Indian language injection patterns (romanised transliteration) ──────────
  {
    // Hindi: "sab instructions bhool jao / bhul jao" (forget all instructions)
    regex: /(?:sab|saari?)\s+instructions?\s+(?:bhoo?l|mat mano)/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: Hindi instruction erasure attempt',
  },
  {
    // Hindi: "ab se tum X ho" (you are now X)
    regex: /ab\s+(?:se\s+)?tum\b/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: Hindi role reassignment attempt',
  },
  {
    // Hindi: "naye nirdesh" (new instructions) / "naye instructions"
    regex: /nay[ei]\s+(?:nirdesh|instructions?)/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: Hindi new instructions substitution',
  },
  {
    // Tamil romanised: "murai maatru" (change rules) / "vilaiyadal" (jailbreak-like)
    regex: /murai\s+maa?tru/gi,
    score: 20,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Prompt injection: Tamil rule-change attempt',
  },
  {
    // Devanagari script: instruction override keywords (नियम बदलो, सब भूल जाओ)
    regex: /[\u0900-\u097F]{3,}\s+[\u0900-\u097F]{3,}\s+[\u0900-\u097F]{3,}/g,
    score: 10,
    type: FirewallThreatType.PROMPT_INJECTION,
    description: 'Devanagari script injection pattern detected (flagged for review)',
  },
]

const EXFILTRATION_PATTERNS: ThreatPattern[] = [
  {
    regex: /send\s+(?:this|the|all)\s+(?:to|via)\b/gi,
    score: 30,
    type: FirewallThreatType.DATA_EXFILTRATION,
    description: 'Data exfiltration: send data pattern detected',
  },
  {
    regex: /email\s+(?:this|these)\s+to\b/gi,
    score: 30,
    type: FirewallThreatType.DATA_EXFILTRATION,
    description: 'Data exfiltration: email data pattern detected',
  },
  {
    regex: /post\s+to\s+https?:\/\//gi,
    score: 30,
    type: FirewallThreatType.DATA_EXFILTRATION,
    description: 'Data exfiltration: HTTP post pattern detected',
  },
  {
    regex: /https?:\/\/[^\s"'<>]+/gi,
    score: 10,
    type: FirewallThreatType.DATA_EXFILTRATION,
    description: 'URL detected in prompt (flagged, not blocked)',
  },
]

// ---------------------------------------------------------------------------
// Phase 1: Sanitize
// ---------------------------------------------------------------------------

function sanitize(text: string): { sanitized: string; threats: FirewallThreat[] } {
  const threats: FirewallThreat[] = []
  let sanitized = text

  for (const pattern of PII_PATTERNS) {
    const matches = [...sanitized.matchAll(pattern.regex)]
    if (matches.length > 0) {
      for (const match of matches) {
        threats.push({
          type: pattern.threatType,
          description: pattern.description,
          redacted: true,
          position: match.index,
        })
      }
      sanitized = sanitized.replace(pattern.regex, pattern.placeholder)
    }
  }

  return { sanitized, threats }
}

// ---------------------------------------------------------------------------
// Phase 2: Threat detection
// ---------------------------------------------------------------------------

function detectThreats(text: string): { threats: FirewallThreat[]; riskScore: number } {
  const threats: FirewallThreat[] = []
  let injectionScore = 0
  let exfilScore = 0

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.regex.test(text)) {
      // Reset lastIndex for global regexes
      pattern.regex.lastIndex = 0
      threats.push({
        type: pattern.type,
        description: pattern.description,
        redacted: false,
      })
      injectionScore = Math.min(injectionScore + pattern.score, 80)
    }
    // Reset after test
    pattern.regex.lastIndex = 0
  }

  for (const pattern of EXFILTRATION_PATTERNS) {
    if (pattern.regex.test(text)) {
      pattern.regex.lastIndex = 0
      threats.push({
        type: pattern.type,
        description: pattern.description,
        redacted: false,
      })
      exfilScore = Math.min(exfilScore + pattern.score, 60)
    }
    pattern.regex.lastIndex = 0
  }

  const riskScore = Math.min(injectionScore + exfilScore, 100)
  return { threats, riskScore }
}

// ---------------------------------------------------------------------------
// Main firewall function
// ---------------------------------------------------------------------------

export async function firewall(
  text: string,
  options: FirewallOptions = {}
): Promise<FirewallResult> {
  // Unicode NFKC normalisation — prevents look-alike character bypass attacks
  // (e.g. full-width "ｉｇｎｏｒｅ" → "ignore", homoglyph substitutions)
  text = text.normalize('NFKC')

  const blockOnRiskScore = options.blockOnRiskScore ?? 80
  const maxLength = options.maxLength ?? 8000

  const originalLength = text.length
  const threats: FirewallThreat[] = []
  let riskScore = 0

  // Excessive length check
  if (text.length > maxLength) {
    threats.push({
      type: FirewallThreatType.EXCESSIVE_LENGTH,
      description: `Input exceeds maximum allowed length of ${maxLength} characters (got ${text.length})`,
      redacted: false,
    })
    riskScore = Math.min(riskScore + 40, 100)
    text = text.slice(0, maxLength)
  }

  // Phase 1: Sanitize PII
  const { sanitized: sanitizedText, threats: piiThreats } = sanitize(text)
  threats.push(...piiThreats)

  // Phase 2: Detect threats on sanitized text
  const { threats: detectedThreats, riskScore: detectedScore } = detectThreats(sanitizedText)
  threats.push(...detectedThreats)
  riskScore = Math.min(riskScore + detectedScore, 100)

  const allowed = riskScore < blockOnRiskScore

  return {
    allowed,
    sanitized: sanitizedText,
    threats,
    riskScore,
    originalLength,
    sanitizedLength: sanitizedText.length,
  }
}

// ---------------------------------------------------------------------------
// firewallPrompt — wraps firewall(), logs to DB, throws if blocked
// ---------------------------------------------------------------------------

export async function firewallPrompt(
  prompt: string,
  taskId?: string,
  userId?: string
): Promise<FirewallResult> {
  if (prompt.length > 50_000) {
    prompt = prompt.substring(0, 50_000) // truncate enormous inputs before regex scanning
  }
  const result = await firewall(prompt, { context: 'ai_prompt' })

  if (result.threats.length > 0) {
    try {
      await prisma.firewallLog.create({
        data: {
          taskId: taskId ?? null,
          userId: userId ?? null,
          threats: result.threats as any,
          riskScore: result.riskScore,
          blocked: !result.allowed,
          createdAt: new Date(),
        },
      })
    } catch (err) {
      // Non-fatal: log failure shouldn't break the request
      console.error('[ai-firewall] Failed to write FirewallLog:', err)
    }
  }

  if (!result.allowed) {
    const err = new Error(
      `Request blocked by AI Firewall. Risk score: ${result.riskScore}/100. ` +
        `Threats detected: ${result.threats.map((t) => t.description).join('; ')}`
    ) as any
    err.code = 'FIREWALL_BLOCKED'
    err.riskScore = result.riskScore
    err.threats = result.threats
    throw err
  }

  return result
}
