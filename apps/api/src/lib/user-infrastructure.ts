/**
 * User Infrastructure Manager
 *
 * Every user needs certain DB rows to exist before they can use the platform.
 * This module is the single source of truth for all required user infrastructure.
 *
 * HOW IT WORKS:
 *  - PLATFORM_UPDATES is a declarative ordered list of required infrastructure.
 *  - Each entry has a `check` (is it already done?) and an `apply` (do it).
 *  - `ensureUserInfrastructure(userId)` runs all checks and applies any missing ones.
 *  - Result is cached in Redis for 24h — near-zero cost on every subsequent request.
 *
 * WHEN IT RUNS:
 *  1. Auth middleware — on every authenticated request (Redis cache makes this free)
 *  2. Signup route   — immediately after user creation (no cache, always fresh)
 *  3. Update propagator — server startup, batches ALL active users
 *
 * TO ADD A NEW PLATFORM UPDATE:
 *  1. Add an entry to PLATFORM_UPDATES with a new unique id (e.g. `v7_new_feature`).
 *  2. Bump INFRA_VERSION by 1 — this busts the Redis cache for every user, so they
 *     all get the new update applied on their next request or the next server restart.
 *  3. Deploy — done. Every user (new and existing) gets it automatically.
 */

import { prisma } from '@arivarangam/db'
import { redis } from './redis'
import { createPassportOnSignup } from '../jobs/skill-detector'

// ─── VERSION — bump when you add a new entry to PLATFORM_UPDATES ─────────────
// Changing this invalidates every user's Redis cache, forcing a re-check.
const INFRA_VERSION = 6

const SIGNUP_BONUS_AMOUNT = 50  // keep in sync with grantSignupBonus in credits.ts

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRecord {
  id:      string
  email:   string
  name:    string | null
  isAdmin: boolean
  status:  string
}

interface PlatformUpdate {
  id:          string
  description: string
  /** Returns true if this update has already been applied for this user. */
  check:       (user: UserRecord) => Promise<boolean>
  /** Idempotently apply the update. Should not throw — errors are caught above. */
  apply:       (user: UserRecord) => Promise<void>
  /** Optional: send an in-app notification after applying. */
  notifyUser?: (user: UserRecord) => Promise<void>
}

// ─── Platform update registry ─────────────────────────────────────────────────

