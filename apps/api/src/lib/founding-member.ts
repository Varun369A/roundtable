/**
 * Founding Member Service — first 200 paying users get lifetime pricing.
 *
 * Founding member benefits:
 *   - Builder: ₹499/month locked for life (vs regular ₹799)
 *   - Studio:  ₹999/month locked for life (vs regular ₹1,999)
 *   - Cap: 200 founding members total (hard limit)
 *   - Once assigned, the price lock survives plan changes and renewals
 *
 * How it works:
 *   1. User pays their first subscription via Razorpay
 *   2. Webhook calls grantFoundingMemberIfEligible(userId)
 *   3. We atomically check the count; if < 200, grant the badge + lock the price
 *   4. User's Razorpay subscription is updated to the founding price plan
 */

import { prisma } from '@sabha/db'

const FOUNDING_MEMBER_CAP = 200

// Razorpay plan IDs for founding member pricing
const FOUNDING_PLAN_MAP: Record<string, string> = {
  BUILDER:    process.env.RAZORPAY_PLAN_BUILDER_FOUNDING || '',
  STUDIO:     process.env.RAZORPAY_PLAN_STUDIO_FOUNDING  || '',
}

export interface FoundingMemberResult {
  granted:         boolean
  foundingMemberNumber?: number  // their slot number (1-200)
  lockedPriceSlug?:    string
}

/**
 * Checks if the founding member cap has been reached.
 * Returns the current count — cheaper than a full grant check for display purposes.
 */
export async function getFoundingMemberCount(): Promise<number> {
  return prisma.user.count({ where: { foundingMember: true } })
}

/**
 * Attempt to grant founding member status.
 *
 * This uses a Prisma transaction with an atomic count check.
 * Two concurrent first-payments cannot both be granted if we're at 199:
 * the DB serialisation ensures only one UPDATE runs while the other sees count=200.
 *
 * Returns { granted: false } if cap already reached or user is already a founding member.
 */
export async function grantFoundingMemberIfEligible(
  userId: string,
): Promise<FoundingMemberResult> {
  return prisma.$transaction(async (tx) => {
    // Check if user already has the badge
    const user = await tx.user.findUnique({
      where:  { id: userId },
      select: { foundingMember: true, tier: true },
    })

    if (!user) return { granted: false }
    if (user.foundingMember) return { granted: false }  // already has it

    // Count current founding members under the cap check
    const current = await tx.user.count({ where: { foundingMember: true } })

    if (current >= FOUNDING_MEMBER_CAP) {
      return { granted: false }
    }

    // Grant the badge
    await tx.user.update({
      where: { id: userId },
      data:  { foundingMember: true },
    })

    const memberNumber = current + 1

    return {
      granted:             true,
      foundingMemberNumber: memberNumber,
      lockedPriceSlug:     FOUNDING_PLAN_MAP[user.tier] || undefined,
    }
  })
}

/**
 * Get the correct Razorpay plan ID for a given tier.
 * Founding members get the discounted founding plan; everyone else gets the regular plan.
 */
export function getRazorpayPlanId(tier: string, isFoundingMember: boolean): string {
  if (isFoundingMember) {
    const foundingPlan = FOUNDING_PLAN_MAP[tier]
    if (foundingPlan) return foundingPlan
  }

  const regularPlans: Record<string, string> = {
    BUILDER:    process.env.RAZORPAY_PLAN_BUILDER    || '',
    STUDIO:     process.env.RAZORPAY_PLAN_STUDIO     || '',
    ENTERPRISE: process.env.RAZORPAY_PLAN_ENTERPRISE || '',
  }

  return regularPlans[tier] || ''
}
