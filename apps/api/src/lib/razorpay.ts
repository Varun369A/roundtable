import crypto from 'crypto'

// Razorpay REST API base
const RAZORPAY_BASE = 'https://api.razorpay.com/v1'

function authHeader(): string {
  const creds = `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  return 'Basic ' + Buffer.from(creds).toString('base64')
}

async function razorpayRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`${RAZORPAY_BASE}${path}`, {
    method,
    headers: {
      'Authorization': authHeader(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { description: response.statusText } }))
    throw new Error(`Razorpay ${method} ${path} failed: ${JSON.stringify(err)}`)
  }

  return response.json() as Promise<T>
}

// ─── Plan IDs (create these in Razorpay dashboard) ─────────────────────────

export const RAZORPAY_PLAN_IDS: Record<string, string> = {
  starter:    process.env.RAZORPAY_PLAN_STARTER    || '',
  pro:        process.env.RAZORPAY_PLAN_PRO        || '',
  power:      process.env.RAZORPAY_PLAN_POWER      || '',
  enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE || '',
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RazorpayCustomer {
  id: string
  name: string
  email: string
  contact?: string
}

export interface RazorpaySubscription {
  id: string
  plan_id: string
  status: string
  current_start: number
  current_end: number
  charge_at: number
  total_count: number
  paid_count: number
  short_url: string
}

export interface RazorpayOrder {
  id: string
  amount: number
  currency: string
  status: string
}

// ─── Customer ──────────────────────────────────────────────────────────────

export async function createOrGetCustomer(params: {
  name: string
  email: string
  contact?: string
}): Promise<RazorpayCustomer> {
  // Check if customer already exists via search
  try {
    const existing = await razorpayRequest<{ items: RazorpayCustomer[] }>(
      'GET',
      `/customers?email=${encodeURIComponent(params.email)}`
    )
    if (existing.items?.[0]) return existing.items[0]
  } catch {
    // not found, create
  }

  return razorpayRequest<RazorpayCustomer>('POST', '/customers', {
    name: params.name,
    email: params.email,
    contact: params.contact,
    fail_existing: 0,
  })
}

// ─── Subscription ──────────────────────────────────────────────────────────

export async function createSubscription(params: {
  planId: string
  customerId: string
  totalCount?: number
  notes?: Record<string, string>
}): Promise<RazorpaySubscription> {
  return razorpayRequest<RazorpaySubscription>('POST', '/subscriptions', {
    plan_id: params.planId,
    customer_id: params.customerId,
    quantity: 1,
    total_count: params.totalCount || 120, // 10 years max
    customer_notify: 1,
    notes: params.notes || {},
  })
}

export async function cancelSubscription(
  subscriptionId: string,
  cancelAtCycleEnd = true
): Promise<RazorpaySubscription> {
  return razorpayRequest<RazorpaySubscription>(
    'POST',
    `/subscriptions/${subscriptionId}/cancel`,
    { cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }
  )
}

export async function getSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
  return razorpayRequest<RazorpaySubscription>('GET', `/subscriptions/${subscriptionId}`)
}

// ─── Webhook verification ─────────────────────────────────────────────────

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// ─── Order (for one-time payments like lifetime deal) ─────────────────────

export async function createOrder(params: {
  amountPaise: number
  currency?: string
  receipt: string
  notes?: Record<string, string>
}): Promise<RazorpayOrder> {
  return razorpayRequest<RazorpayOrder>('POST', '/orders', {
    amount: params.amountPaise,
    currency: params.currency || 'INR',
    receipt: params.receipt,
    notes: params.notes || {},
  })
}

export function verifyPaymentSignature(params: {
  orderId: string
  paymentId: string
  signature: string
}): boolean {
  const body = `${params.orderId}|${params.paymentId}`
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature))
}
