/**
 * Arivarangam Confidence Tracker
 *
 * Tracks how much Arivarangam AI has learned per domain (TaskCategory).
 * Computes a composite confidence score (0–100) and determines the current
 * learning stage:
 *
 *   STUDENT      (0–39):   Follows all specialist guidance unconditionally.
 *   ADVISORY     (40–74):  Reasons about the task first, then uses specialists
 *                          to verify and fill gaps.
 *   INDEPENDENT  (75–100): Leads the work with its own judgment; calls
 *                          specialists selectively for confirmation.
 *
 * Confidence is recalculated every time a task is rated or completed.
 * Stage transitions are one-way upward — never demoted automatically.
 */
import { prisma } from '@arivarangam/db'
import type { TaskCategory } from '@arivarangam/types'

export type LearningStage = 'STUDENT' | 'ADVISORY' | 'INDEPENDENT'

export interface DomainConfidenceSnapshot {
  category:           TaskCategory
  totalSamples:       number
  highQualitySamples: number
  avgQualityScore:    number
  confidenceScore:    number
  stage:              LearningStage
}

// ─── Confidence formula ───────────────────────────────────────────────────────
// confidenceScore = (sampleWeight * 0.4) + (qualityWeight * 0.4) + (densityWeight * 0.2)
//
//   sampleWeight:  high-quality samples / 300 capped at 1.0 → 0–40 pts
//   qualityWeight: avgQualityScore (0–1) scaled to 0–40 pts
//   densityWeight: ratio of high-quality to total samples → 0–20 pts

function computeConfidence(totalSamples: number, highQuality: number, avgQuality: number): number {
  const sampleWeight  = Math.min(highQuality / 300, 1.0) * 40
  const qualityWeight = avgQuality * 40
  const densityWeight = totalSamples > 0 ? (highQuality / totalSamples) * 20 : 0
  return Math.round(sampleWeight + qualityWeight + densityWeight)
}

function stageFromScore(score: number, current: LearningStage): LearningStage {
  // Stages only advance upward — never demoted
  if (score >= 75) return 'INDEPENDENT'
  if (score >= 40) return current === 'INDEPENDENT' ? 'INDEPENDENT' : 'ADVISORY'
  return current === 'INDEPENDENT' || current === 'ADVISORY' ? current : 'STUDENT'
}

/**
 * Recalculates and persists confidence metrics for a given category.
 * Called after every task completion and every quality rating change.
 */
export async function updateDomainConfidence(category: TaskCategory): Promise<void> {
  try {
    const [stats] = await prisma.arivarangamKnowledge.groupBy({
      by:     ['category'],
      where:  { category },
      _count: { id: true },
      _avg:   { qualityScore: true },
    })

    if (!stats) return

    const totalSamples = stats._count.id
    const avgQuality   = stats._avg.qualityScore ?? 0

    // Count high-quality samples (score >= 0.7)
    const highQualitySamples = await prisma.arivarangamKnowledge.count({
      where: { category, qualityScore: { gte: 0.7 } },
    })

    const confidenceScore = computeConfidence(totalSamples, highQualitySamples, avgQuality)

    // Read current stage so we don't demote
    const existing = await prisma.domainConfidence.findUnique({ where: { category } })
    const currentStage = (existing?.stage ?? 'STUDENT') as LearningStage
    const newStage     = stageFromScore(confidenceScore, currentStage)

    await prisma.domainConfidence.upsert({
      where:  { category },
      update: {
        totalSamples,
        highQualitySamples,
        avgQualityScore: avgQuality,
        confidenceScore,
        stage:           newStage,
        lastUpdatedAt:   new Date(),
      },
      create: {
        id: `dc_${category}`,
        category,
        totalSamples,
        highQualitySamples,
        avgQualityScore: avgQuality,
        confidenceScore,
        stage:           newStage,
      },
    })

    // When a domain becomes INDEPENDENT, check if all domains are advanced
    // and auto-promote global ArivarangamAIState to READY
    if (newStage !== currentStage && newStage !== 'STUDENT') {
      checkGlobalReadiness().catch(() => {})
    }
  } catch {
    // Non-critical
  }
}

/**
 * Get the current learning stage for a category.
 * Returns STUDENT if no data exists yet.
 */
export async function getStageForCategory(category: TaskCategory): Promise<LearningStage> {
  try {
    const row = await prisma.domainConfidence.findUnique({ where: { category } })
    return (row?.stage ?? 'STUDENT') as LearningStage
  } catch {
    return 'STUDENT'
  }
}

/**
 * Get all domain confidence snapshots (for admin dashboard).
 */
export async function getAllDomainConfidence(): Promise<DomainConfidenceSnapshot[]> {
  const rows = await prisma.domainConfidence.findMany({ orderBy: { confidenceScore: 'desc' } })
  return rows.map((r) => ({
    category:           r.category as TaskCategory,
    totalSamples:       r.totalSamples,
    highQualitySamples: r.highQualitySamples,
    avgQualityScore:    r.avgQualityScore,
    confidenceScore:    r.confidenceScore,
    stage:              r.stage as LearningStage,
  }))
}

// ─── Global readiness check ───────────────────────────────────────────────────

async function checkGlobalReadiness(): Promise<void> {
  const state = await prisma.arivarangamAIState.findUnique({ where: { id: 'singleton' } })
  if (!state || state.status !== 'LEARNING') return

  const totalKnowledge = await prisma.arivarangamKnowledge.count()
  if (totalKnowledge >= state.readyThreshold) {
    await prisma.arivarangamAIState.update({
      where:  { id: 'singleton' },
      data:   { status: 'READY' },
    })
  }
}
