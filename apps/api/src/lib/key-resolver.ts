/**
 * Key Resolver — returns the user's own API key for a given provider,
 * if they have connected it via BYOAI. Falls back to undefined so the
 * connector uses its own env var.
 */
import { prisma } from '@sabha/db'
import { decryptByoai } from './encrypt'
import type { AIModel } from '@sabha/types'

// Maps AIModel → provider key (matches ProviderDef.key in provider-registry)
const MODEL_TO_PROVIDER: Partial<Record<AIModel, string>> = {
  'claude-3-5-sonnet': 'anthropic',
  'claude-3-opus':     'anthropic',
  'gpt-4o':            'openai',
  'gpt-4-turbo':       'openai',
  'dalle-3':           'openai',
  'gemini-pro':        'google',
  'perplexity-sonar':  'perplexity',
  'elevenlabs':        'elevenlabs',
  'stability-xl':      'stability',
  'groq':              'groq',
  'cohere':            'cohere',
  'sarvam-1':          'sarvam',
  'runway-gen3':       'runway',
  'midjourney-v6':     'midjourney',
}

/**
 * Resolve user's own API key for a given model.
 * Returns the plaintext key if found and active, or undefined otherwise.
 */
export async function resolveUserApiKey(
  userId: string,
  model: AIModel,
): Promise<string | undefined> {
  const provider = MODEL_TO_PROVIDER[model]
  if (!provider) return undefined

  try {
    const conn = await prisma.userAIConnection.findUnique({
      where: { userId_provider: { userId, provider } },
      select: { encryptedKey: true, iv: true, authTag: true, isActive: true, isVerified: true },
    })

    if (!conn || !conn.isActive || !conn.isVerified) return undefined

    const key = decryptByoai(conn.encryptedKey, conn.iv, conn.authTag)

    // Update lastUsedAt non-blocking
    prisma.userAIConnection.update({
      where: { userId_provider: { userId, provider } },
      data: { lastUsedAt: new Date() },
    }).catch(() => {})

    return key
  } catch {
    return undefined
  }
}

/**
 * Get the provider key for a given model.
 */
export function getProviderForModel(model: AIModel): string | undefined {
  return MODEL_TO_PROVIDER[model]
}
