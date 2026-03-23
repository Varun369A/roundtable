// OpenTelemetry MUST be first — SDK instruments http/prisma at import time.
// Must load before any instrumented module (fastify, prisma, etc.).
import './lib/tracing'

// Log scrubber MUST be second — before Sentry, before any other import that may log.
// Any log line that fires before this runs can still leak API keys.
import { installGlobalLogScrubber } from './lib/log-scrubber'
installGlobalLogScrubber()

import { initSentry, Sentry } from './lib/sentry'
initSentry()

import Fastify, { type FastifyError } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import { env } from '@sabha/config'
import { authRoutes } from './routes/auth'
import { authRecoveryRoutes } from './routes/auth-recovery'
import { taskRoutes } from './routes/tasks'
import { healthRoutes } from './routes/health'
import { orchestrationRoutes } from './routes/orchestration'
import { streamRoutes } from './routes/stream'
import { marketplaceRoutes, taskReviewRoutes } from './routes/marketplace'
import { billingRoutes } from './routes/billing'
import { webhookRoutes } from './routes/webhooks'
import { languageRoutes } from './routes/language'
import { adminRoutes } from './routes/admin'
import { metricsRoutes } from './routes/metrics'
import { workspaceRoutes } from './routes/workspaces'
import { templateRoutes } from './routes/templates'
import { betaRoutes } from './routes/beta'
import { feedbackRoutes } from './routes/feedback'
import { notificationRoutes } from './routes/notifications'
import { codeProjectRoutes } from './routes/code-projects'
import { githubOAuthRoutes } from './routes/github-oauth'
import { envVarsRoutes } from './routes/env-vars'
import { aiConnectionsRoutes } from './routes/ai-connections'
import { routingPreferencesRoutes } from './routes/routing-preferences'
import { clarificationsRoutes } from './routes/clarifications'
import { memoryRoutes } from './routes/memory'
import { steeringRoutes } from './routes/steering'
import { scheduledTasksRoutes } from './routes/scheduled-tasks'
import { sessionsRoutes } from './routes/sessions'
import { workflowsRoutes } from './routes/workflows'
import { voiceRoutes } from './routes/voice'
import { verificationsRoutes } from './routes/verifications'
import { integrationsRoutes } from './routes/integrations'
import { creditsRoutes } from './routes/credits'
import { verticalPacksRoutes } from './routes/vertical-packs'
import { gdprRoutes } from './routes/gdpr'
import { correctionsRoutes } from './routes/corrections'
import { termsRoutes } from './routes/terms'
import { socialRoutes } from './routes/social'
import { messagingRoutes } from './routes/messaging'
import { repositoryRoutes } from './routes/repositories'
import { moderationRoutes } from './routes/moderation'
import { marketingRoutes } from './routes/marketing'
import { passportRoutes } from './routes/passport'
import { seedBuiltInPacks } from './lib/vertical-pack-manager'
import { startCronWorkers } from './jobs'
import { registerHttpMetrics } from './middleware/http-metrics'
import { redis } from './lib/redis'
import { taskWorker, subtaskWorker } from './jobs'
import { prisma } from '@sabha/db'

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
  ajv: {
    customOptions: { allErrors: true, coerceTypes: false },
  },
  bodyLimit: 1_048_576,
})

// ─── Graceful shutdown ───────────────────────────────────────────────────────

let isShuttingDown = false

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return
  isShuttingDown = true

  app.log.info(`Received ${signal} — shutting down gracefully`)

  await app.close()
  app.log.info('HTTP server closed')

  await Promise.allSettled([
    taskWorker.close(),
    subtaskWorker.close(),
  ])
  app.log.info('BullMQ workers closed')

  await prisma.$disconnect()
  redis.disconnect()
  app.log.info('Database and Redis disconnected')

  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT',  () => gracefulShutdown('SIGINT'))

// ─── Start ────────────────────────────────────────────────────────────────────

