import { prisma } from '@arivarangam/db'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreditTransactionType =
  | 'PURCHASE'
  | 'TASK_USAGE'
  | 'REFERRAL_BONUS'
  | 'REFERRAL_REWARD'
  | 'SIGNUP_BONUS'
  | 'PROMOTION'
  | 'EXPIRY'
  | 'REFUND'
  | 'MARKETPLACE_EARN'

// ─── Errors ───────────────────────────────────────────────────────────────────

export class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super(`Insufficient credits: need ${required}, have ${available}`)
    this.name = 'InsufficientCreditsError'
  }
}

// ─── Wallet operations ────────────────────────────────────────────────────────

export async function getOrCreateWallet(
  userId: string
): Promise<{ id: string; balance: number; lifetimeEarned: number; lifetimeSpent: number }> {
  const wallet = await prisma.creditWallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { id: true, balance: true, lifetimeEarned: true, lifetimeSpent: true },
  })
  return wallet
}

export async function getBalance(userId: string): Promise<number> {
  const wallet = await prisma.creditWallet.findUnique({
    where: { userId },
    select: { balance: true },
  })
  return wallet?.balance ?? 0
}

export async function creditWallet(
  userId: string,
  amount: number,
  type: CreditTransactionType,
  description: string,
  opts?: { taskId?: string; referralId?: string; expiresAt?: Date }
): Promise<{ newBalance: number; transactionId: string }> {
  if (amount <= 0) {
    throw new Error(`creditWallet: amount must be positive, got ${amount}`)
  }

  const result = await prisma.$transaction(async (tx) => {
    // Upsert wallet to guarantee it exists before updating
    const wallet = await tx.creditWallet.upsert({
      where: { userId },
      update: {
        balance: { increment: amount },
        lifetimeEarned: { increment: amount },
      },
      create: {
        userId,
        balance: amount,
        lifetimeEarned: amount,
        lifetimeSpent: 0,
      },
      select: { id: true, balance: true },
    })

    const transaction = await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type,
        amount,
        balanceAfter: wallet.balance,
        description,
        taskId: opts?.taskId ?? null,
        referralId: opts?.referralId ?? null,
        expiresAt: opts?.expiresAt ?? null,
      },
      select: { id: true },
    })

    return { newBalance: wallet.balance, transactionId: transaction.id }
  })

  return result
}

export async function debitWallet(
  userId: string,
  amount: number,
  type: CreditTransactionType,
  description: string,
  opts?: { taskId?: string }
): Promise<{ newBalance: number; transactionId: string }> {
  if (amount <= 0) {
    throw new Error(`debitWallet: amount must be positive, got ${amount}`)
  }

  const result = await prisma.$transaction(async (tx) => {
    // Lock the row for the duration of this transaction
    const wallet = await tx.creditWallet.findUnique({
      where: { userId },
      select: { id: true, balance: true },
    })

    const currentBalance = wallet?.balance ?? 0

    if (currentBalance < amount) {
      throw new InsufficientCreditsError(amount, currentBalance)
    }

    const walletId = wallet!.id

    const updated = await tx.creditWallet.update({
      where: { userId },
      data: {
        balance: { decrement: amount },
        lifetimeSpent: { increment: amount },
      },
      select: { balance: true },
    })

    const transaction = await tx.creditTransaction.create({
      data: {
        walletId,
        userId,
        type,
        amount: -amount, // negative = debit
        balanceAfter: updated.balance,
        description,
        taskId: opts?.taskId ?? null,
      },
      select: { id: true },
    })

    return { newBalance: updated.balance, transactionId: transaction.id }
  })

  return result
}

export async function refundTask(taskId: string, userId: string): Promise<void> {
  // Find the original TASK_USAGE transaction for this task — only if no REFUND exists yet
  const usageTx = await prisma.creditTransaction.findFirst({
    where: {
      userId,
      taskId,
      type: 'TASK_USAGE',
    },
    select: { id: true, amount: true },
  })

  if (!usageTx) return // nothing to refund

  const alreadyRefunded = await prisma.creditTransaction.findFirst({
    where: {
      userId,
      taskId,
      type: 'REFUND',
    },
  })

  if (alreadyRefunded) return // idempotency guard

  // TASK_USAGE amounts are stored as negative; refund is the absolute value
  const refundAmount = Math.abs(usageTx.amount)
  if (refundAmount <= 0) return

  await creditWallet(
    userId,
    refundAmount,
    'REFUND',
    `Refund for task ${taskId}`,
    { taskId }
  )
}

// ─── Task credit calculation ──────────────────────────────────────────────────

export function calculateTaskCredits(
  subtaskCount: number,
  hasDiscussionEngine: boolean,
  hasExpertReview: boolean
): number {
  let credits = subtaskCount * 10

  if (hasDiscussionEngine) {
    credits = Math.round(credits * 1.5)
  }

  if (hasExpertReview) {
    credits += 50
  }

  return Math.max(10, credits)
}

// ─── Referral system ──────────────────────────────────────────────────────────

