/**
 * Log Scrubber — redacts API keys and secrets from all log messages.
 *
 * Apply to ALL loggers, error handlers, queue job data, and webhook payloads.
 * A key appearing in any log constitutes a security incident.
 *
 * Usage:
 *   import { scrubLogs } from './log-scrubber'
 *   console.log(scrubLogs(someString))
 *
 *   // Or wrap console globally at startup:
 *   import { installGlobalLogScrubber } from './log-scrubber'
 *   installGlobalLogScrubber()
 */

const KEY_PATTERNS: RegExp[] = [
  // OpenAI / Anthropic standard keys
  /sk-[a-zA-Z0-9]{32,}/g,
  // Anthropic keys (sk-ant-...)
  /sk-ant-[a-zA-Z0-9\-]{32,}/g,
  // Google AI / Firebase keys (AIza...)
  /AIza[a-zA-Z0-9_\-]{35}/g,
  // Perplexity keys (pplx-...)
  /pplx-[a-zA-Z0-9]{32,}/g,
  // GitHub personal access tokens
  /ghp_[a-zA-Z0-9]{36}/g,
  // GitHub fine-grained tokens
  /github_pat_[a-zA-Z0-9_]{82}/g,
  // AWS access keys
  /AKIA[A-Z0-9]{16}/g,
  // Razorpay live/test keys
  /rzp_(?:live|test)_[a-zA-Z0-9]{14}/g,
  // ElevenLabs
  /[a-f0-9]{32}(?=[^a-f0-9]|$)/g,
  // Bearer tokens in Authorization headers
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
  // Generic long hex secrets (32+ chars) — catches vault keys, JWT secrets, etc.
  /\b[0-9a-f]{64}\b/g,
  // PEM private keys
  /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/g,
]

/**
 * Scrub a string, replacing all detected secrets with [REDACTED].
 * Safe to call with any input — returns original string on null/undefined.
 */
export function scrubLogs(message: string): string {
  if (!message || typeof message !== 'string') return message
  let scrubbed = message
  for (const pattern of KEY_PATTERNS) {
    // Reset lastIndex for global regexes before each pass
    pattern.lastIndex = 0
    scrubbed = scrubbed.replace(pattern, '[REDACTED]')
  }
  return scrubbed
}

/**
 * Scrub an arbitrary value (string, object, error).
 * Serialises objects to JSON for scanning, then parses back.
 */
export function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return scrubLogs(value)
  }
  if (value instanceof Error) {
    value.message = scrubLogs(value.message)
    if (value.stack) value.stack = scrubLogs(value.stack)
    return value
  }
  if (typeof value === 'object' && value !== null) {
    try {
      const json = JSON.stringify(value)
      const scrubbed = scrubLogs(json)
      return JSON.parse(scrubbed)
    } catch {
      return value
    }
  }
  return value
}

/**
 * Install a global console wrapper that scrubs all output.
 * Call once at process startup, before any other imports.
 */
export function installGlobalLogScrubber(): void {
  const methods = ['log', 'info', 'warn', 'error', 'debug'] as const

  for (const method of methods) {
    const original = console[method].bind(console)
    console[method] = (...args: unknown[]) => {
      const scrubbed = args.map((arg) =>
        typeof arg === 'string' ? scrubLogs(arg) : scrubValue(arg)
      )
      original(...scrubbed)
    }
  }
}

/**
 * Fastify serializer hook — scrubs log entries before they hit any transport.
 * Register with: fastify.addHook('onSend', scrubFastifyResponse)
 */
export function scrubObject<T extends Record<string, unknown>>(obj: T): T {
  try {
    const json = JSON.stringify(obj)
    const scrubbed = scrubLogs(json)
    return JSON.parse(scrubbed) as T
  } catch {
    return obj
  }
}
