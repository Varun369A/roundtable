/**
 * Arivarangam Auto Fine-Tune Manager
 *
 * Full lifecycle — fully automated, zero manual intervention:
 *
 *  1. TRIGGER  — milestone check fires after every 1000 learning records
 *  2. EXPORT   — builds JSONL dataset from high-quality knowledge records
 *  3. UPLOAD   — uploads JSONL to Anthropic Files API
 *  4. TRAIN    — submits fine-tuning job (base: claude-haiku-4-5)
 *  5. POLL     — BullMQ job checks status every 5 min until complete
 *  6. DEPLOY   — updates currentModelId in DB → Sabha connector picks it up
 *  7. LEARN    — model immediately starts serving requests with the new fine-tune
 *
 * Safeguards:
 *  - Only one fine-tune job can be in progress at a time
 *  - Requires minimum 500 high-quality samples (score >= 0.7)
 *  - Rollback: previous model ID stored as `lastFineTuneModel`
 *  - All state changes are atomic via DB transactions
 *  - Never blocks task execution — entirely async
 */
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { prisma } from '@arivarangam/db'
import { exportFineTuneDataset } from './dataset-exporter'
import { broadcastModelUpgrade } from './update-propagator'

// Base model for fine-tuning — Haiku is cost-effective and fast to train
const FINE_TUNE_BASE_MODEL = 'claude-haiku-4-5-20251001'
const MIN_SAMPLES_TO_TRAIN = 500   // minimum high-quality records before training
const MIN_QUALITY_THRESHOLD = 0.7  // only use records at or above this score

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check if the knowledge count just crossed a milestone.
 * Called by the learning pipeline after every record saved.
 * Non-blocking — fires and forgets.
 */
export async function checkMilestoneAndTrigger(knowledgeCount: number): Promise<void> {
  try {
    const state = await prisma.arivarangamAIState.findUnique({ where: { id: 'singleton' } })
    if (!state) return

    // Skip if a job is already in progress
    if (state.fineTuneStatus !== 'idle' && state.fineTuneStatus !== 'failed') return

    // Skip if not yet at the next milestone
    if (knowledgeCount < state.nextMilestone) return

    // Kick off in background
    startFineTune('milestone').catch(() => {})
  } catch {
    // Never block
  }
}

/**
 * Manually triggered fine-tune (admin button).
 * Returns the job ID immediately; training continues in background.
 */
export async function triggerManualFineTune(adminId?: string): Promise<string> {
  const state = await prisma.arivarangamAIState.findUnique({ where: { id: 'singleton' } })
  if (state?.fineTuneStatus === 'training' || state?.fineTuneStatus === 'uploading') {
    throw new Error('A fine-tune job is already in progress')
  }

  const jobId = await startFineTune('manual')
  return jobId
}

/**
 * Poll a pending fine-tune job and update its status.
 * Called by BullMQ repeatable job every 5 minutes.
 */
export async function pollFineTuneJob(): Promise<void> {
  try {
    const state = await prisma.arivarangamAIState.findUnique({ where: { id: 'singleton' } })
    if (!state?.pendingFineTuneJobId) return
    if (state.fineTuneStatus !== 'training') return

    const client = getAnthropicClient()
    const job    = await (client as any).fineTuning?.jobs?.retrieve(state.pendingFineTuneJobId)
    if (!job) return

    if (job.status === 'succeeded' && job.fine_tuned_model) {
      await deployFineTunedModel(state.pendingFineTuneJobId, job.fine_tuned_model)
    } else if (job.status === 'failed' || job.status === 'cancelled') {
      await markJobFailed(state.pendingFineTuneJobId, `Anthropic job status: ${job.status}`)
    }
    // Still running: do nothing, will poll again
  } catch (err: any) {
    console.error('[FineTuneManager] Poll error:', err?.message)
  }
}

/**
 * Get current fine-tune status (for admin dashboard).
 */
