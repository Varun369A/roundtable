'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/** Decode a JWT payload without any external dependency. */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

const CHECK_INTERVAL_MS = 30_000      // check every 30 s
const WARN_BEFORE_MS    = 2 * 60_000  // warn 2 min before expiry

export default function SessionExpiryWarning() {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft]   = useState<number | null>(null)
  const [refreshing, setRefreshing]     = useState(false)
  const [dismissed, setDismissed]       = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function checkExpiry() {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('accessToken')
    if (!token) { setSecondsLeft(null); return }

    const payload = decodeJwtPayload(token)
    if (!payload?.exp) { setSecondsLeft(null); return }

    const nowMs  = Date.now()
    const expMs  = payload.exp * 1000
    const diffMs = expMs - nowMs

    if (diffMs <= 0) {
      // Already expired — redirect to login
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      router.push('/login?reason=session_expired')
      return
    }

    if (diffMs <= WARN_BEFORE_MS) {
      setSecondsLeft(Math.ceil(diffMs / 1000))
      setDismissed(false)
    } else {
      setSecondsLeft(null)
    }
  }

  useEffect(() => {
    checkExpiry()
    intervalRef.current = setInterval(checkExpiry, CHECK_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        router.push('/login?reason=session_expired')
        return
      }

      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      const data = await res.json()

      if (data.success && data.data?.tokens) {
        localStorage.setItem('accessToken',  data.data.tokens.accessToken)
        localStorage.setItem('refreshToken', data.data.tokens.refreshToken)
        setSecondsLeft(null)
        setDismissed(true)
      } else {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        router.push('/login?reason=session_expired')
      }
    } catch {
      // Network error — don't redirect, let the user try again
    } finally {
      setRefreshing(false)
    }
  }

  if (!secondsLeft || dismissed) return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeLabel = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="fixed bottom-6 right-6 z-50 flex items-start gap-3 max-w-sm w-full p-4 rounded-2xl border border-amber-300 bg-white shadow-2xl shadow-slate-200/60 animate-fade-in"
    >
      <span className="text-amber-500 mt-0.5 text-lg shrink-0" aria-hidden="true">⚠</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-700">
          Your session expires in {timeLabel}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          Save your work and stay logged in.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Stay logged in — refresh session"
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 rounded-lg text-xs font-semibold text-white transition-colors whitespace-nowrap"
        >
          {refreshing ? 'Refreshing…' : 'Stay logged in'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss session expiry warning"
          className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
