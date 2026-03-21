'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type VerifyState = 'loading' | 'success' | 'error'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [state, setState] = useState<VerifyState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const verified = useRef(false)

  useEffect(() => {
    if (!token) {
      setState('error')
      setErrorMessage('No verification token provided. Please use the link from your email.')
      return
    }

    if (verified.current) return
    verified.current = true

    async function verify() {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await res.json()

        if (data.success) {
          setState('success')
        } else {
          setState('error')
          setErrorMessage(
            data.error?.message || 'Verification failed. The link may have expired.'
          )
        }
      } catch {
        setState('error')
        setErrorMessage('Network error. Please try again or request a new verification link.')
      }
    }

    verify()
  }, [token])

  async function handleResend() {
    const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

    if (!accessToken) {
      setErrorMessage('Please log in to resend the verification email.')
      return
    }

    setResendLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const data = await res.json()

      if (data.success) {
        setResendSent(true)
      } else {
        setErrorMessage(data.error?.message || 'Failed to resend verification email.')
      }
    } catch {
      setErrorMessage('Network error. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Verifying your email…</p>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-3">Email verified!</h1>
          <p className="text-zinc-400 text-sm mb-8">
            Welcome to Sabha. Your account is fully activated and ready to use.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-brand-600 hover:bg-brand-500 rounded-xl font-semibold transition-colors text-sm"
          >
            Go to Dashboard →
          </Link>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white mb-3">Link expired</h1>
        <p className="text-zinc-400 text-sm mb-6">
          {errorMessage || 'This verification link has expired or is invalid.'}
        </p>

        {resendSent ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <p className="text-emerald-400 text-sm">Verification email sent! Check your inbox.</p>
          </div>
        ) : (
          <button
            onClick={handleResend}
            disabled={resendLoading}
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 rounded-xl font-semibold transition-colors text-sm mb-4"
          >
            {resendLoading ? 'Sending…' : 'Resend verification email'}
          </button>
        )}

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Continue to dashboard without verifying →
        </Link>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