const PLATFORM_UPDATES: PlatformUpdate[] = [

  // ── v1: Usage statistics row ──────────────────────────────────────────────
  {
    id:          'v1_usage_stats',
    description: 'Create usageStats row for task tracking',
    check: async (user) =>
      !!(await prisma.usageStats.findUnique({ where: { userId: user.id } })),
    apply: async (user) => {
      await prisma.usageStats.upsert({
        where:  { userId: user.id },
        update: {},
        create: { userId: user.id },
      })
    },
  },

  // ── v2: Credit wallet + signup bonus ──────────────────────────────────────
  // Admin gets 1M; regular users get SIGNUP_BONUS_AMOUNT (50).
  // We gate on the SIGNUP_BONUS transaction existing so this is idempotent.
  {
    id:          'v2_credit_wallet',
    description: 'Create credit wallet and grant signup bonus',
    check: async (user) =>
      !!(await prisma.creditTransaction.findFirst({
        where: { userId: user.id, type: 'SIGNUP_BONUS' },
      })),
    apply: async (user) => {
      const amount      = user.isAdmin ? 1_000_000 : SIGNUP_BONUS_AMOUNT
      const description = user.isAdmin
        ? 'Admin unlimited credits'
        : 'Welcome bonus — thanks for joining Arivarangam!'

      await prisma.$transaction([
        prisma.creditWallet.upsert({
          where:  { userId: user.id },
          update: { balance: { increment: amount } },
          create: { userId: user.id, balance: amount, lifetimeEarned: amount },
        }),
        prisma.creditTransaction.create({
          data: { userId: user.id, amount, type: 'SIGNUP_BONUS', description },
        }),
      ])
    },
  },

  // ── v3: Personal workspace ────────────────────────────────────────────────
  {
    id:          'v3_personal_workspace',
    description: 'Create personal workspace',
    check: async (user) =>
      !!(await prisma.workspace.findFirst({ where: { ownerId: user.id } })),
    apply: async (user) => {
      const displayName = user.name || user.email.split('@')[0]
      const slug = `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}-${user.id.slice(-6)}`

      const ws = await prisma.workspace.create({
        data: {
          name:    `${displayName}'s Workspace`,
          slug,
          type:    'PERSONAL',
          ownerId: user.id,
          members: {
            create: { userId: user.id, role: 'OWNER', acceptedAt: new Date() },
          },
        },
      })

      await prisma.user.update({
        where: { id: user.id },
        data:  { currentWorkspaceId: ws.id },
      }).catch(() => {})
    },
  },

  // ── v4: currentWorkspaceId pointer ────────────────────────────────────────
  // Guard for users whose workspace exists but currentWorkspaceId was never set.
  {
    id:          'v4_current_workspace',
    description: 'Set currentWorkspaceId if not set',
    check: async (user) => {
      const u = await prisma.user.findUnique({
        where:  { id: user.id },
        select: { currentWorkspaceId: true },
      })
      return !!u?.currentWorkspaceId
    },
    apply: async (user) => {
      const ws = await prisma.workspace.findFirst({ where: { ownerId: user.id } })
      if (ws) {
        await prisma.user.update({
          where: { id: user.id },
          data:  { currentWorkspaceId: ws.id },
        }).catch(() => {})
      }
    },
  },

  // ── v5: Arivarangam Passport ──────────────────────────────────────────────
  {
    id:          'v5_passport',
    description: 'Create Arivarangam Passport',
    check: async (user) =>
      !!(await prisma.arivarangamPassport.findUnique({ where: { userId: user.id } })),
    apply: async (user) => {
      if (user.isAdmin) {
        await prisma.arivarangamPassport.create({
          data: {
            userId:      user.id,
            displayName: 'Arivarangam Admin',
            level:       10,
            xp:          10000,
            tier:        'LEGEND',
          },
        }).catch(() => {})
      } else {
        await createPassportOnSignup(user.id, user.email, user.name ?? undefined).catch(() => {})
      }
    },
  },

  // ── v6: Terms acceptance ──────────────────────────────────────────────────
  // Auto-accept the latest terms so users are never blocked by a 403 on login.
  {
    id:          'v6_terms_acceptance',
    description: 'Accept current terms version',
    check: async (user) => {
      const latest = await prisma.termsVersion.findFirst({ orderBy: { effectiveAt: 'desc' } })
      if (!latest) return true
      return !!(await prisma.userTermsAcceptance.findFirst({
        where: { userId: user.id, termsVersionId: latest.id },
      }))
    },
    apply: async (user) => {
      const latest = await prisma.termsVersion.findFirst({ orderBy: { effectiveAt: 'desc' } })
      if (!latest) return
      await prisma.userTermsAcceptance.upsert({
        where:  { userId_termsVersionId: { userId: user.id, termsVersionId: latest.id } },
        update: {},
        create: {
          userId:        user.id,
          termsVersionId: latest.id,
          ipAddress:     'system',
          userAgent:     'platform-update',
        },
      }).catch(() => {})
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ADD FUTURE PLATFORM UPDATES HERE — remember to bump INFRA_VERSION above.
  // Example:
  //   { id: 'v7_new_credits_tier', description: '...', check: ..., apply: ... },
  // ─────────────────────────────────────────────────────────────────────────
]

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Ensure one user has all required platform infrastructure.
 *
 * Redis-cached for 24 hours — safe to call on every authenticated request.
 * When all checks pass the first time, subsequent calls cost one Redis GET (~0.1ms).
 * Never throws — all errors are caught and logged.
 */
export async function ensureUserInfrastructure(userId: string): Promise<void> {
  const cacheKey = `user_infra:v${INFRA_VERSION}:${userId}`

  // Fast path: already verified within the last 24h
  try {
    const cached = await redis.get(cacheKey)
    if (cached === 'ok') return
  } catch {
    // Redis unavailable — proceed without cache
  }

  try {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, email: true, name: true, isAdmin: true, status: true },
    })
    if (!user) return

    let allPassed = true

    for (const update of PLATFORM_UPDATES) {
      try {
        const done = await update.check(user)
        if (!done) {
          await update.apply(user)
          console.log(`[UserInfra] Applied "${update.id}" for user ${userId}`)
          if (update.notifyUser) await update.notifyUser(user).catch(() => {})
        }
      } catch (err: any) {
        console.error(`[UserInfra] "${update.id}" failed for ${userId}:`, err?.message)
        allPassed = false
      }
    }

    // Cache only if everything passed — if something failed, retry on next request
    if (allPassed) {
      await redis.setex(cacheKey, 86_400, 'ok').catch(() => {})
    }
  } catch (err: any) {
    console.error(`[UserInfra] ensureUserInfrastructure failed for ${userId}:`, err?.message)
  }
}

/**
 * Invalidate a user's infrastructure cache.
 * Call after manually modifying their account, or when you need to force a re-check.
 */
export function invalidateUserInfraCache(userId: string): void {
  redis.del(`user_infra:v${INFRA_VERSION}:${userId}`).catch(() => {})
}

/**
 * Batch: apply all platform updates to every active user.
 * Called by the update propagator on every server restart.
 * Processes users in small batches to avoid DB overload.
 */
export async function applyAllUsersInfrastructure(): Promise<void> {
  const users = await prisma.user.findMany({
    where:  { status: 'ACTIVE' },
    select: { id: true, email: true, name: true, isAdmin: true, status: true },
  })

  console.log(`[UserInfra] Verifying infrastructure for ${users.length} users (v${INFRA_VERSION})...`)

  const BATCH = 20
  for (let i = 0; i < users.length; i += BATCH) {
    const batch = users.slice(i, i + BATCH)
    await Promise.allSettled(batch.map((u) => ensureUserInfrastructure(u.id)))
  }

  console.log('[UserInfra] All users verified.')
}
