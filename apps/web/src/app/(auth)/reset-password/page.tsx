'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ─── Password strength indicator ─────────────────────────────────────────────

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  if (password.length >= 8)   score++
  if (password.length >= 12)  score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' }
  if (score <= 2) return { score, label: 'Fair', color: 'bg-yellow-500' }
  if (score <= 3) return { score, label: 'Good', color: 'bg-blue-500' }
  return { score, label: 'Strong', color: 'bg-emerald-500' }
}

// ─── Main form (needs Suspense for useSearchParams) ───────────────────────────

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const strength = getPasswordStrength(password)

  useEffect(() => {
    if (!token) {
      setError('Missing reset token. Please request a new password reset link.')
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!token) {
      setError('Missing reset token. Please request a new password reset link.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error?.message || 'Failed to reset password. The link may have expired.')
        return
      }

      // Store a toast message and redirect to login
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('toast', 'Password reset successfully. Please log in.')
      }

      router.push('/login')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Sabha<span className="text-brand-500">.</span>
          </Link>
          <h1 className="mt-4 text-xl font-semibold text-white">Set new password</h1>
          <p className="mt-2 text-zinc-400 text-sm">
            Choose a strong password for your account.
          </p>
        </div>

        {!token ? (
          <div className="text-center space-y-4">
            <p className="text-red-400 text-sm">
              This reset link is invalid or has expired.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block px-5 py-2.5 bg-brand-600 hover:bg-brand-500 rounded-xl text-sm font-semibold transition-colors"
            >
              Request new reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-brand-500 focus:outline-none transition-colors"
                placeholder="Minimum 8 characters"
                autoFocus
              />
              {/* Password strength meter */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          strength.score >= i ? strength.color : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    strength.score <= 1 ? 'text-red-400' :
                    strength.score <= 2 ? 'text-yellow-400' :
                    strength.score <= 3 ? 'text-blue-400' :
                    'text-emerald-400'
                  }`}>
                    {strength.label}
                    {strength.score <= 2 && ' — add uppercase letters, numbers, or symbols'}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Confirm password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl bg-zinc-900 border focus:outline-none transition-colors ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-zinc-800 focus:border-brand-500'
                }`}
                placeholder="Repeat your password"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm">{error}</p>
                {error.toLowerCase().includes('expired') && (
                  <Link href="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300 mt-1 inline-block">
                    Request a new link →
                  </Link>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password || password !== confirmPassword}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 rounded-xl font-semibold transition-colors"
            >
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
