'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'

interface BillingStatus {
  tier: string
  plan: {
    id: string
    name: string
    priceInr: number
    tasksPerMonth: number
    features: string[]
  }
  subscription: {
    status: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    razorpaySubscriptionId: string
  } | null
  usage: {
    tasksUsed: number
    tasksLimit: number
    percentUsed: number
    plan: string
  }
  billing: {
    hasActiveSubscription: boolean
    canUpgrade: boolean
    cancelAtPeriodEnd: boolean
  }
}

const USAGE_BAR_COLOR = (pct: number) =>
  pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-brand-500'

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading]     = useState(true)
  const [cancelling, setCancelling] = useState(false)

  const upgraded = searchParams.get('upgraded')

  useEffect(() => {
    apiFetch<BillingStatus>('/api/v1/billing/status')
      .then((res) => {
        if (!res.success) { router.push('/login'); return }
        setStatus(res.data || null)
      })
      .finally(() => setLoading(false))
  }, [router])

  async function handleCancel() {
    if (!confirm('Cancel subscription? You keep access until the end of the current period.')) return
    setCancelling(true)
    const res = await apiFetch('/api/v1/billing/cancel', { method: 'POST' })
    if (res.success) {
      setStatus((prev) => prev
        ? { ...prev, billing: { ...prev.billing, cancelAtPeriodEnd: true } }
        : prev
      )
    } else {
      alert(res.error?.message || 'Failed to cancel')
    }
    setCancelling(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading billing…</div>
      </div>
    )
  }

  if (!status) return null

  const limitReached = status.usage.tasksLimit !== -1 && status.usage.percentUsed >= 90

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 sticky top-0 z-10 bg-white/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-700 text-sm transition-colors">← Dashboard</Link>
          <div className="h-4 w-px bg-slate-200" />
          <span className="font-medium text-sm text-slate-900">Billing & Plan</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Upgrade success banner */}
        {upgraded && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-700 text-sm font-medium">
            ✓ Plan upgraded successfully. Welcome to Arivarangam {status.plan.name}!
          </div>
        )}

        {/* Limit warning */}
        {limitReached && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600 text-sm">
            You have used {status.usage.tasksUsed}/{status.usage.tasksLimit} tasks this month.{' '}
            <Link href="/pricing" className="underline">Upgrade your plan</Link> to continue.
          </div>
        )}

        {/* Current plan */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">Current plan</p>
              <h2 className="text-2xl font-bold text-slate-900">{status.plan.name}</h2>
              {status.plan.priceInr > 0 && (
                <p className="text-slate-500 text-sm mt-0.5">
                  ₹{status.plan.priceInr.toLocaleString('en-IN')}/month
                </p>
              )}
            </div>
            {status.billing.canUpgrade && (
              <Link
                href="/pricing"
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-sm font-medium transition-colors"
              >
                Upgrade
              </Link>
            )}
          </div>

          <ul className="space-y-1">
            {status.plan.features.map((f) => (
              <li key={f} className="text-sm text-slate-600 flex items-center gap-2">
                <span className="text-green-500">✓</span> {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Usage this month */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Usage this month</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-500">Tasks</span>
                <span className="font-mono text-slate-900">
                  {status.usage.tasksUsed}
                  {status.usage.tasksLimit !== -1 ? ` / ${status.usage.tasksLimit}` : ' / ∞'}
                </span>
              </div>
              {status.usage.tasksLimit !== -1 && (
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${USAGE_BAR_COLOR(status.usage.percentUsed)}`}
                    style={{ width: `${Math.min(status.usage.percentUsed, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subscription management */}
        {status.subscription && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Subscription</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className={status.subscription.status === 'active' ? 'text-green-600' : 'text-yellow-600'}>
                  {status.billing.cancelAtPeriodEnd
                    ? 'Cancels at period end'
                    : status.subscription.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Next renewal</span>
                <span className="text-slate-900">{new Date(status.subscription.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            {!status.billing.cancelAtPeriodEnd && status.billing.hasActiveSubscription && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="mt-4 text-sm text-slate-500 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelling…' : 'Cancel subscription'}
              </button>
            )}
          </div>
        )}

        {/* Lifetime deal CTA for free users */}
        {status.tier === 'FREE' && (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-center">
            <p className="text-yellow-700 font-semibold mb-1">Early adopter lifetime deal</p>
            <p className="text-slate-500 text-sm mb-4">
              First 100 users get Arivarangam Pro for life — one-time payment of ₹2,999.
            </p>
            <Link href="/pricing" className="px-5 py-2.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-sm font-medium transition-colors">
              Claim lifetime deal →
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
