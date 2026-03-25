import { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@arivarangam/db'
import { hashPassword, verifyPassword, validatePasswordStrength } from '../lib/password'
import {
  generateRefreshToken,
  saveRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  blacklistAccessToken,
  hashToken,
} from '../lib/tokens'
import { requireAuth } from '../middleware/auth'
import { metrics } from '../lib/metrics'
import { checkLoginRateLimit, recordLoginFailure, clearLoginFailures } from '../middleware/auth-rate-limit'
import { isEnabled, FLAGS } from '../lib/feature-flags'
import { sendWelcomeEmail, sendVerificationEmail, sendAdminNewUserNotification } from '../lib/email'
import { grantSignupBonus } from './credits'
import { createPassportOnSignup } from '../jobs/skill-detector'
import { ensureUserInfrastructure } from '../lib/user-infrastructure'

function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
  const isProduction = process.env.NODE_ENV === 'production'
  reply.setCookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60, // 15 minutes
  })
  reply.setCookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth/refresh',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  })
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  betaCode: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const refreshSchema = z.object({
  refreshToken: z.string(),
})

export async function authRoutes(app: FastifyInstance) {
  // ─── POST /signup ────────────────────────────────────────────────────────────
  app.post('/signup', async (request, reply) => {
    const body = signupSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const { email, password, name } = body.data

    // Beta gate disabled — open signup. When re-enabled, look up betaCode in BetaInvite table here.

    // Password strength check
    const strength = validatePasswordStrength(password)
    if (!strength.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: strength.message },
      })
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' },
      })
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        isBeta: false,
        betaCode: null,
        usageStats: { create: {} },
      },
      select: { id: true, email: true, name: true, tier: true, createdAt: true },
    })

    // Auto-create personal workspace for every new user
    const workspaceSlug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}-${user.id.slice(-6)}`
    const personalWorkspace = await prisma.workspace.create({
      data: {
        name: `${name}'s Workspace`,
        slug: workspaceSlug,
        type: 'PERSONAL',
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
            acceptedAt: new Date(),
          },
        },
      },
    })

    // Set as current workspace
    await prisma.user.update({
      where: { id: user.id },
      data: { currentWorkspaceId: personalWorkspace.id },
    })

    // Auto-accept current terms at signup so user is never blocked by 403
    ;(async () => {
      try {
        const latestTerms = await prisma.termsVersion.findFirst({ orderBy: { effectiveAt: 'desc' } })
        if (latestTerms) {
          await prisma.userTermsAcceptance.create({
            data: {
              userId: user.id,
              termsVersionId: latestTerms.id,
              ipAddress: String(request.headers['x-forwarded-for'] ?? request.ip ?? 'unknown').slice(0, 45),
              userAgent: String(request.headers['user-agent'] ?? 'unknown').slice(0, 500),
            },
          })
        }
      } catch {
        // Non-fatal — signup succeeds even if terms acceptance fails
      }
    })()

    // Ensure all platform infrastructure exists for this new user (non-blocking).
    // This is the safety net that guarantees wallet, workspace, passport, and terms
    // acceptance are all created — even if any inline creation above silently fails.
    ensureUserInfrastructure(user.id).catch(() => {})

    // Grant signup bonus credits (non-blocking, fire-and-forget)
    grantSignupBonus(user.id).catch(() => {})

    // Create Arivarangam Passport for new user (non-blocking)
    createPassportOnSignup(user.id, user.email, user.name ?? undefined).catch(() => {})

    // Create email verification token and send verification email (non-blocking)
    // NOTE: verification is a transactional email — intentionally NOT gated behind EMAIL_NOTIFICATIONS flag
    // If RESEND_API_KEY is not configured (e.g. dev or missing env var), auto-verify the user immediately
    // so they are never stuck on a 403 with no way to verify.
    ;(async () => {
      try {
        const crypto = await import('crypto')
        const rawToken = crypto.randomBytes(32).toString('hex')
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        await prisma.emailVerification.create({ data: { userId: user.id, tokenHash, expiresAt } })

        if (!process.env.RESEND_API_KEY) {
          // Email service not configured — auto-verify so user can use the platform immediately
          console.warn('[auth] RESEND_API_KEY not set — auto-verifying user', user.id)
          await prisma.user.update({
            where: { id: user.id },
            data:  { isEmailVerified: true, emailVerified: true, emailVerifiedAt: new Date() },
          }).catch(() => {})
        } else {
          const webUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://arivarangam.com'
          const verifyUrl = `${webUrl}/verify-email?token=${rawToken}`
          await sendVerificationEmail(email, name, verifyUrl)
        }
      } catch {
        // Non-fatal — signup succeeds even if verification email fails
      }
    })()

    // Send welcome email (non-blocking)
    if (await isEnabled(FLAGS.EMAIL_NOTIFICATIONS)) {
      sendWelcomeEmail({ to: email, name }).catch(() => {})
    }

    // Notify admin of new signup (non-blocking, fire-and-forget)
    ;(async () => {
      try {
        const { prisma: db } = await import('@arivarangam/db')
        const totalUsers = await db.user.count({ where: { status: 'ACTIVE' } })
        await sendAdminNewUserNotification({
          userName:    name,
          userEmail:   email,
          userId:      user.id,
          totalUsers,
          signupTime:  new Date(),
        })
      } catch {
        // Non-fatal — signup succeeds even if admin notification fails
      }
    })()

    // Issue tokens
    const accessToken = app.jwt.sign({ sub: user.id, email: user.email, tier: user.tier })
    const refreshToken = generateRefreshToken()

    await saveRefreshToken({
      userId: user.id,
      token: refreshToken,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })

    setAuthCookies(reply, accessToken, refreshToken)
    return reply.status(201).send({
      success: true,
      data: {
        user,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 15 * 60, // 15 minutes in seconds
        },
      },
    })
  })

  // ─── POST /login ─────────────────────────────────────────────────────────────
  app.post('/login', {
    preHandler: [checkLoginRateLimit],
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, // tighter than global
  }, async (request, reply) => {
    const body = loginSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const { email, password } = body.data

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true, tier: true, status: true, passwordHash: true },
    })

    // Constant-time response to prevent user enumeration
    if (!user || !user.passwordHash) {
      await verifyPassword('dummy', '$2a$12$dummy.hash.to.prevent.timing.attacks')
      await recordLoginFailure(email)
      metrics.authFailures.inc({ reason: 'user_not_found' })
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      await recordLoginFailure(email)
      metrics.authFailures.inc({ reason: 'wrong_password' })
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      })
    }

    if (user.status !== 'ACTIVE') {
      return reply.status(403).send({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended' },
      })
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    })

    const accessToken = app.jwt.sign({ sub: user.id, email: user.email, tier: user.tier })
    const refreshToken = generateRefreshToken()

    await saveRefreshToken({
      userId: user.id,
      token: refreshToken,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })

    // Clear failure counter on successful login
    await clearLoginFailures(email)
    metrics.authSuccesses.inc({ method: 'password' })
    const { passwordHash: _, ...safeUser } = user

    setAuthCookies(reply, accessToken, refreshToken)
    return reply.send({
      success: true,
      data: {
        user: safeUser,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 15 * 60,
        },
      },
    })
  })

  // ─── POST /refresh ────────────────────────────────────────────────────────────
  app.post('/refresh', async (request, reply) => {
    const body = refreshSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'refreshToken is required' },
      })
    }

    // Decode without verification to get userId
    let userId: string
    try {
      const tokenHash = hashToken(body.data.refreshToken)
      const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } })
      if (!stored) throw new Error('Not found')
      userId = stored.userId
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' },
      })
    }

    const newRefreshToken = await rotateRefreshToken({
      oldToken: body.data.refreshToken,
      userId,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })

    if (!newRefreshToken) {
      return reply.status(401).send({
        success: false,
        error: { code: 'TOKEN_REUSE', message: 'Token reuse detected. Please log in again.' },
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, tier: true },
    })

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      })
    }

    const accessToken = app.jwt.sign({ sub: user.id, email: user.email, tier: user.tier })

    setAuthCookies(reply, accessToken, newRefreshToken)
    return reply.send({
      success: true,
      data: {
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: 15 * 60,
        },
      },
    })
  })

  // ─── POST /logout ─────────────────────────────────────────────────────────────
  app.post('/logout', { preHandler: [requireAuth] }, async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '') ?? ''

    // Blacklist current access token
    const decoded = app.jwt.decode<{ exp: number }>(token)
    if (decoded?.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000)
      if (ttl > 0) await blacklistAccessToken(token, ttl)
    }

    // Revoke all refresh tokens
    await revokeAllUserTokens(request.user!.id)

    reply.clearCookie('accessToken', { path: '/' })
    reply.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' })
    return reply.send({ success: true, data: { message: 'Logged out successfully' } })
  })

  // ─── POST /onboarding ────────────────────────────────────────────────────────
  app.post('/onboarding', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = z.object({
      useCases: z.array(z.string()).optional(),
    }).safeParse(request.body)

    const prefs = body.success ? { onboardingUseCases: body.data.useCases } : {}

    await prisma.user.update({
      where: { id: request.user!.id },
      data: {
        onboardingStep: -1, // -1 = completed
        preferences: prefs,
      },
    })

    return reply.send({ success: true, data: { onboardingCompleted: true } })
  })

  // ─── GET /me ─────────────────────────────────────────────────────────────────
  app.get('/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        status: true,
        isEmailVerified: true,
        emailVerifiedAt: true,
        isAdmin: true,
        avatarUrl: true,
        createdAt: true,
        subscription: {
          select: {
            planId: true,
            status: true,
            currentPeriodEnd: true,
            tasksUsed: true,
            roundtableTasksUsed: true,
          },
        },
        usageStats: {
          select: {
            totalTasksCompleted: true,
            totalCostUsd: true,
          },
        },
      },
    })

    return reply.send({ success: true, data: { user } })
  })
}
