/**
 * Auth recovery routes — password reset & email verification.
 *
 * Routes:
 *   POST /forgot-password       — send reset link (always 200, no enumeration)
 *   POST /reset-password        — consume token, set new password
 *   POST /verify-email          — mark email verified
 *   POST /resend-verification   — re-send verification link (authenticated)
 */

import crypto from 'crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sabha/db'
import { hashPassword, validatePasswordStrength } from '../lib/password'
import { revokeAllUserTokens, hashToken } from '../lib/tokens'
import { requireAuth } from '../middleware/auth'
import { isEnabled, FLAGS } from '../lib/feature-flags'
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendPostVerificationWelcomeEmail,
} from '../lib/email'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function hashRecoveryToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function authRecoveryRoutes(app: FastifyInstance) {

  // ─── POST /forgot-password ────────────────────────────────────────────────
  app.post('/forgot-password', async (request, reply) => {
    const body = z.object({
      email: z.string().email(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    // Always return 200 regardless of whether user exists (prevent enumeration)
    const { email } = body.data

    const user = await prisma.user.findFirst({
      where: { email: { equals: email.toLowerCase(), mode: 'insensitive' } },
      select: { id: true, email: true, name: true, status: true },
    })

    if (user && user.status === 'ACTIVE') {
      try {
        const rawToken = generateRawToken()
        const tokenHash = hashRecoveryToken(rawToken)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

        // Invalidate any previous pending reset tokens for this user
        await prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        })

        await prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash, expiresAt },
        })

        const webUrl = process.env.WEB_URL || 'http://localhost:3000'
        const resetUrl = `${webUrl}/auth/reset-password?token=${rawToken}`

        if (await isEnabled(FLAGS.EMAIL_NOTIFICATIONS)) {
          await sendPasswordResetEmail(user.email, user.name, resetUrl)
        }
      } catch (err) {
        // Log but don't expose — return 200 regardless
        app.log.error({ err }, '[auth-recovery] Failed to create password reset token')
      }
    }

    return reply.send({
      success: true,
      data: { message: 'If an account with that email exists, we have sent a password reset link.' },
    })
  })

  // ─── POST /reset-password ─────────────────────────────────────────────────
  app.post('/reset-password', async (request, reply) => {
    const body = z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const { token, newPassword } = body.data

    // Validate password strength
    const strength = validatePasswordStrength(newPassword)
    if (!strength.valid) {
      return reply.status(400).send({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: strength.message },
      })
    }

    const tokenHash = hashRecoveryToken(token)

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, status: true } } },
    })

    if (
      !resetToken ||
      resetToken.usedAt !== null ||
      resetToken.expiresAt < new Date() ||
      resetToken.user.status !== 'ACTIVE'
    ) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'This password reset link is invalid or has expired. Please request a new one.',
        },
      })
    }

    const passwordHash = await hashPassword(newPassword)

    // Update password and mark token used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    // Invalidate ALL refresh tokens for this user (session rotation after password change)
    await revokeAllUserTokens(resetToken.userId)

    return reply.send({
      success: true,
      data: { message: 'Password reset successfully. Please log in with your new password.' },
    })
  })

  // ─── POST /verify-email ───────────────────────────────────────────────────
  app.post('/verify-email', async (request, reply) => {
    const body = z.object({
      token: z.string().min(1),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const tokenHash = hashToken(body.data.token)

    const verification = await prisma.emailVerification.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, name: true, isEmailVerified: true } } },
    })

    if (
      !verification ||
      verification.verifiedAt !== null ||
      verification.expiresAt < new Date()
    ) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'This verification link is invalid or has expired. Please request a new one.',
        },
      })
    }

    // Mark verification used and update user
    await prisma.$transaction([
      prisma.emailVerification.update({
        where: { id: verification.id },
        data: { verifiedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: verification.userId },
        data: { isEmailVerified: true, emailVerifiedAt: new Date() },
      }),
    ])

    // Send welcome email after successful verification (non-blocking)
    if (await isEnabled(FLAGS.EMAIL_NOTIFICATIONS)) {
      sendPostVerificationWelcomeEmail(verification.user.email, verification.user.name).catch(() => {})
    }

    return reply.send({
      success: true,
      data: { message: 'Email verified successfully. Welcome to Sabha!' },
    })
  })

  // ─── POST /resend-verification ────────────────────────────────────────────
  app.post('/resend-verification', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user!.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isEmailVerified: true },
    })

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      })
    }

    if (user.isEmailVerified) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ALREADY_VERIFIED', message: 'Your email is already verified.' },
      })
    }

    // Delete any existing pending verifications
    await prisma.emailVerification.deleteMany({
      where: { userId, verifiedAt: null },
    })

    // Create new verification token
    const rawToken = generateRawToken()
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await prisma.emailVerification.create({
      data: { userId, tokenHash, expiresAt },
    })

    const webUrl = process.env.WEB_URL || 'http://localhost:3000'
    const verifyUrl = `${webUrl}/auth/verify-email?token=${rawToken}`

    if (await isEnabled(FLAGS.EMAIL_NOTIFICATIONS)) {
      await sendVerificationEmail(user.email, user.name, verifyUrl).catch(() => {})
    }

    return reply.send({
      success: true,
      data: { message: 'Verification email sent. Please check your inbox.' },
    })
  })
}
