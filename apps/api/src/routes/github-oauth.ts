/**
 * GitHub OAuth routes.
 *
 * GET /api/v1/github/auth/start      — redirect to GitHub OAuth
 * GET /api/v1/github/auth/callback   — handle OAuth callback
 * GET /api/v1/github/connection      — get connected account info
 * DELETE /api/v1/github/connection   — disconnect GitHub account
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { exchangeCodeForToken, getGitHubUser } from '../lib/github'

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

      await (prisma as any).gitHubConnection.upsert({
        where:  { userId },
        update: { accessToken: token, login: ghUser.login, githubId: ghUser.id, avatarUrl: ghUser.avatarUrl },
        create: { userId, accessToken: token, login: ghUser.login, githubId: ghUser.id, avatarUrl: ghUser.avatarUrl ?? null, scopes: 'repo' },
      })

      return reply.redirect(`${process.env.WEB_URL}/settings/github?connected=true`)
    } catch (err: any) {
      app.log.error({ err }, '[github-oauth] callback error')
      return reply.redirect(`${process.env.WEB_URL}/settings/github?error=${encodeURIComponent(err.message)}`)
    }
  })

  // GET /connection — get connected account info
  app.get('/connection', { preHandler: [requireAuth] }, async (request, reply) => {
    const conn = await (prisma as any).gitHubConnection.findUnique({
      where:  { userId: request.user!.id },
      select: { login: true, avatarUrl: true, githubId: true, createdAt: true },
    })
    return reply.send({ success: true, data: { connection: conn ?? null } })
  })

  // DELETE /connection — disconnect GitHub account
  app.delete('/connection', { preHandler: [requireAuth] }, async (request, reply) => {
    await (prisma as any).gitHubConnection.deleteMany({ where: { userId: request.user!.id } })
    return reply.send({ success: true })
  })
}
