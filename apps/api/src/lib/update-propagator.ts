/**
 * Update Propagator
 *
 * Runs once on every API server startup.
 * Ensures ALL users — new and existing — have the current platform defaults.
 *
 * This is how manual code deployments reach existing users:
 *   - New feature flags → enabled for everyone (no rollout gating)
 *   - Minimum credit floor → users below the floor get topped up
 *   - ArivarangamAIState singleton → guaranteed to exist
 *   - DomainConfidence rows → created for any missing categories
 *
 * Each propagation step is idempotent: safe to run on every restart.
 * All steps are non-blocking and logged — a failure in one step never
 * prevents the others from running.
 *
 * To add a new propagation step: add a function and call it in `runAll()`.
 */
import { prisma } from '@arivarangam/db'
import { createNotification } from './notifications'

const MIN_SIGNUP_CREDITS = 50  // keep in sync with grantSignupBonus in credits.ts

// ─── Entry point (called from server startup) ─────────────────────────────────

export async function runUpdatePropagator(): Promise<void> {
  console.log('[UpdatePropagator] Running startup propagation...')

  await Promise.allSettled([
    ensureArivarangamState(),
    ensureAllFlagsGloballyEnabled(),
    ensureDomainConfidenceRows(),
    ensureMinimumCreditsFloor(),
  ])

  console.log('[UpdatePropagator] Done.')
}

// ─── Steps ────────────────────────────────────────────────────────────────────

/**
 * Guarantee the global Arivarangam AI state singleton exists.
 * Safe to run repeatedly — upsert is idempotent.
 */
async function ensureArivarangamState(): Promise<void> {
  try {
    await prisma.arivarangamAIState.upsert({
      where:  { id: 'singleton' },
      update: {},  // don't overwrite existing values
      create: { id: 'singleton' },
    })
  } catch (err: any) {
    console.error('[UpdatePropagator] ensureArivarangamState failed:', err.message)
  }
}

/**
 * Ensure all enabled feature flags have 100% rollout.
 * If a flag is enabled=true but has rolloutPercent < 100, lift it to 100.
 * This means once we flip a flag ON, it applies to EVERY user — no partial rollout.
 *
 * Rationale: partial rollout is useful during canary testing; once a feature is
 * confirmed stable and the flag is enabled, every user should benefit.
 */
async function ensureAllFlagsGloballyEnabled(): Promise<void> {
  try {
    const flags = await prisma.featureFlag.findMany({
      where: { enabled: true },
    })

    for (const flag of flags) {
      const config = (flag.config as any) ?? {}
      // If rolloutPercent is set and less than 100, lift it to 100
      if (typeof config.rolloutPercent === 'number' && config.rolloutPercent < 100) {
        await prisma.featureFlag.update({
          where: { key: flag.key },
          data:  { config: { ...config, rolloutPercent: 100 } },
        })
        console.log(`[UpdatePropagator] Flag "${flag.key}" lifted to 100% rollout`)
      }
    }
  } catch (err: any) {
    console.error('[UpdatePropagator] ensureAllFlagsGloballyEnabled failed:', err.message)
  }
}

/**
 * Create DomainConfidence rows for any TaskCategory that doesn't have one yet.
 * This ensures the admin dashboard shows all domains even before learning begins.
 */
async function ensureDomainConfidenceRows(): Promise<void> {
  try {
    const CATEGORIES = ['code', 'research', 'content', 'strategy', 'data_analysis', 'image', 'voice', 'translation', 'general']
    const existing   = await prisma.domainConfidence.findMany({ select: { category: true } })
    const existingSet = new Set(existing.map((r) => r.category))

    for (const category of CATEGORIES) {
      if (!existingSet.has(category as any)) {
        await prisma.domainConfidence.create({
          data: {
            id:       `dc_${category}`,
            category: category as any,
          },
        }).catch(() => {})  // ignore unique conflict if concurrent startup
      }
    }
  } catch (err: any) {
    console.error('[UpdatePropagator] ensureDomainConfidenceRows failed:', err.message)
  }
}

/**
 * Ensure every active user has at least MIN_SIGNUP_CREDITS total credits
 * accumulated from bonuses. Users who signed up before the bonus was
 * introduced, or whose bonus was never applied, are topped up.
 *
 * This uses the credit ledger: only top up if the sum of SIGNUP_BONUS
 * transactions for a user is zero (bonus was never granted).
 */
async function ensureMinimumCreditsFloor(): Promise<void> {
  try {
    // Find users who never received a signup bonus
    const usersWithBonus = await prisma.creditTransaction.findMany({
      where:  { type: 'SIGNUP_BONUS' },
      select: { userId: true },
    })
    const usersWithBonusSet = new Set(usersWithBonus.map((t) => t.userId))

    const allActiveUsers = await prisma.user.findMany({
      where:  { status: 'ACTIVE' },
      select: { id: true },
    })

    const missing = allActiveUsers.filter((u) => !usersWithBonusSet.has(u.id))
    if (missing.length === 0) return

    console.log(`[UpdatePropagator] Granting signup bonus to ${missing.length} users who missed it`)

    const BATCH = 50
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH)
      await Promise.allSettled(
        batch.map((u) =>
          prisma.$transaction([
            prisma.creditWallet.upsert({
              where:  { userId: u.id },
              update: { balance: { increment: MIN_SIGNUP_CREDITS } },
              create: { userId: u.id, balance: MIN_SIGNUP_CREDITS },
            }),
            prisma.creditTransaction.create({
              data: {
                userId:      u.id,
                amount:      MIN_SIGNUP_CREDITS,
                type:        'SIGNUP_BONUS',
                description: 'Welcome bonus — platform update',
              },
            }),
          ])
        )
      )
    }
  } catch (err: any) {
    console.error('[UpdatePropagator] ensureMinimumCreditsFloor failed:', err.message)
  }
}

// ─── Fine-tune broadcast (called from fine-tune-manager on model deploy) ──────

/**
 * Notify ALL active users when Arivarangam AI gets a new fine-tuned model.
 * Non-blocking — failures are silent.
 */
export async function broadcastModelUpgrade(version: number, modelId: string): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where:  { status: 'ACTIVE' },
      select: { id: true },
    })

    const BATCH = 100
    for (let i = 0; i < users.length; i += BATCH) {
      const batch = users.slice(i, i + BATCH)
      await Promise.allSettled(
        batch.map((u) =>
          createNotification({
            userId: u.id,
            type:   'system_alert',
            title:  `Arivarangam AI just got smarter`,
            body:   `Your AI has been upgraded to v${version} — trained on thousands of real tasks. Every task you run now benefits from this knowledge.`,
            link:   '/dashboard',
            metadata: { modelVersion: version, modelId },
          })
        )
      )
    }

    console.log(`[UpdatePropagator] Model upgrade v${version} broadcast to ${users.length} users`)
  } catch (err: any) {
    console.error('[UpdatePropagator] broadcastModelUpgrade failed:', err.message)
  }
}