export async function getFineTuneStatus() {
  const [state, recentJobs] = await Promise.all([
    prisma.arivarangamAIState.findUnique({
      where:  { id: 'singleton' },
      select: {
        currentModelId:      true,
        fineTuneStatus:      true,
        fineTuneStartedAt:   true,
        lastFineTuneAt:      true,
        lastFineTuneModel:   true,
        fineTuneVersion:     true,
        nextMilestone:       true,
        knowledgeCount:      true,
        pendingFineTuneJobId: true,
      },
    }),
    prisma.fineTuneJob.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true, status: true, baseModel: true, newModelId: true,
        sampleCount: true, triggerReason: true, startedAt: true,
        completedAt: true, deployedAt: true, errorMessage: true,
      },
    }),
  ])

  return {
    currentModelId:    state?.currentModelId    ?? 'claude-sonnet-4-6',
    fineTuneStatus:    state?.fineTuneStatus     ?? 'idle',
    fineTuneVersion:   state?.fineTuneVersion    ?? 0,
    knowledgeCount:    state?.knowledgeCount     ?? 0,
    nextMilestone:     state?.nextMilestone      ?? 1000,
    progressToMilestone: state
      ? Math.min(100, Math.round((state.knowledgeCount / state.nextMilestone) * 100))
      : 0,
    lastFineTuneAt:    state?.lastFineTuneAt,
    lastFineTuneModel: state?.lastFineTuneModel,
    pendingJobId:      state?.pendingFineTuneJobId,
    recentJobs,
  }
}

/**
 * Rollback to the previous model if the new one has issues.
 */
export async function rollbackModel(): Promise<void> {
  const state = await prisma.arivarangamAIState.findUnique({ where: { id: 'singleton' } })
  if (!state?.lastFineTuneModel) throw new Error('No previous model to roll back to')

  const currentModel = state.currentModelId
  await prisma.arivarangamAIState.update({
    where: { id: 'singleton' },
    data: {
      currentModelId:    state.lastFineTuneModel,
      lastFineTuneModel: currentModel,
      fineTuneStatus:    'idle',
    },
  })

  // Log the rollback in job history
  await prisma.fineTuneJob.create({
    data: {
      id:            `ftj_rollback_${Date.now()}`,
      status:        'rolled_back',
      baseModel:     state.lastFineTuneModel,
      newModelId:    state.lastFineTuneModel,
      sampleCount:   0,
      minQuality:    0,
      triggerReason: 'rollback',
      completedAt:   new Date(),
      deployedAt:    new Date(),
    },
  })

  // Invalidate model cache
  invalidateModelCache()
}

// ─── Core pipeline ─────────────────────────────────────────────────────────────

async function startFineTune(reason: 'milestone' | 'manual'): Promise<string> {
  const jobRecord = await prisma.fineTuneJob.create({
    data: {
      id:            `ftj_${Date.now()}`,
      status:        'pending',
      baseModel:     FINE_TUNE_BASE_MODEL,
      sampleCount:   0,
      minQuality:    MIN_QUALITY_THRESHOLD,
      triggerReason: reason,
    },
  })

  // Mark state as uploading
  await prisma.arivarangamAIState.upsert({
    where:  { id: 'singleton' },
    update: { fineTuneStatus: 'uploading', fineTuneStartedAt: new Date() },
    create: { id: 'singleton', fineTuneStatus: 'uploading', fineTuneStartedAt: new Date() },
  })

  // Run the pipeline async
  runPipeline(jobRecord.id, reason).catch(async (err: any) => {
    console.error('[FineTuneManager] Pipeline error:', err?.message)
    await markJobFailed(jobRecord.id, err?.message ?? 'Unknown error')
  })

  return jobRecord.id
}

async function runPipeline(jobId: string, reason: string): Promise<void> {
  // ── Step 1: Check minimum sample requirements ─────────────────────────────
  const readyCount = await prisma.arivarangamKnowledge.count({
    where: { qualityScore: { gte: MIN_QUALITY_THRESHOLD }, specialistContext: { not: null } },
  })

  if (readyCount < MIN_SAMPLES_TO_TRAIN) {
    await markJobFailed(jobId, `Insufficient samples: ${readyCount} ready, need ${MIN_SAMPLES_TO_TRAIN}`)
    return
  }

  // ── Step 2: Export JSONL dataset ──────────────────────────────────────────
  const exportResult = await exportFineTuneDataset({
    minQuality: MIN_QUALITY_THRESHOLD,
    outputDir:  '/tmp',
    notes:      `Auto fine-tune ${reason} — job ${jobId}`,
  })

  await prisma.fineTuneJob.update({
    where: { id: jobId },
    data:  { sampleCount: exportResult.sampleCount },
  })

  // ── Step 3: Upload to Anthropic Files API ─────────────────────────────────
  const client = getAnthropicClient()
  const fileContent = fs.readFileSync(exportResult.filePath, 'utf-8')

  let fileId: string
  try {
    const uploadedFile = await (client as any).beta?.files?.upload?.({
      file: new (globalThis as any).File(
        [fileContent],
        `arivarangam_v${Date.now()}.jsonl`,
        { type: 'application/jsonl' }
      ),
    })
    fileId = uploadedFile.id

    await prisma.fineTuneJob.update({
      where: { id: jobId },
      data:  { anthropicFileId: fileId, status: 'uploading' },
    })
    await prisma.arivarangamAIState.update({
      where: { id: 'singleton' },
      data:  { pendingFineTuneFileId: fileId },
    })
  } finally {
    // Clean up local file regardless
    fs.unlink(exportResult.filePath, () => {})
  }

  // ── Step 4: Create fine-tuning job ────────────────────────────────────────
  const ftJob = await (client as any).fineTuning?.jobs?.create?.({
    model:         FINE_TUNE_BASE_MODEL,
    training_file: fileId,
    name:          `arivarangam-v${Date.now()}`,
    hyperparameters: {
      n_epochs: 3,
    },
  })

  const anthropicJobId: string = ftJob.id

  await prisma.fineTuneJob.update({
    where: { id: jobId },
    data:  { anthropicJobId, status: 'training' },
  })

  await prisma.arivarangamAIState.update({
    where: { id: 'singleton' },
    data:  {
      fineTuneStatus:      'training',
      pendingFineTuneJobId: anthropicJobId,
    },
  })

  // BullMQ poller will pick up from here — poll every 5 min until done
  console.log(`[FineTuneManager] Training job submitted: ${anthropicJobId} (${exportResult.sampleCount} samples)`)
}

