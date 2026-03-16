import { PrismaClient } from '../generated/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma singleton with connection pool tuning.
 *
 * connection_limit: max concurrent DB connections per process.
 *   - Default Prisma: 10 (fine for dev, too low for prod under load)
 *   - Set to env var DATABASE_POOL_SIZE or default to 20
 *   - For multi-process deployments, coordinate with PgBouncer
 *
 * pool_timeout: how long to wait for a free connection before error.
 * connect_timeout: how long to wait for initial DB connection.
 */
const poolSize = parseInt(process.env.DATABASE_POOL_SIZE || '20', 10)
const databaseUrl = process.env.DATABASE_URL || ''

// Append connection pool params to the URL (Prisma reads these from the URL)
const pooledUrl = databaseUrl.includes('connection_limit')
  ? databaseUrl
  : `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}connection_limit=${poolSize}&pool_timeout=20&connect_timeout=30`

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: pooledUrl } },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '../generated/client'
