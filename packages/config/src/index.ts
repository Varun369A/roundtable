import { z } from 'zod'

const envSchema = z.object({
  // ─── Database ────────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url(),

  // ─── Valkey / Redis ──────────────────────────────────────────────────────────
  REDIS_URL: z.string().url(),

  // ─── JWT ─────────────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // ─── Server ──────────────────────────────────────────────────────────────────
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_URL: z.string().url(),
  WEB_URL: z.string().url(),
  CORS_ORIGINS: z.string(),

  // ─── AI APIs ─────────────────────────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  STABILITY_API_KEY: z.string().optional(),
  RUNWAY_API_KEY: z.string().optional(),
  SARVAM_API_KEY: z.string().optional(),
  MIDJOURNEY_API_KEY: z.string().optional(),
  MIDJOURNEY_API_URL: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),

  // ─── Admin ───────────────────────────────────────────────────────────────────
  ADMIN_SECRET: z.string().min(16),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),

  // ─── Email (Resend) ──────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Arivarangam <no-reply@arivarangam.com>'),

  // ─── Storage ─────────────────────────────────────────────────────────────────
  STORAGE_PROVIDER: z.enum(['local', 'r2']).default('local'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // ─── Razorpay ────────────────────────────────────────────────────────────────
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_PLAN_BUILDER: z.string().optional(),
  RAZORPAY_PLAN_BUILDER_ANNUAL: z.string().optional(),
  RAZORPAY_PLAN_STUDIO: z.string().optional(),
  RAZORPAY_PLAN_STUDIO_ANNUAL: z.string().optional(),
  RAZORPAY_PLAN_ENTERPRISE: z.string().optional(),
  RAZORPAY_PLAN_ENTERPRISE_ANNUAL: z.string().optional(),
  RAZORPAY_PLAN_BUILDER_FOUNDING: z.string().optional(),
  RAZORPAY_PLAN_STUDIO_FOUNDING: z.string().optional(),

  // ─── Currency ────────────────────────────────────────────────────────────────
  // Approximate INR→USD conversion for billing event logging only (not transactions)
  // Update periodically via env — not used for actual money movement
  EXCHANGE_RATE_INR_USD: z.coerce.number().default(84),

  // ─── GitHub OAuth ────────────────────────────────────────────────────────────
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z.string().optional(),

  // ─── Google OAuth ────────────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // ─── Notion ──────────────────────────────────────────────────────────────────
  NOTION_CLIENT_ID: z.string().optional(),
  NOTION_CLIENT_SECRET: z.string().optional(),

  // ─── Slack ───────────────────────────────────────────────────────────────────
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),

  // ─── Encryption keys ─────────────────────────────────────────────────────────
  // Key vault master key — per-user scrypt derivation for BYOAI API keys
  VAULT_MASTER_KEY: z.string().min(64).optional(),
  // Environment variable encryption (project env vars feature)
  ENV_VAR_ENCRYPTION_KEY: z.string().min(64).optional(),
  // BYOAI key encryption (legacy encrypt helper, separate from vault)
  BYOAI_KEY_ENCRYPTION_KEY: z.string().min(64).optional(),
  // GitHub OAuth token encryption (AES-256-GCM, uses VAULT_MASTER_KEY)
  // Social credential encryption (LinkedIn/Twitter/Instagram tokens)
  SOCIAL_CREDENTIALS_KEY: z.string().min(64).optional(),

  // ─── AWS KMS (production) ────────────────────────────────────────────────────
  AWS_REGION: z.string().default('ap-south-1'),
  ENCRYPTED_MASTER_KEY: z.string().optional(), // base64 KMS-encrypted VAULT_MASTER_KEY
  KMS_KEY_ID: z.string().optional(),           // arn:aws:kms:...

  // ─── AI Firewall ─────────────────────────────────────────────────────────────
  FIREWALL_BLOCK_SCORE: z.coerce.number().min(0).max(100).default(80),
  FIREWALL_LOG_ALL: z.string().transform(v => v === 'true').default('false'),

  // ─── Public frontend URLs ─────────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXT_PUBLIC_API_URL: z.string().optional(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  // ─── Monitoring ──────────────────────────────────────────────────────────────
  SENTRY_DSN: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('arivarangam-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  GRAFANA_ADMIN_PASSWORD: z.string().optional(),

  // ─── Social Media OAuth ──────────────────────────────────────────────────────
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_REDIRECT_URI: z.string().optional(),
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
  TWITTER_REDIRECT_URI: z.string().optional(),
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  WHATSAPP_BUSINESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),

  // ─── Push Notifications (VAPID) ──────────────────────────────────────────────
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  ADMIN_PUSH_ENDPOINT: z.string().optional(),

  // ─── Database pool ───────────────────────────────────────────────────────────
  DATABASE_POOL_SIZE: z.coerce.number().default(20),
})

function validateEnv() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const message = Object.entries(errors)
      .map(([key, val]) => `  ${key}: ${val?.join(', ')}`)
      .join('\n')
    throw new Error(`\n\nEnvironment validation failed:\n${message}\n\nCheck your .env file against .env.example\n`)
  }

  // Production-specific required checks (cannot be .optional() since they're needed only in prod)
  const data = result.data
  if (data.NODE_ENV === 'production') {
    const prodRequired = [
      ['VAULT_MASTER_KEY or ENCRYPTED_MASTER_KEY', data.VAULT_MASTER_KEY || data.ENCRYPTED_MASTER_KEY],
      ['RAZORPAY_KEY_ID', data.RAZORPAY_KEY_ID],
      ['RAZORPAY_KEY_SECRET', data.RAZORPAY_KEY_SECRET],
      ['RAZORPAY_WEBHOOK_SECRET', data.RAZORPAY_WEBHOOK_SECRET],
      ['RESEND_API_KEY', data.RESEND_API_KEY],
      ['ADMIN_SECRET', data.ADMIN_SECRET],
      ['SOCIAL_CREDENTIALS_KEY', data.SOCIAL_CREDENTIALS_KEY],
    ] as const

    const missing = prodRequired.filter(([, val]) => !val).map(([key]) => key)
    if (missing.length > 0) {
      throw new Error(
        `\n\nProduction environment is missing required variables:\n${missing.map(k => `  ${k}`).join('\n')}\n`
      )
    }
  }

  return data
}

export const env = validateEnv()
export type Env = z.infer<typeof envSchema>
