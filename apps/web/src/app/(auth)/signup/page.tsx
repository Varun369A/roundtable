'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500']
  const labels = ['Weak', 'Fair', 'Good', 'Strong']

  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score - 1] : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-1">{score > 0 ? labels[score - 1] : ''} password</p>
    </div>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState({ name: '', email: '', password: '', betaCode: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [codeStatus, setCodeStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [validatingCode, setValidatingCode] = useState(false)
  const hasBetaCode = !!searchParams.get('code') || !!form.betaCode

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) setForm((f) => ({ ...f, betaCode: code.toUpperCase() }))
  }, [searchParams])

  const handleCodeBlur = async () => {
    if (!form.betaCode) return
    setValidatingCode(true)
    try {
      const res = await fetch(`${API_URL}/api/v1/beta/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.betaCode }),
      })
      const data = await res.json()
      setCodeStatus(data.success && data.data?.valid ? 'valid' : 'invalid')
    } catch {
      setCodeStatus('idle')
    } finally {
      setValidatingCode(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          betaCode: form.betaCode || undefined,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        const code = data.error?.code
        if (code === 'BETA_REQUIRED') {
          setError('Early access requires an invite code. Join the waitlist for an invite.')
        } else if (code === 'INVALID_BETA_CODE' || code === 'EXPIRED_BETA_CODE') {
          setError('This invite code is invalid or has already been used.')
          setCodeStatus('invalid')
        } else {
          setError(data.error?.message || 'Something went wrong. Please try again.')
        }
        return
      }

      localStorage.setItem('accessToken', data.data.tokens.accessToken)
      localStorage.setItem('refreshToken', data.data.tokens.refreshToken)
      router.push('/onboarding')
    } catch {
      setError('Unable to connect. Please check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-600 flex-col justify-between p-12">
        <Link href="/" className="text-white text-xl font-bold tracking-tight">
          Arivarangam<span className="text-brand-300">.</span>
        </Link>

        <div>
          <h2 className="text-4xl font-bold text-white leading-snug mb-4">
            Start orchestrating AI today.
          </h2>
          <p className="text-brand-200 text-lg leading-relaxed mb-10">
            Join teams using Arivarangam to automate complex work with multiple AI models working together.
          </p>

          <div className="space-y-4">
            {[
              { icon: '🚀', title: 'Up and running in minutes', desc: 'No infrastructure to manage' },
              { icon: '🤖', title: '10+ AI models connected', desc: 'Claude, GPT-4, Gemini, Perplexity and more' },
              { icon: '💳', title: 'Free to start', desc: 'No credit card required for early access' },
            ].map((f) => (
              <div key={f.title} className="flex gap-3 items-start">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="text-white font-medium text-sm">{f.title}</p>
                  <p className="text-brand-300 text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-brand-400 text-sm">© 2025 Arivarangam. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="text-2xl font-bold tracking-tight text-slate-900">
              Arivarangam<span className="text-brand-600">.</span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
              <p className="mt-1 text-slate-500 text-sm">
                {hasBetaCode ? 'You have an invite code — fill in your details below.' : 'Get started with early access.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition text-sm"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Work email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition text-sm"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition text-sm pr-10"
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-xs"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <PasswordStrength password={form.password} />
              </div>

              {/* Invite code — shown always but optional */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Invite code
                  <span className="text-slate-400 font-normal ml-1.5">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.betaCode}
                    onChange={(e) => {
                      setForm({ ...form, betaCode: e.target.value.toUpperCase() })
                      setCodeStatus('idle')
                    }}
                    onBlur={handleCodeBlur}
                    className={`w-full px-3.5 py-2.5 rounded-lg bg-white border text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition text-sm font-mono tracking-wide ${
                      codeStatus === 'valid'
                        ? 'border-emerald-400 focus:ring-emerald-500/20'
                        : codeStatus === 'invalid'
                          ? 'border-red-400 focus:ring-red-500/20'
                          : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500/20'
                    }`}
                    placeholder="ARIVARANGAM-XXXXXXXX"
                  />
                  {validatingCode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-slate-300 border-t-brand-500 rounded-full animate-spin" />
                  )}
                  {codeStatus === 'valid' && !validatingCode && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 text-xs font-medium">✓ Valid</span>
                  )}
                  {codeStatus === 'invalid' && !validatingCode && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 text-xs">Invalid</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Have an invite? Enter it above to get full access.{' '}
                  <Link href="/waitlist" className="text-brand-600 hover:text-brand-700 font-medium">
                    Request invite →
                  </Link>
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <span className="text-red-500 text-sm shrink-0 mt-0.5">⚠</span>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg font-semibold text-white text-sm transition-colors shadow-sm mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : 'Create account'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-slate-500 text-sm">
                Already have an account?{' '}
                <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-slate-400 text-xs">
            By creating an account you agree to our{' '}
            <Link href="/terms" className="underline hover:text-slate-600">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
