/**
 * AES-256-GCM encryption helpers.
 *
 * Two separate encryption keys:
 *   ENV_VAR_ENCRYPTION_KEY  — project environment variables (ProjectEnvVar)
 *   BYOAI_KEY_ENCRYPTION_KEY — user-connected AI provider keys (UserAIConnection)
 *
 * Both are 32-byte hex strings (64 hex chars). Generate with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

function resolveKey(envVar: string): Buffer {
  const hex = process.env[envVar] || ''
  if (!hex || hex.length < 64) {
    if (process.env.NODE_ENV !== 'production') {
      return crypto.randomBytes(32)  // dev only — not persistent
    }
    throw new Error(`${envVar} must be set in production (32-byte hex string)`)
  }
  return Buffer.from(hex.slice(0, 64), 'hex')
}

function getKey(): Buffer {
  return resolveKey('ENV_VAR_ENCRYPTION_KEY')
}

function getByoaiKey(): Buffer {
  return resolveKey('BYOAI_KEY_ENCRYPTION_KEY')
}

export interface EncryptedValue {
  encryptedValue: string  // hex
  iv: string              // hex (12 bytes)
  authTag: string         // hex (16 bytes)
}

export function encrypt(plaintext: string): EncryptedValue {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    encryptedValue: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  }
}

export function decrypt(encryptedValue: string, iv: string, authTag: string): string {
  const key = getKey()
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  ) as crypto.DecipherGCM
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'hex')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

// ── BYOAI key encryption (uses BYOAI_KEY_ENCRYPTION_KEY) ─────────────────────

export function encryptByoai(plaintext: string): EncryptedValue {
  const key = getByoaiKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return {
    encryptedValue: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  }
}

export function decryptByoai(encryptedValue: string, iv: string, authTag: string): string {
  const key = getByoaiKey()
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  ) as crypto.DecipherGCM
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}
