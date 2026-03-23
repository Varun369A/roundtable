/**
 * Expert Review Marketplace — core business logic.
 *
 * Manages the full lifecycle of expert reviews:
 *   createReviewRequest → claimReview → submitReview → acceptReview
 *
 * Credits are escrowed at request time and released to the expert on acceptance.
 * Stale (expired) reviews are refunded via the expireStaleReviews cron handler.
 */

import { prisma } from '@arivarangam/db'
import { debitWallet, creditWallet, InsufficientCreditsError } from './credit-manager'
import { createNotification } from './notifications'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExpertSummary {
  id: string
  displayName: string
  avatarUrl?: string
  specializations: string[]
  avgRating: number
  reviewCount: number
  ratePerReview: number
}

// ─── createReviewRequest ──────────────────────────────────────────────────────

/**
 * Find the best available expert for a specialization, escrow credits from the
 * requesting user's wallet, create an ExpertReview record, and notify the expert.
 */
export async function createReviewRequest(
  taskId: string,
  userId: string,
  specialization: string,
  description?: string
): Promise<{ reviewId: string; creditsEscrowed: number }> {
  // 1. Find best available expert matching the specialization
  const expert = await prisma.expertProfile.findFirst({
    where: {
      status: 'ACTIVE',
      isAvailable: true,
      specializations: { has: specialization },
    },
    orderBy: [{ avgRating: 'desc' }, { reviewCount: 'desc' }],
    select: { id: true, ratePerReview: true, userId: true },
  })

  if (!expert) {
    throw new Error('No experts available for this specialization')
  }

  const creditsEscrowed = expert.ratePerReview

  // 2. Escrow credits from user wallet
  try {
    await debitWallet(
      userId,
      creditsEscrowed,
      'TASK_USAGE',
      `Expert review escrow — ${specialization}`,
      { taskId }
    )
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      throw new Error(
        `Insufficient credits: you need ${err.required} credits but only have ${err.available}. Top up your wallet to request an expert review.`
      )
    }
    throw err
  }

  // 3. Create the ExpertReview record
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now

  const review = await prisma.expertReview.create({
    data: {
      taskId,
      userId,
      expertId: expert.id,
      specialization,
      description: description ?? null,
      status: 'OPEN',
      creditsEscrowed,
      expiresAt,
    },
    select: { id: true },
  })

  // 4. Notify the expert
  await createNotification({
    userId: expert.userId,
    type: 'system_alert',
    title: 'New review request assigned to you',
    body: `You have been assigned a ${specialization} review request. Claim it in your inbox before it expires.`,
    link: `/marketplace/inbox`,
    metadata: { reviewId: review.id, taskId, specialization },
  }).catch(() => {
    // Non-fatal — review was created successfully even if notification fails
  })

  return { reviewId: review.id, creditsEscrowed }
}

// ─── claimReview ──────────────────────────────────────────────────────────────

/**
 * Expert claims an OPEN review that was pre-assigned to them.
 */
export async function claimReview(reviewId: string, expertId: string): Promise<void> {
  const review = await prisma.expertReview.findUnique({
    where: { id: reviewId },
    select: { id: true, expertId: true, status: true, expiresAt: true },
  })

  if (!review) {
    throw new Error('Review not found')
  }
  if (review.expertId !== expertId) {
    throw new Error('This review was not assigned to you')
  }
  if (review.status !== 'OPEN') {
    throw new Error(`Review cannot be claimed in status: ${review.status}`)
  }
  if (review.expiresAt < new Date()) {
    throw new Error('This review has expired')
  }

  await prisma.expertReview.update({
    where: { id: reviewId },
    data: { status: 'IN_REVIEW', claimedAt: new Date() },
  })
}

// ─── submitReview ─────────────────────────────────────────────────────────────

/**
 * Expert submits their completed review feedback.
 */
export async function submitReview(
  reviewId: string,
  expertId: string,
  feedback: string
): Promise<void> {
  const review = await prisma.expertReview.findUnique({
    where: { id: reviewId },
    select: { id: true, expertId: true, status: true, userId: true, taskId: true },
  })

  if (!review) {
    throw new Error('Review not found')
  }
  if (review.expertId !== expertId) {
    throw new Error('This review was not assigned to you')
  }
  if (review.status !== 'IN_REVIEW') {
    throw new Error(`Review cannot be submitted in status: ${review.status}`)
  }

  await prisma.expertReview.update({
    where: { id: reviewId },
    data: {
      status: 'SUBMITTED',
      feedback,
      submittedAt: new Date(),
    },
  })

  // Notify the review requester
  await createNotification({
    userId: review.userId,
    type: 'task_completed',
    title: 'Expert review ready',
    body: 'Your expert review has been submitted. Review the feedback and rate the expert.',
    link: `/roundtable/${review.taskId}`,
    metadata: { reviewId, taskId: review.taskId },
  }).catch(() => {})
}

// ─── acceptReview ─────────────────────────────────────────────────────────────

/**
 * User accepts the expert's review, rates the expert (1–5), and releases the
 * escrowed credits to the expert's wallet.
 */
