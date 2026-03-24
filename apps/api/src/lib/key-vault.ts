/**
 * Key Vault — per-user encrypted API key storage.
 *
 * Security model:
 *   - Master key lives in AWS KMS (production) or env var (development only)
 *   - Each key uses a random 32-byte salt + per-user scrypt derivation
 *   - derivedKey = scrypt(KMS_master_key + userId, salt, 32)
 *   - Cipher: AES-256-GCM with random 16-byte IV + auth tag
 *   - scrypt is ASYNC — never blocks the event loop
 *   - Raw key never touches logs, responses, or any persistent field
 *
 * KMS setup (production):
 *   1. Create a KMS symmetric key in ap-south-1
 *   2. Encrypt VAULT_MASTER_KEY with that KMS key → base64 blob
 *   3. Set ENCRYPTED_MASTER_KEY=<base64_blob>, KMS_KEY_ID=<key_arn> in env
 *   4. Grant Lambda/EC2 IAM role kms:Decrypt on that key only
 *   Stolen .env = useless. Stolen DB = useless. Both required together.
 */

import crypto from 'node:crypto'
import { prisma } from '@arivarangam/db'

const ALGORITHM = 'aes-256-gcm' as const

// ─── KMS / master key resolution ─────────────────────────────────────────────

/** Cache decrypted master key for up to 5 minutes — avoid KMS call per request */
let _cachedMasterKey: Buffer | null = null
let _cacheExpiresAt = 0

async function getMasterKey(): Promise<Buffer> {
  const now = Date.now()
  if (_cachedMasterKey && now < _cacheExpiresAt) return _cachedMasterKey

  // Production path: decrypt from AWS KMS
  if (process.env.NODE_ENV === 'production' && process.env.ENCRYPTED_MASTER_KEY) {
    const { KMSClient, DecryptCommand } = await import('@aws-sdk/client-kms')
    const kms = new KMSClient({ region: process.env.AWS_REGION || 'ap-south-1' })
    const response = await kms.send(new DecryptCommand({
      CiphertextBlob: Buffer.from(process.env.ENCRYPTED_MASTER_KEY, 'base64'),
      KeyId: process.env.KMS_KEY_ID,
    }))
    if (!response.Plaintext) throw new Error('KMS decrypt returned empty Plaintext')
    _cachedMasterKey = Buffer.from(response.Plaintext)
    _cacheExpiresAt  = now + 5 * 60 * 1000 // 5-minute cache
    return _cachedMasterKey
  }

  // Dev / staging path: env var (never used in production)
  const hex = process.env.VAULT_MASTER_KEY || ''
  if (!hex || hex.length < 64) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'VAULT_MASTER_KEY or ENCRYPTED_MASTER_KEY+KMS_KEY_ID must be set in production. ' +
        'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      )
    }
    // Dev fallback — deterministic, NOT for production
    console.warn('[KeyVault] Using dev fallback master key — set VAULT_MASTER_KEY in .env')
    _cachedMasterKey = Buffer.from('dev_vault_key_not_for_production_use_replace_000', 'utf8').slice(0, 32)
    _cacheExpiresAt  = now + 60_000
    return _cachedMasterKey
  }

  _cachedMasterKey = Buffer.from(hex.slice(0, 64), 'hex')
  _cacheExpiresAt  = now + 5 * 60 * 1000
  return _cachedMasterKey
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VaultEncrypted {
  encrypted: string  // hex
  salt:      string  // hex (32 bytes)
  iv:        string  // hex (16 bytes)
  authTag:   string  // hex (16 bytes)
}

// ─── Async scrypt helpers ─────────────────────────────────────────────────────

/** Async scrypt — never blocks the event loop */
function scryptAsync(password: string | Buffer, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, keylen, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  )
}

// ─── Core encrypt / decrypt ───────────────────────────────────────────────────

/**
 * Encrypt a raw API key for vault storage.
 * Per-user scrypt derivation: even with the same master key, each user's
 * encrypted blob cannot decrypt another user's key.
 */
export async function encryptApiKey(
  userId:  string,
  rawKey:  string  // Never store rawKey. Never log rawKey.
): Promise<VaultEncrypted> {
  const masterKey = await getMasterKey()
  const salt      = crypto.randomBytes(32)
  const iv        = crypto.randomBytes(16)

  const derivedKey = await scryptAsync(
    masterKey.toString('hex') + userId,
    salt,
    32
  )

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv) as crypto.CipherGCM
  const encrypted = Buffer.concat([cipher.update(rawKey, 'utf8'), cipher.final()])
  const authTag   = cipher.getAuthTag()

  return {
    encrypted: encrypted.toString('hex'),
    salt:      salt.toString('hex'),
    iv:        iv.toString('hex'),
    authTag:   authTag.toString('hex'),
  }
}

/**
 * Decrypt a stored API key.
 * Never log the return value. Never send it in an API response.
 */
