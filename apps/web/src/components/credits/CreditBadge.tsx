'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

interface CreditBadgeProps {
  className?: string
}

export default function CreditBadge({ className = '' }: CreditBadgeProps) {
  const router = useRouter()
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTooltip, setShowTooltip] = useState(false)

  const fetchBalance = async () => {
    try {
      const res = await apiFetch<{ wallet: { balance: number } }>('/api/v1/credits/wallet')
      if (res.success && res.data) {
        setBalance(res.data.wallet.balance)
      }
    } catch {
      // silently fail — badge is non-critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()

    const handler = () => fetchBalance()
    window.addEventListener('credits_updated', handler)
    return () => window.removeEventListener('credits_updated', handler)
  }, [])

  const isLow = balance !== null && balance < 50 && balance > 0
  const isEmpty = balance === 0

  const colorClass = isEmpty
    ? 'bg-red-500/15 text-red-400 border-red-500/30'
    : isLow
    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    : 'bg-white/8 text-zinc-300 border-white/10'

  const tooltip = isEmpty ? 'No credits' : isLow ? 'Low balance' : null

  if (loading) {
    return (
      <div className={`w-16 h-7 rounded-lg bg-white/5 animate-pulse ${className}`} />
    )
  }

  return (
    <div className="relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <button
        onClick={() => router.push('/credits')}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all hover:opacity-80 active:scale-95 ${colorClass} ${className}`}
        aria-label={`Credit balance: ${balance ?? 0} credits`}
      >
        <svg
          className="w-3.5 h-3.5 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
        </svg>
        <span>{(balance ?? 0).toLocaleString('en-IN')}</span>
      </button>

      {tooltip && showTooltip && (
        <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium px-2 py-1 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 z-50 pointer-events-none shadow-xl">
          {tooltip}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 border-t border-l border-white/10 rotate-45" />
        </div>
      )}
    </div>
  )
}