export async function acceptReview(
  reviewId: string,
  userId: string,
  rating: number,
  ratingComment?: string
): Promise<void> {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error('Rating must be an integer between 1 and 5')
  }

  const review = await prisma.expertReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      userId: true,
      expertId: true,
      status: true,
      creditsEscrowed: true,
    },
  })

  if (!review) {
    throw new Error('Review not found')
  }
  if (review.userId !== userId) {
    throw new Error('You are not the requester of this review')
  }
  if (review.status !== 'SUBMITTED') {
    throw new Error(`Review cannot be accepted in status: ${review.status}`)
  }

  // Fetch the expert profile to get its owner userId and current rating stats
  const expertProfile = await prisma.expertProfile.findUnique({
    where: { id: review.expertId },
    select: { userId: true, avgRating: true, reviewCount: true },
  })

  if (!expertProfile) {
    throw new Error('Expert profile not found')
  }

  // Update review status
  await prisma.expertReview.update({
    where: { id: reviewId },
    data: {
      status: 'ACCEPTED',
      rating,
      ratingComment: ratingComment ?? null,
    },
  })

  // Release escrowed credits to the expert
  await creditWallet(
    expertProfile.userId,
    review.creditsEscrowed,
    'MARKETPLACE_EARN',
    `Expert review payment for review ${reviewId}`
  )

  // Update expert's weighted average rating and increment review count
  const newReviewCount = expertProfile.reviewCount + 1
  const newAvgRating =
    (expertProfile.avgRating * expertProfile.reviewCount + rating) / newReviewCount

  await prisma.expertProfile.update({
    where: { id: review.expertId },
    data: {
      avgRating: newAvgRating,
      reviewCount: newReviewCount,
    },
  })
}

// ─── expireStaleReviews ───────────────────────────────────────────────────────

/**
 * Called by cron every 30 minutes.
 * Finds OPEN and IN_REVIEW reviews past their expiresAt and refunds the user.
 */
export async function expireStaleReviews(): Promise<void> {
  const now = new Date()

  const staleReviews = await prisma.expertReview.findMany({
    where: {
      status: { in: ['OPEN', 'IN_REVIEW'] },
      expiresAt: { lt: now },
    },
    select: {
      id: true,
      userId: true,
      creditsEscrowed: true,
      taskId: true,
    },
  })

  if (staleReviews.length === 0) return

  for (const review of staleReviews) {
    try {
      // Refund escrowed credits to the user
      await creditWallet(
        review.userId,
        review.creditsEscrowed,
        'REFUND',
        `Refund for expired expert review ${review.id}`,
        { taskId: review.taskId }
      )

      await prisma.expertReview.update({
        where: { id: review.id },
        data: { status: 'EXPIRED' },
      })

      // Notify the user of the refund
      await createNotification({
        userId: review.userId,
        type: 'system_alert',
        title: 'Expert review expired — credits refunded',
        body: `Your expert review request expired with no response. ${review.creditsEscrowed} credits have been returned to your wallet.`,
        link: `/roundtable/${review.taskId}`,
        metadata: { reviewId: review.id, refundedCredits: review.creditsEscrowed },
      }).catch(() => {})
    } catch (err) {
      console.error(`[expert-marketplace] Failed to expire review ${review.id}:`, err)
    }
  }

  console.log(`[expert-marketplace] Expired ${staleReviews.length} stale reviews`)
}

// ─── getExpertLeaderboard ─────────────────────────────────────────────────────

/**
 * Returns top 20 experts by average rating (minimum 5 completed reviews),
 * optionally filtered by specialization.
 */
export async function getExpertLeaderboard(specialization?: string): Promise<ExpertSummary[]> {
  const experts = await prisma.expertProfile.findMany({
    where: {
      status: 'ACTIVE',
      reviewCount: { gte: 5 },
      ...(specialization ? { specializations: { has: specialization } } : {}),
    },
    orderBy: { avgRating: 'desc' },
    take: 20,
    select: {
      id: true,
      specializations: true,
      avgRating: true,
      reviewCount: true,
      ratePerReview: true,
      user: {
        select: { name: true, avatarUrl: true },
      },
    },
  })

  return experts.map((e) => ({
    id: e.id,
    displayName: e.user.name,
    avatarUrl: e.user.avatarUrl ?? undefined,
    specializations: e.specializations,
    avgRating: e.avgRating,
    reviewCount: e.reviewCount,
    ratePerReview: e.ratePerReview,
  }))
}

// ─── applyForExpert ───────────────────────────────────────────────────────────

/**
 * Allows a user to apply to become an expert on the platform.
 * Creates an ExpertProfile with PENDING_REVIEW status for admin approval.
 */
export async function applyForExpert(
  userId: string,
  bio: string,
  specializations: string[],
  languages: string[],
  credentialsUrl?: string,
  ratePerReview = 50
): Promise<string> {
  // Ensure the user doesn't already have a profile
  const existing = await prisma.expertProfile.findUnique({
    where: { userId },
    select: { id: true },
  })

  if (existing) {
    throw new Error('You have already applied to become an expert')
  }

  const profile = await prisma.expertProfile.create({
    data: {
      userId,
      bio,
      specializations,
      languages,
      credentialsUrl: credentialsUrl ?? null,
      ratePerReview,
      status: 'PENDING_REVIEW',
      isAvailable: true,
    },
    select: { id: true },
  })

  return profile.id
}
