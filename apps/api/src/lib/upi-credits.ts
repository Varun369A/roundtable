/**
 * UPI Prepaid Credit Service.
 *
 * Bridges Indian users without international credit cards to Arivarangam's credit system.
 * Flow:
 *   1. User selects a CreditPack → POST /api/v1/credits/upi/order
 *   2. We create a Razorpay order → return { orderId, amount, key }
 *   3. User pays via Razorpay checkout (UPI / NetBanking / Card)
 *   4. Razorpay calls POST /api/v1/webhooks/razorpay with payment.captured event
 *   5. We verify signature → creditUpiPayment() → credits deposited to wallet
 *
 * Idempotency: creditUpiPayment() can be called multiple times for the same
 * payment — it will only deposit credits once (status PAID → CREDITED, then noop).
 */

import crypto from 'node:crypto'
import { prisma } from '@arivarangam/db'

// ─── Razorpay order creation ──────────────────────────────────────────────────

export interface UpiOrderResult {
  orderId:        string  // Razorpay order ID
  amountInrPaise: number
  currency:       'INR'
  razorpayKey:    string  // public key for checkout JS
}

export async function createUpiOrder(
  userId:      string,
  creditPackId: string,
): Promise<UpiOrderResult> {
  const pack = await prisma.creditPack.findUnique({
    where: { id: creditPackId, isActive: true },
  })
  if (!pack) throw new Error('CREDIT_PACK_NOT_FOUND')

  const razorpayKeyId     = process.env.RAZORPAY_KEY_ID     || ''
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || ''
  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error('RAZORPAY_NOT_CONFIGURED')
  }

  // Call Razorpay Orders API
  const body = JSON.stringify({
    amount:   pack.priceInr,    // paise
    currency: 'INR',
    receipt:  `sabha_${userId.slice(-8)}_${Date.now()}`,
    notes:    { creditPackId, userId },
  })

  const authHeader = 'Basic ' + Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')
  const resp = await fetch('https://api.razorpay.com/v1/orders', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body,
  })

  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Razorpay order creation failed: ${txt}`)
  }

  const order = await resp.json() as { id: string }

  // Persist pending payment record
  await prisma.upiPayment.create({
    data: {
      userId,
      creditPackId,
      razorpayOrderId: order.id,
      amountInrPaise:  pack.priceInr,
      creditsGranted:  pack.credits + pack.bonusCredits,
      status:          'PENDING',
    },
  })

  return {
    orderId:        order.id,
    amountInrPaise: pack.priceInr,
    currency:       'INR',
    razorpayKey:    razorpayKeyId,
  }
}

// ─── Razorpay webhook signature verification ──────────────────────────────────

export function verifyRazorpaySignature(
  razorpayOrderId:   string,
  razorpayPaymentId: string,
  signature:         string,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || ''
  if (!secret) return false

  const payload  = `${razorpayOrderId}|${razorpayPaymentId}`
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  // Constant-time comparison
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

// ─── Credit the wallet (called from webhook handler) ─────────────────────────

export async function creditUpiPayment(
  razorpayOrderId:   string,
  razorpayPaymentId: string,
): Promise<void> {
  // Use a transaction to atomically: update payment status + deposit credits
  await prisma.$transaction(async (tx) => {
    // Find + lock the payment record
    const payment = await tx.upiPayment.findUnique({
      where: { razorpayOrderId },
    })

    if (!payment) throw new Error(`UpiPayment not found: ${razorpayOrderId}`)

    // Idempotency: only credit once
    if (payment.status === 'CREDITED') return

    if (payment.status !== 'PAID' && payment.status !== 'PENDING') {
      throw new Error(`Cannot credit payment in status: ${payment.status}`)
    }

    // Mark as PAID → CREDITED
    await tx.upiPayment.update({
      where: { razorpayOrderId },
      data: {
        razorpayPaymentId,
        status:    'CREDITED',
        creditedAt: new Date(),
        webhookReceivedAt: new Date(),
      },
    })

    // Upsert wallet and deposit credits
    await tx.creditWallet.upsert({
      where:  { userId: payment.userId },
      update: { balance: { increment: payment.creditsGranted } },
      create: { userId: payment.userId, balance: payment.creditsGranted },
    })

    // Record the transaction for audit
    const wallet = await tx.creditWallet.findUnique({
      where: { userId: payment.userId },
      select: { id: true },
    })

    if (wallet) {
      await tx.creditTransaction.create({
        data: {
          walletId:    wallet.id,
          userId:      payment.userId,
          type:        'UPI_PURCHASE',
          amount:      payment.creditsGranted,
          description: `UPI credit purchase (order: ${razorpayOrderId})`,
          metadata:    { razorpayOrderId, razorpayPaymentId },
        } as any,
      })
    }
  })
}

// ─── Mark payment as failed ───────────────────────────────────────────────────

export async function failUpiPayment(razorpayOrderId: string): Promise<void> {
  await prisma.upiPayment.updateMany({
    where: { razorpayOrderId, status: 'PENDING' },
    data:  { status: 'FAILED' },
  })
}
