/**
 * Key Resolver — thin shim that delegates to key-vault.ts.
 *
 * resolveApiKey is the single authoritative function for deciding which
 * API key to use for a provider call:
 *   1. User's own key (decrypted via key-vault)
 *   2. Sabha's platform key (FREE users with remaining tasks)
 *   3. Throws NO_KEY_AVAILABLE if neither exists
 *
 * resolveUserApiKey is kept for backward compatibility with connectors that
 * already import it — it wraps resolveApiKey and returns undefined instead
 * of throwing when no user key exists.
 */

import type { AIModel } from '@sabha/types'
import { resolveApiKey as vaultResolve } from './key-vault'

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
 * Resolve the API key and billing owner for a given model.
 * Use this in the orchestrator — it handles all fallback logic.
 */
export async function resolveApiKey(
  userId: string,
  provider: string
): Promise<{ key: string; billedTo: 'user' | 'sabha' }> {
  return vaultResolve(userId, provider)
}

/**
 * Resolve user's own API key for a given model.
 * Returns undefined if no key is found (does not fall back to Sabha's keys).
 * Kept for connectors that need to know if the user has their own key.
 */
export async function resolveUserApiKey(
  userId: string,
  model: AIModel,
): Promise<string | undefined> {
  const provider = MODEL_TO_PROVIDER[model]
  if (!provider) return undefined

  try {
    const { key, billedTo } = await vaultResolve(userId, provider)
    // Only return the key if it belongs to the user
    return billedTo === 'user' ? key : undefined
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