export async function decryptApiKey(
  userId: string,
  vault:  VaultEncrypted
): Promise<string> {
  const masterKey  = await getMasterKey()
  const derivedKey = await scryptAsync(
    masterKey.toString('hex') + userId,
    Buffer.from(vault.salt, 'hex'),
    32
  )

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    derivedKey,
    Buffer.from(vault.iv, 'hex')
  ) as crypto.DecipherGCM
  decipher.setAuthTag(Buffer.from(vault.authTag, 'hex'))

  return Buffer.concat([
    decipher.update(Buffer.from(vault.encrypted, 'hex')),
    decipher.final(),
  ]).toString('utf8')  // Never store rawKey. Never log rawKey.
}

// ─── resolveApiKey ────────────────────────────────────────────────────────────

/**
 * Spec's resolveApiKey — single authoritative function for API key selection:
 *   1. User's own stored key (decrypted from vault)
 *   2. Arivarangam's platform key ONLY if plan === 'FREE' AND freeTasksRemaining > 0
 *   3. Throw NO_KEY_AVAILABLE — never silently succeed for paid plans
 *
 * CRITICAL: Arivarangam pays API costs ONLY for FREE users.
 * Builder / Studio / Enterprise with no connected key → hard throw.
 * No paid user ever runs on Arivarangam's dime.
 */
export async function resolveApiKey(
  userId:   string,
  provider: string
): Promise<{ key: string; billedTo: 'user' | 'arivarangam' }> {
  // 1. Try user's own key
  const conn = await prisma.userAIConnection.findUnique({
    where:  { userId_provider: { userId, provider } },
    select: {
      encryptedKey: true,
      salt:         true,
      iv:           true,
      authTag:      true,
      isActive:     true,
      isVerified:   true,
    },
  })

  if (conn?.isActive && conn.isVerified) {
    const key = conn.salt
      // New vault format: per-user scrypt derivation
      ? await decryptApiKey(userId, {
          encrypted: conn.encryptedKey,
          salt:      conn.salt,
          iv:        conn.iv,
          authTag:   conn.authTag,
        })
      // Legacy format: static-key encryption — will be migrated via re-save
      : await (async () => {
          const { decryptByoai } = await import('./encrypt')
          return decryptByoai(conn.encryptedKey, conn.iv, conn.authTag) as string
        })()

    void prisma.userAIConnection.update({
      where: { userId_provider: { userId, provider } },
      data:  { lastUsedAt: new Date() },
    }).catch(() => {})

    return { key, billedTo: 'user' }
  }

  // 2. FREE plan with remaining budget → Arivarangam's platform key.
  // GUARD: Arivarangam fallback is STRICTLY gated to FREE plan only.
  // Any paid tier (BUILDER / STUDIO / ENTERPRISE) with no key → throw.
  //
  // RACE CONDITION FIX: Use atomic `updateMany` with a WHERE guard instead of
  // read-then-check. Two concurrent requests for the same user cannot both
  // decrement past 0 — only the first UPDATE where freeTasksRemaining > 0
  // succeeds (count === 1); the second gets count === 0 and is rejected.
  const result = await prisma.user.updateMany({
    where: { id: userId, tier: 'FREE', freeTasksRemaining: { gt: 0 } },
    data:  { freeTasksRemaining: { decrement: 1 } },
  })

  if (result.count > 0) {
    const platformKey = process.env[`${provider.toUpperCase()}_API_KEY`]
    if (platformKey) return { key: platformKey, billedTo: 'arivarangam' }
    // Platform key missing from env — restore the budget we just decremented
    await prisma.user.update({
      where: { id: userId },
      data:  { freeTasksRemaining: { increment: 1 } },
    }).catch(() => {})
  }

  throw new Error(`NO_KEY_AVAILABLE_FOR_${provider.toUpperCase()}`)
}

// ─── validateAndStoreApiKey ───────────────────────────────────────────────────

/**
 * Validate a raw key then encrypt and upsert into vault.
 * Raw key is never stored or logged — only its encrypted form persists.
 */
export async function validateAndStoreApiKey(
  userId:   string,
  provider: string,
  rawKey:   string  // Never store rawKey. Never log rawKey.
): Promise<{ valid: boolean; reason?: string }> {
  const { testApiKey } = await import('./key-tester')
  const result = await testApiKey(provider, rawKey)

  if (!result.valid) {
    const reason =
      result.error?.includes('Invalid') || result.error?.includes('401') ? 'INVALID_KEY'    :
      result.error?.includes('429')                                       ? 'QUOTA_EXCEEDED' :
      result.error?.includes('402')                                       ? 'NO_CREDITS'     :
                                                                            'UNKNOWN'
    return { valid: false, reason }
  }

  const vault = await encryptApiKey(userId, rawKey)

  await prisma.userAIConnection.upsert({
    where:  { userId_provider: { userId, provider } },
    update: {
      encryptedKey: vault.encrypted,
      salt:         vault.salt,
      iv:           vault.iv,
      authTag:      vault.authTag,
      isVerified:   true,
      verifiedAt:   new Date(),
      isActive:     true,
    },
    create: {
      userId,
      provider,
      encryptedKey: vault.encrypted,
      salt:         vault.salt,
      iv:           vault.iv,
      authTag:      vault.authTag,
      isVerified:   true,
      verifiedAt:   new Date(),
    },
  })

  return { valid: true }
}