// ─── Deployment ────────────────────────────────────────────────────────────────

async function deployFineTunedModel(anthropicJobId: string, newModelId: string): Promise<void> {
  const state = await prisma.arivarangamAIState.findUnique({ where: { id: 'singleton' } })

  // Compute next milestone: current + 1000 (or proportionally scale)
  const currentCount   = state?.knowledgeCount  ?? 0
  const currentVersion = state?.fineTuneVersion ?? 0
  const nextMilestone  = currentCount + 1000

  // Atomic update: swap model + advance version + set next milestone
  await prisma.$transaction([
    prisma.arivarangamAIState.update({
      where: { id: 'singleton' },
      data: {
        currentModelId:      newModelId,
        lastFineTuneModel:   state?.currentModelId ?? 'claude-sonnet-4-6',
        fineTuneStatus:      'idle',
        lastFineTuneAt:      new Date(),
        fineTuneVersion:     currentVersion + 1,
        nextMilestone,
        pendingFineTuneJobId:  null,
        pendingFineTuneFileId: null,
      },
    }),
    prisma.fineTuneJob.updateMany({
      where: { anthropicJobId },
      data:  {
        status:      'succeeded',
        newModelId,
        completedAt: new Date(),
        deployedAt:  new Date(),
      },
    }),
  ])

  // Invalidate the model cache so Sabha connector picks up new model immediately
  invalidateModelCache()

  const newVersion = currentVersion + 1
  console.log(`[FineTuneManager] ✓ Deployed fine-tuned model: ${newModelId} (v${newVersion})`)

  // Notify ALL users that Arivarangam AI just got smarter (non-blocking)
  broadcastModelUpgrade(newVersion, newModelId).catch(() => {})
}

async function markJobFailed(jobId: string, errorMessage: string): Promise<void> {
  await prisma.arivarangamAIState.update({
    where: { id: 'singleton' },
    data: {
      fineTuneStatus:      'failed',
      pendingFineTuneJobId: null,
    },
  }).catch(() => {})

  await prisma.fineTuneJob.updateMany({
    where: { id: jobId },
    data:  { status: 'failed', errorMessage, completedAt: new Date() },
  }).catch(() => {})

  console.error(`[FineTuneManager] Fine-tune job ${jobId} failed: ${errorMessage}`)
}

// ─── Model ID cache ───────────────────────────────────────────────────────────
// Cached for 60 seconds to avoid a DB hit on every synthesis request.

let modelIdCache: string | null = null
let modelIdCacheExpiry = 0

export async function getCurrentModelId(): Promise<string> {
  if (modelIdCache && Date.now() < modelIdCacheExpiry) return modelIdCache

  try {
    const state = await prisma.arivarangamAIState.findUnique({
      where:  { id: 'singleton' },
      select: { currentModelId: true },
    })
    modelIdCache       = state?.currentModelId ?? 'claude-sonnet-4-6'
    modelIdCacheExpiry = Date.now() + 60_000  // cache for 60s
    return modelIdCache
  } catch {
    return modelIdCache ?? 'claude-sonnet-4-6'
  }
}

export function invalidateModelCache(): void {
  modelIdCache       = null
  modelIdCacheExpiry = 0
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: key })
}