export async function generateReferralCode(userId: string, userName: string): Promise<string> {
  // Existing code — return it immediately
  const existing = await prisma.referralCode.findUnique({
    where: { userId },
    select: { code: true },
  })
  if (existing) return existing.code

  const base = userName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) || 'USER'

  // Attempt up to 10 unique codes based on name
  for (let i = 0; i < 10; i++) {
    const suffix = String(Math.floor(Math.random() * 90) + 10) // 10–99
    const candidate = `${base}${suffix}`

    const conflict = await prisma.referralCode.findUnique({ where: { code: candidate } })
    if (!conflict) {
      await prisma.referralCode.create({
        data: { userId, code: candidate },
      })
      return candidate
    }
  }

  // Fallback: random 6-char alphanumeric
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let fallback = ''
  for (let i = 0; i < 6; i++) {
    fallback += chars[Math.floor(Math.random() * chars.length)]
  }

  await prisma.referralCode.create({
    data: { userId, code: fallback },
  })

  return fallback
}

export async function applyReferralCode(refereeId: string, code: string): Promise<void> {
  const referralCode = await prisma.referralCode.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
    select: {
      id: true,
      userId: true,
      isActive: true,
      usageCount: true,
      maxUses: true,
      rewardCredits: true,
    },
  })

  if (!referralCode) {
    throw Object.assign(new Error('Referral code not found'), { statusCode: 404 })
  }

  if (!referralCode.isActive) {
    throw Object.assign(new Error('Referral code is no longer active'), { statusCode: 400 })
  }

  if (referralCode.userId === refereeId) {
    throw Object.assign(new Error('You cannot use your own referral code'), { statusCode: 400 })
  }

  if (referralCode.maxUses !== null && referralCode.usageCount >= referralCode.maxUses) {
    throw Object.assign(new Error('Referral code has reached its usage limit'), { statusCode: 400 })
  }

  // Check referee has not already been referred (@@unique([refereeId]))
  const existingReferral = await prisma.referral.findUnique({
    where: { refereeId },
  })
  if (existingReferral) {
    throw Object.assign(new Error('You have already used a referral code'), { statusCode: 400 })
  }

  // All checks passed — create referral and credit the referee atomically
  await prisma.$transaction(async (tx) => {
    const referral = await tx.referral.create({
      data: {
        referralCodeId: referralCode.id,
        referrerId: referralCode.userId,
        refereeId,
        bonusPaid: false,
        rewardPaid: false,
      },
      select: { id: true },
    })

    // Increment usage count
    await tx.referralCode.update({
      where: { id: referralCode.id },
      data: { usageCount: { increment: 1 } },
    })

    // Credit the referee immediately
    const wallet = await tx.creditWallet.upsert({
      where: { userId: refereeId },
      update: {
        balance: { increment: referralCode.rewardCredits },
        lifetimeEarned: { increment: referralCode.rewardCredits },
      },
      create: {
        userId: refereeId,
        balance: referralCode.rewardCredits,
        lifetimeEarned: referralCode.rewardCredits,
        lifetimeSpent: 0,
      },
      select: { id: true, balance: true },
    })

    await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        userId: refereeId,
        type: 'REFERRAL_REWARD',
        amount: referralCode.rewardCredits,
        balanceAfter: wallet.balance,
        description: `Referral reward for joining via code ${code.toUpperCase()}`,
        referralId: referral.id,
      },
    })

    // Mark referee reward as paid
    await tx.referral.update({
      where: { id: referral.id },
      data: { rewardPaid: true },
    })
  })
}

export async function payReferralBonus(refereeId: string): Promise<void> {
  const referral = await prisma.referral.findFirst({
    where: {
      refereeId,
      bonusPaid: false,
    },
    include: {
      referralCode: {
        select: { bonusCredits: true },
      },
    },
  })

  if (!referral) return // no unpaid referral

  await prisma.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.upsert({
      where: { userId: referral.referrerId },
      update: {
        balance: { increment: referral.referralCode.bonusCredits },
        lifetimeEarned: { increment: referral.referralCode.bonusCredits },
      },
      create: {
        userId: referral.referrerId,
        balance: referral.referralCode.bonusCredits,
        lifetimeEarned: referral.referralCode.bonusCredits,
        lifetimeSpent: 0,
      },
      select: { id: true, balance: true },
    })

    await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        userId: referral.referrerId,
        type: 'REFERRAL_BONUS',
        amount: referral.referralCode.bonusCredits,
        balanceAfter: wallet.balance,
        description: `Referral bonus — your referred user completed their first task`,
        referralId: referral.id,
      },
    })

    await tx.referral.update({
      where: { id: referral.id },
      data: {
        bonusPaid: true,
        firstTaskAt: new Date(),
      },
    })
  })
}

// ─── Admin operations ─────────────────────────────────────────────────────────

export async function grantPromotionCredits(
  userId: string,
  amount: number,
  description: string,
  expiresInDays?: number
): Promise<void> {
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : undefined

  await creditWallet(userId, amount, 'PROMOTION', description, { expiresAt })
}
