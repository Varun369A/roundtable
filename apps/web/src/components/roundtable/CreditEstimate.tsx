'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface CreditEstimate {
  credits: number
  subtaskCount: number
  hasDiscussionEngine: boolean
  templateName: string | null
  breakdown: {
    base: number
    discussionMultiplier: string
    total: number
  }
  label: string
}

interface CreditEstimateProps {
  goal: string
  templateId?: string
  /** Called with the estimate once loaded — parent can use to block submit if insufficient */
  onEstimate?: (estimate: CreditEstimate | null) => void
}

export function CreditEstimate({ goal, templateId, onEstimate }: CreditEstimateProps) {
  const [estimate, setEstimate] = useState<CreditEstimate | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  // Debounce estimate fetching — don't hammer API on every keystroke
  useEffect(() => {
    if (goal.length < 10) {
      setEstimate(null)
      onEstimate?.(null)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const [estRes, walletRes] = await Promise.all([
          apiFetch('/api/v1/tasks/estimate', {
            method: 'POST',
            body: JSON.stringify({ goal, templateId }),
          }),
          apiFetch('/api/v1/credits/wallet'),
        ])

        if (estRes.success) {
          setEstimate(estRes.data.estimate)
          onEstimate?.(estRes.data.estimate)
        }
        if (walletRes.success) {
          setBalance(walletRes.data.wallet?.balance ?? walletRes.data.balance ?? null)
        }
      } catch {
        // Non-fatal — estimate is a best-effort feature
      } finally {
        setLoading(false)
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [goal, templateId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!estimate && !loading) return null

  const insufficient = balance !== null && estimate !== null && balance < estimate.credits

  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-colors ${
      insufficient
        ? 'bg-red-50 border-red-200 text-red-700'
        : 'bg-indigo-50 border-indigo-100 text-indigo-700'
    }`}>
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <span className="w-3 h-3 border border-slate-300 border-t-slate-500 rounded-full animate-spin" />
          Estimating credits…
        </div>
      ) : estimate ? (
        <>
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>{estimate.label}</strong>
              {' '}· {estimate.subtaskCount} specialists
              {estimate.hasDiscussionEngine && ' · includes peer review'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {balance !== null && (
              <span className={insufficient ? 'text-red-600 font-medium' : 'text-indigo-500'}>
                {insufficient ? `Need ${estimate.credits - balance} more` : `Balance: ${balance}`}
              </span>
            )}
            {insufficient && (
              <a
                href="/pricing"
                className="shrink-0 px-2 py-0.5 rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors font-medium"
              >
                Top up →
              </a>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
