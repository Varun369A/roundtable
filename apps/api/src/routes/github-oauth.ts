/**
 * GitHub OAuth routes.
 *
 * GET /api/v1/github/auth/start      — redirect to GitHub OAuth
 * GET /api/v1/github/auth/callback   — handle OAuth callback
 * GET /api/v1/github/connection      — get connected account info
 * DELETE /api/v1/github/connection   — disconnect GitHub account
 *
 * Security: GitHub access tokens are encrypted at rest using AES-256-GCM
 * with the VAULT_MASTER_KEY. The plaintext token is never stored in the DB.
 */

import crypto from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { exchangeCodeForToken, getGitHubUser } from '../lib/github'

const ALGORITHM = 'aes-256-gcm'

function getGithubEncryptionKey(): Buffer {
  const hex = process.env.VAULT_MASTER_KEY || ''
  if (hex.length < 64) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('VAULT_MASTER_KEY must be set in production for GitHub token encryption')
    }
    // Dev fallback — NOT for production
    return Buffer.from('dev_vault_key_not_for_production_use_replace_000', 'utf8').slice(0, 32)
  }
  return Buffer.from(hex.slice(0, 64), 'hex')
}

function encryptGithubToken(token: string): string {
  const key = getGithubEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptGithubToken(encryptedStr: string): string {
  const key = getGithubEncryptionKey()
  const parts = encryptedStr.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted GitHub token format')
  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const ciphertext = Buffer.from(parts[2], 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}

export async function githubOAuthRoutes(app: FastifyInstance): Promise<void> {

  // GET /auth/start — redirect to GitHub OAuth consent screen
  app.get('/auth/start', { preHandler: [requireAuth] }, async (request, reply) => {
    const clientId    = process.env.GITHUB_CLIENT_ID
    const redirectUri = process.env.GITHUB_REDIRECT_URI

    if (!clientId || !redirectUri) {
      return reply.status(500).send({ success: false, error: { code: 'GITHUB_NOT_CONFIGURED', message: 'GitHub OAuth is not configured' } })
    }

    // Encode userId in state param to verify on callback
    const state = Buffer.from(JSON.stringify({ userId: request.user!.id, t: Date.now() })).toString('base64url')

    const url = new URL('https://github.com/login/oauth/authorize')
    url.searchParams.set('client_id',    clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope',        'repo')
    url.searchParams.set('state',        state)

    return reply.redirect(url.toString())
  })

  // GET /auth/callback — GitHub redirects here with ?code=...&state=...
  app.get('/auth/callback', async (request, reply) => {
    const { code, state, error } = request.query as Record<string, string>

    if (error) {
      return reply.redirect(`${process.env.WEB_URL}/settings/github?error=${encodeURIComponent(error)}`)
    }
    if (!code || !state) {
      return reply.redirect(`${process.env.WEB_URL}/settings/github?error=missing_params`)
    }

    let userId: string
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
      userId = decoded.userId
      // Basic replay protection: state must be less than 10 minutes old
      if (Date.now() - decoded.t > 10 * 60_000) throw new Error('state expired')
    } catch {
      return reply.redirect(`${process.env.WEB_URL}/settings/github?error=invalid_state`)
    }

    try {
      const token   = await exchangeCodeForToken(code)
      const ghUser  = await getGitHubUser(token)

      // Encrypt token before storage — never store plaintext GitHub tokens
      const encryptedToken = encryptGithubToken(token)

      await prisma.gitHubConnection.upsert({
        where:  { userId },
        update: {
          accessToken: encryptedToken,
          login:       ghUser.login,
          githubId:    ghUser.id,
          avatarUrl:   ghUser.avatarUrl,
        },
        create: {
          userId,
          accessToken: encryptedToken,
          login:       ghUser.login,
          githubId:    ghUser.id,
          avatarUrl:   ghUser.avatarUrl ?? null,
          scopes:      'repo',
        },
      })

      return reply.redirect(`${process.env.WEB_URL}/settings/github?connected=true`)
    } catch (err: any) {
      app.log.error({ err }, '[github-oauth] callback error')
      return reply.redirect(`${process.env.WEB_URL}/settings/github?error=${encodeURIComponent(err.message)}`)
    }
  })

  // GET /connection — get connected account info
  app.get('/connection', { preHandler: [requireAuth] }, async (request, reply) => {
    const conn = await prisma.gitHubConnection.findUnique({
      where:  { userId: request.user!.id },
      // Never expose the encrypted token — select only metadata fields
      select: { login: true, avatarUrl: true, githubId: true, createdAt: true },
    })
    return reply.send({ success: true, data: { connection: conn ?? null } })
  })

  // DELETE /connection — disconnect GitHub account
  app.delete('/connection', { preHandler: [requireAuth] }, async (request, reply) => {
    await prisma.gitHubConnection.deleteMany({ where: { userId: request.user!.id } })
    return reply.send({ success: true })
  })
}

/**
 * Exported for use by code-projects route when pushing to GitHub.
 * Decrypts the stored token for in-memory use only — never log or return.
 */
export { decryptGithubToken }
