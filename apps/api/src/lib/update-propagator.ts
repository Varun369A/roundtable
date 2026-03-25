/**
 * Update Propagator
 *
 * Runs once on every API server startup.
 * Ensures the entire platform is in a consistent state after every deployment.
 *
 * THREE LAYERS of update delivery (same model as Stripe, Linear, Vercel):
 *
 *  Layer 1 — Platform globals (this file):
 *    Feature flags at 100% rollout, AI state singleton, domain confidence rows.
 *    These are system-wide settings, not per-user.
 *
 *  Layer 2 — Per-user infrastructure (lib/user-infrastructure.ts):
 *    Every user's wallet, workspace, passport, terms acceptance, etc.
 *    Applied in bulk on startup, AND on every login (Redis-cached, ~0.1ms).
 *    To add a new per-user update: add one entry to PLATFORM_UPDATES in
 *    user-infrastructure.ts and bump INFRA_VERSION — done.
 *
 *  Layer 3 — Real-time broadcast (broadcastModelUpgrade below):
 *    Triggered by fine-tune-manager when Arivarangam AI deploys a new model.
 *    Sends an in-app notification to every active user.
 *
 * All steps are idempotent: safe to run on every restart.
 * A failure in one step never prevents others from running.
 */
import { prisma } from '@arivarangam/db'
import { createNotification } from './notifications'
import { applyAllUsersInfrastructure } from './user-infrastructure'

// ─── Entry point (called from server startup) ─────────────────────────────────

export async function runUpdatePropagator(): Promise<void> {
  console.log('[UpdatePropagator] Running startup propagation...')

  await Promise.allSettled([
    // Layer 1: platform globals
    ensureArivarangamState(),
    ensureAllFlagsGloballyEnabled(),
    ensureDomainConfidenceRows(),
    // Layer 2: per-user infrastructure (wallet, workspace, passport, terms, etc.)
    applyAllUsersInfrastructure(),
  ])

  console.log('[UpdatePropagator] Done.')
}

// ─── Platform global steps ────────────────────────────────────────────────────

/**
 * Guarantee the global Arivarangam AI state singleton exists.
 */
async function ensureArivarangamState(): Promise<void> {
  try {
    await prisma.arivarangamAIState.upsert({
      where:  { id: 'singleton' },
      update: {},  // never overwrite training state
      create: { id: 'singleton' },
    })
  } catch (err: any) {
    console.error('[UpdatePropagator] ensureArivarangamState failed:', err.message)
  }
}

/**
 * Ensure all enabled feature flags have 100% rollout.
 *
 * Rationale: once a flag is flipped ON, every user should benefit immediately.
 * Partial rollout is useful during canary testing; once the flag is enabled,
 * the rolloutPercent gate is redundant and should be lifted.
 */
async function ensureAllFlagsGloballyEnabled(): Promise<void> {
  try {
    const flags = await prisma.featureFlag.findMany({ where: { enabled: true } })

    for (const flag of flags) {
      const config = (flag.config as any) ?? {}
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
 * Create DomainConfidence rows for every TaskCategory.
 * Ensures the admin dashboard shows all domains even before learning begins.
 */
async function ensureDomainConfidenceRows(): Promise<void> {
  try {
    const CATEGORIES = ['code', 'research', 'content', 'strategy', 'data_analysis', 'image', 'voice', 'translation', 'general']
    const existing    = await prisma.domainConfidence.findMany({ select: { category: true } })
    const existingSet = new Set(existing.map((r) => r.category))

    for (const category of CATEGORIES) {
      if (!existingSet.has(category as any)) {
        await prisma.domainConfidence.create({
          data: { id: `dc_${category}`, category: category as any },
        }).catch(() => {})  // ignore unique conflict on concurrent startup
      }
    }
  } catch (err: any) {
    console.error('[UpdatePropagator] ensureDomainConfidenceRows failed:', err.message)
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
            userId:   u.id,
            type:     'system_alert',
            title:    'Arivarangam AI just got smarter',
            body:     `Your AI has been upgraded to v${version} — trained on thousands of real tasks. Every task you run now benefits from this knowledge.`,
            link:     '/dashboard',
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
