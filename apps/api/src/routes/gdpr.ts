/**
 * GDPR compliance routes — data export and account deletion.
 *
 * Routes:
 *   POST /api/v1/account/export-data    — request a data export
 *   GET  /api/v1/account/export-data    — check export status / get download URL
 *   POST /api/v1/account/delete-account — soft-delete account with password confirmation
 */

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { verifyPassword } from '../lib/password'
import { revokeAllUserTokens } from '../lib/tokens'
import { sendAccountDeletionEmail } from '../lib/email'

// ─── Background export job ────────────────────────────────────────────────────

async function runDataExport(requestId: string, userId: string): Promise<void> {
  try {
    await prisma.dataRequest.update({
      where: { id: requestId },
      data: { status: 'PROCESSING' },
    })

    // Collect all user data
    const [
      user,
      tasks,
      memories,
      creditTransactions,
      billingEvents,
      referralCode,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          tier: true,
          status: true,
          isEmailVerified: true,
          emailVerifiedAt: true,
          isBeta: true,
          createdAt: true,
          lastActiveAt: true,
          onboardingStep: true,
          preferences: true,
        },
      }),
      prisma.task.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          title: true,
          originalGoal: true,
          status: true,
          visibility: true,
          totalCostUsd: true,
          createdAt: true,
          completedAt: true,
          subtasks: {
            select: {
              id: true,
              role: true,
              assignedModel: true,
              status: true,
              output: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.userMemory.findMany({
        where: { userId },
        select: { key: true, value: true, updatedAt: true },
      }),
      prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { type: true, amount: true, balanceAfter: true, description: true, createdAt: true },
      }),
      prisma.billingEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { eventType: true, costUsd: true, createdAt: true, metadata: true },
      }),
      prisma.referralCode.findUnique({
        where: { userId },
        select: { code: true, usageCount: true, createdAt: true },
      }),
    ])

    // Build export payload
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      user,
      tasks: tasks.map((t) => ({
        ...t,
        subtasks: t.subtasks.map((st) => ({
          ...st,
          // Only include text outputs, not binary
          output: typeof st.output === 'string' ? st.output : null,
        })),
      })),
      memories,
      creditTransactions,
      billingEvents,
      referralCode,
    }

    const exportJson = JSON.stringify(exportData, null, 2)

    // Determine storage approach — if R2 configured, upload there; otherwise embed inline
    let downloadUrl: string | null = null

    const r2AccountId  = process.env.R2_ACCOUNT_ID
    const r2AccessKey  = process.env.R2_ACCESS_KEY_ID
    const r2SecretKey  = process.env.R2_SECRET_ACCESS_KEY
    const r2BucketName = process.env.R2_BUCKET_NAME

    if (r2AccountId && r2AccessKey && r2SecretKey && r2BucketName) {
      try {
        const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3')
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')

        const s3 = new S3Client({
          region: 'auto',
          endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId: r2AccessKey, secretAccessKey: r2SecretKey },
        })

        const key = `data-exports/${userId}/${requestId}.json`

        await s3.send(new PutObjectCommand({
          Bucket: r2BucketName,
          Key: key,
          Body: exportJson,
          ContentType: 'application/json',
        }))

        downloadUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: r2BucketName, Key: key }),
          { expiresIn: 7 * 24 * 60 * 60 } // 7 days
        )
      } catch (uploadErr) {
        console.error('[gdpr] R2 upload failed, using data URI fallback:', uploadErr)
      }
    }

    // Fallback: encode as base64 data URI (small-scale / dev)
    if (!downloadUrl) {
      const base64 = Buffer.from(exportJson).toString('base64')
      downloadUrl = `data:application/json;base64,${base64}`
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await prisma.dataRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        downloadUrl,
        expiresAt,
        completedAt: new Date(),
      },
    })
  } catch (err) {
    console.error('[gdpr] Data export failed:', err)
    await prisma.dataRequest.update({
      where: { id: requestId },
      data: {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      },
    }).catch(() => {})
  }
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function gdprRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // ─── POST /export-data ────────────────────────────────────────────────────
  app.post('/export-data', async (request, reply) => {
    const userId = request.user!.id

    // Check for a recent pending/processing request (rate-limit: 1 per day)
    const recentExport = await prisma.dataRequest.findFirst({
      where: {
        userId,
        type: 'EXPORT',
        requestedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })

    if (recentExport) {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'EXPORT_RATE_LIMITED',
          message: 'You can only request a data export once every 24 hours.',
        },
      })
    }

    const dataRequest = await prisma.dataRequest.create({
      data: { userId, type: 'EXPORT', status: 'PENDING' },
    })

    // Fire background export (non-blocking)
    runDataExport(dataRequest.id, userId).catch((err) =>
      app.log.error({ err, requestId: dataRequest.id }, '[gdpr] Background export failed')
    )

    return reply.status(202).send({
      success: true,
      data: {
        requestId: dataRequest.id,
        status: 'PENDING',
        message: 'Your data export has been queued. Check back in a few minutes.',
      },
    })
  })

  // ─── GET /export-data ─────────────────────────────────────────────────────
  app.get('/export-data', async (request, reply) => {
    const userId = request.user!.id

    const latestExport = await prisma.dataRequest.findFirst({
      where: { userId, type: 'EXPORT' },
      orderBy: { requestedAt: 'desc' },
      select: {
        id: true,
        status: true,
        downloadUrl: true,
        expiresAt: true,
        requestedAt: true,
        completedAt: true,
        errorMessage: true,
      },
    })

    if (!latestExport) {
      return reply.send({
        success: true,
        data: { status: null, message: 'No export has been requested yet.' },
      })
    }

    // Don't expose download URL if link has expired
    const linkExpired = latestExport.expiresAt && latestExport.expiresAt < new Date()
    const safeUrl = linkExpired ? null : latestExport.downloadUrl

    return reply.send({
      success: true,
      data: {
        requestId: latestExport.id,
        status: latestExport.status,
        downloadUrl: safeUrl,
        expiresAt: latestExport.expiresAt,
        requestedAt: latestExport.requestedAt,
        completedAt: latestExport.completedAt,
        linkExpired: Boolean(linkExpired),
      },
    })
  })

  // ─── POST /delete-account ─────────────────────────────────────────────────
  app.post('/delete-account', async (request, reply) => {
    const body = z.object({
      password: z.string().min(1),
      confirmation: z.literal('DELETE MY ACCOUNT'),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: body.error.issues[0].message.includes('Invalid literal')
            ? 'Please type "DELETE MY ACCOUNT" exactly to confirm deletion.'
            : body.error.issues[0].message,
        },
      })
    }

    const userId = request.user!.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, passwordHash: true, status: true },
    })

    if (!user || user.status === 'DELETED') {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Account not found.' },
      })
    }

    if (!user.passwordHash) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'NO_PASSWORD',
          message: 'This account uses social login. Please contact support to delete your account.',
        },
      })
    }

    const passwordValid = await verifyPassword(body.data.password, user.passwordHash)
    if (!passwordValid) {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Incorrect password. Please try again.' },
      })
    }

    // Log deletion request
    await prisma.dataRequest.create({
      data: { userId, type: 'DELETION', status: 'COMPLETED', completedAt: new Date() },
    })

    // Soft-delete: anonymize email and name, set status to DELETED
    const anonymizedEmail = `deleted_${userId}@arivarangam.com`
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'DELETED',
        email: anonymizedEmail,
        name: 'Deleted User',
        passwordHash: null,
        avatarUrl: null,
      },
    })

    // Revoke all sessions
    await revokeAllUserTokens(userId)

    // Send goodbye email to original address (non-blocking)
    sendAccountDeletionEmail(user.email, user.name).catch(() => {})

    return reply.send({
      success: true,
      data: { message: 'Your account has been scheduled for deletion. Goodbye.' },
    })
  })

  // ─── POST /account/consent/training ──────────────────────────────────────
  // DPDP Act 2023 — explicit opt-in for Arivarangam-AI training data collection.
  // User must actively consent; default is false; they can withdraw at any time.
  //
  // Body: { consent: boolean }
  //   true  = opt in  (data from future tasks may be used to train Arivarangam-AI)
  //   false = opt out (stop collecting; existing records are NOT deleted retroactively
  //                    unless user submits a data deletion request separately)
  app.post('/account/consent/training', async (request, reply) => {
    const body = z.object({ consent: z.boolean() }).safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'consent must be a boolean' },
      })
    }

    const userId = request.user!.id
    const { consent } = body.data

    await prisma.user.update({
      where: { id: userId },
      data: {
        trainingConsent:   consent,
        trainingConsentAt: consent ? new Date() : null,
      },
    })

    return reply.send({
      success: true,
      data: {
        trainingConsent: consent,
        message: consent
          ? 'You have opted in to Arivarangam-AI training data collection (DPDP Act 2023). You can withdraw at any time.'
          : 'You have opted out. Your data will no longer be used for training Arivarangam-AI.',
      },
    })
  })

  // ─── GET /account/consent ─────────────────────────────────────────────────
  // Returns the user's current consent state.
  app.get('/account/consent', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where:  { id: request.user!.id },
      select: { trainingConsent: true, trainingConsentAt: true },
    })

    return reply.send({
      success: true,
      data: {
        trainingConsent:   user?.trainingConsent ?? false,
        trainingConsentAt: user?.trainingConsentAt ?? null,
      },
    })
  })
}
