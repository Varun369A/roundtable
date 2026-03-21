import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_URL: z.string().url(),
  WEB_URL: z.string().url(),
  CORS_ORIGINS: z.string(),

  // AI APIs
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),

  // Admin
  ADMIN_SECRET: z.string().optional(),

  // Key vault — 32-byte hex master key for per-user API key encryption
  // Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  VAULT_MASTER_KEY: z.string().min(64).optional(),
})

function validateEnv() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const message = Object.entries(errors)
      .map(([key, val]) => `  ${key}: ${val?.join(', ')}`)
      .join('\n')
    throw new Error(`Environment validation failed:\n${message}`)
  }
  return result.data
}

export const env = validateEnv()
export type Env = z.infer<typeof envSchema>