const start = async () => {
  try {
    // ── Plugins ────────────────────────────────────────────────────────────────

    await app.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })

    await app.register(cors, {
      origin: env.CORS_ORIGINS.split(',').map(o => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })

    await app.register(cookie, {
      secret: env.JWT_SECRET,
    })

    await app.register(jwt, {
      secret: env.JWT_SECRET,
      sign: { expiresIn: env.JWT_EXPIRES_IN },
      cookie: {
        cookieName: 'accessToken',
        signed: false,
      },
    })

    await app.register(multipart, {
      limits: {
        fileSize: 26_214_400,
        files: 1,
        fields: 10,
      },
    })

    // ── Raw body preservation (required for webhook signature verification) ────
    // Replaces the default JSON parser — attaches req.rawBody (Buffer) before
    // parsing so webhook routes can verify Razorpay signatures against the
    // original bytes rather than re-serialised JSON (which may differ in whitespace).
    app.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (req, body, done) => {
        ;(req as any).rawBody = body
        try {
          done(null, JSON.parse(body.toString('utf8')))
        } catch (err) {
          done(err as Error, undefined)
        }
      }
    )

    await app.register(rateLimit, {
      global: true,
      max: 200,
      timeWindow: '1 minute',
      redis,
      keyGenerator: (request) => {
        return (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || request.ip
      },
      errorResponseBuilder: () => ({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests — please slow down' },
      }),
    })

    await registerHttpMetrics(app)

    // ── CSRF protection ────────────────────────────────────────────────────────

    // CSRF protection: validate Origin header on state-changing requests
    app.addHook('preHandler', async (request, reply) => {
      const method = request.method.toUpperCase()
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return

      // Skip CSRF for requests using Bearer token auth (API clients)
      if (request.headers.authorization?.startsWith('Bearer ')) return

      // Skip CSRF for webhooks (they use signature verification instead)
      if (request.routeOptions?.url?.startsWith('/api/v1/webhooks')) return

      const origin = request.headers.origin ?? request.headers.referer ?? ''
      const allowedOrigins = [
        process.env.WEB_URL ?? 'http://localhost:3000',
        'http://localhost:3000',
        'https://sabhaai.com',
        'https://www.sabhaai.com',
        'https://app.sabhaai.com',
      ]

      if (origin && !allowedOrigins.some(o => origin.startsWith(o))) {
        return reply.status(403).send({
          success: false,
          error: { code: 'CSRF_VIOLATION', message: 'Cross-site request blocked' },
        })
      }
    })

    // ── Routes ─────────────────────────────────────────────────────────────────

    await app.register(healthRoutes,             { prefix: '/health' })
    await app.register(metricsRoutes,            { prefix: '/metrics' })
    await app.register(authRoutes,               { prefix: '/api/v1/auth' })
    await app.register(authRecoveryRoutes,       { prefix: '/api/v1/auth' })
    await app.register(taskRoutes,               { prefix: '/api/v1/tasks' })
    await app.register(orchestrationRoutes,      { prefix: '/api/v1/tasks' })
    await app.register(streamRoutes,             { prefix: '/api/v1/stream' })
    await app.register(marketplaceRoutes,        { prefix: '/api/v1/marketplace' })
    await app.register(taskReviewRoutes,         { prefix: '/api/v1/tasks' })
    await app.register(billingRoutes,            { prefix: '/api/v1/billing' })
    await app.register(webhookRoutes,            { prefix: '/api/v1/webhooks' })
    await app.register(languageRoutes,           { prefix: '/api/v1/language' })
    await app.register(adminRoutes,              { prefix: '/api/v1/admin' })
    await app.register(workspaceRoutes,          { prefix: '/api/v1/workspaces' })
    await app.register(templateRoutes,           { prefix: '/api/v1/templates' })
    await app.register(betaRoutes,               { prefix: '/api/v1/beta' })
    await app.register(feedbackRoutes,           { prefix: '/api/v1/feedback' })
    await app.register(notificationRoutes,       { prefix: '/api/v1/notifications' })
    await app.register(codeProjectRoutes,        { prefix: '/api/v1/code-projects' })
    await app.register(githubOAuthRoutes,        { prefix: '/api/v1/github' })
    await app.register(envVarsRoutes,            { prefix: '/api/v1' })
    await app.register(aiConnectionsRoutes,      { prefix: '/api/v1/ai-connections' })
    await app.register(routingPreferencesRoutes, { prefix: '/api/v1/routing-preferences' })
    await app.register(clarificationsRoutes,     { prefix: '/api/v1' })
    await app.register(memoryRoutes,             { prefix: '/api/v1' })
    await app.register(steeringRoutes,           { prefix: '/api/v1' })
    await app.register(scheduledTasksRoutes,     { prefix: '/api/v1' })
    await app.register(sessionsRoutes,           { prefix: '/api/v1' })
    await app.register(workflowsRoutes,          { prefix: '/api/v1' })
    await app.register(voiceRoutes,              { prefix: '/api/v1' })
    await app.register(verificationsRoutes,      { prefix: '/api/v1' })
    await app.register(integrationsRoutes,       { prefix: '/api/v1' })
    await app.register(creditsRoutes,            { prefix: '/api/v1' })
    await app.register(verticalPacksRoutes,      { prefix: '/api/v1' })
    await app.register(gdprRoutes,               { prefix: '/api/v1/account' })
    await app.register(correctionsRoutes,        { prefix: '/api/v1' })
    await app.register(termsRoutes,              { prefix: '/api/v1' })
    await app.register(socialRoutes,             { prefix: '/api/v1' })
    await app.register(messagingRoutes,          { prefix: '/api/v1' })
    await app.register(repositoryRoutes,         { prefix: '/api/v1' })
    await app.register(moderationRoutes,         { prefix: '/api/v1' })
    await app.register(marketingRoutes,          { prefix: '/api/v1' })
    await app.register(passportRoutes,           { prefix: '/api/v1' })

    // ── Global error handler ───────────────────────────────────────────────────

    app.setErrorHandler((error: FastifyError, request, reply) => {
      app.log.error({ err: error, url: request.url, method: request.method })

      // Capture 5xx errors in Sentry (4xx client errors are expected, not bugs)
      if (!error.statusCode || error.statusCode >= 500) {
        Sentry.captureException(error, {
          extra: { url: request.url, method: request.method },
        })
      }

      if ((error as NodeJS.ErrnoException).code === 'CIRCUIT_OPEN') {
        return reply.status(503).send({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'AI service temporarily unavailable — please retry shortly' },
        })
      }

      if (error.validation) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.validation },
        })
      }

      if (error.statusCode === 429) {
        return reply.status(429).send({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many requests' },
        })
      }

      if (error.statusCode && error.statusCode < 500) {
        return reply.status(error.statusCode).send({
          success: false,
          error: { code: 'API_ERROR', message: error.message },
        })
      }

      const message = env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message },
      })
    })

    // ── Listen ─────────────────────────────────────────────────────────────────

    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    app.log.info(`Sabha API running on port ${env.PORT}`)

    taskWorker.on('failed', (job, err) => app.log.error({ jobId: job?.id, err }, 'Task job failed'))
    subtaskWorker.on('failed', (job, err) => app.log.error({ jobId: job?.id, err }, 'Subtask job failed'))
    app.log.info('BullMQ workers started')

    try {
      await seedBuiltInPacks()
      app.log.info('Vertical packs seeded')
    } catch (seedErr) {
      app.log.error(seedErr, 'Vertical pack seeding failed — API continues without them')
    }

    try {
      await startCronWorkers()
      app.log.info('Cron workers started')
    } catch (cronErr) {
      app.log.error(cronErr, 'Cron workers failed to start — API continues without them')
    }

  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()

export { app }
