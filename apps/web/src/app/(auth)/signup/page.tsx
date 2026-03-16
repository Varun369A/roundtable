'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    betaCode: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [validatingCode, setValidatingCode] = useState(false)
  const [codeStatus, setCodeStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')

  // Pre-fill beta code from URL (?code=SABHA-XXXX)
  useEffect(() => {
    const code = searchParams.get('code')
    if (code) setForm((f) => ({ ...f, betaCode: code.toUpperCase() }))
  }, [searchParams])

  // Validate beta code on blur
  const handleCodeBlur = async () => {
    if (!form.betaCode) return
    setValidatingCode(true)
    try {
      const res = await fetch('/api/v1/beta/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: form.betaCode }),
      })
      const data = await res.json()
      if (data.success) {
        setCodeStatus(data.data.valid ? 'valid' : 'invalid')
      }
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
      const res = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          setError('An invite code is required to join the beta.')
        } else if (code === 'INVALID_BETA_CODE' || code === 'EXPIRED_BETA_CODE') {
          setError(data.error.message)
          setCodeStatus('invalid')
        } else {
          setError(data.error?.message || 'Something went wrong')
        }
        return
      }

      // Store tokens
      localStorage.setItem('accessToken', data.data.tokens.accessToken)
      localStorage.setItem('refreshToken', data.data.tokens.refreshToken)

      // New users go through onboarding
      router.push('/onboarding')
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
          <p className="mt-3 text-zinc-400">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Full name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-brand-500 focus:outline-none transition-colors"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-brand-500 focus:outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-brand-500 focus:outline-none transition-colors"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
            />
          </div>

          {/* Beta invite code */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">
              Beta Invite Code
              <span className="text-zinc-600 ml-1">(required during early access)</span>
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
                className={`w-full px-4 py-3 rounded-xl bg-zinc-900 border focus:outline-none transition-colors font-mono tracking-wide ${
                  codeStatus === 'valid'
                    ? 'border-emerald-500 text-emerald-300'
                    : codeStatus === 'invalid'
                      ? 'border-red-500 text-red-300'
                      : 'border-zinc-800 focus:border-brand-500'
                }`}
                placeholder="SABHA-XXXXXXXX"
              />
              {validatingCode && (
                <div className="absolute right-3 top-3.5 w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              )}
              {codeStatus === 'valid' && !validatingCode && (
                <span className="absolute right-3 top-3.5 text-emerald-400 text-sm">✓ Valid</span>
              )}
              {codeStatus === 'invalid' && !validatingCode && (
                <span className="absolute right-3 top-3.5 text-red-400 text-sm">✗</span>
              )}
            </div>
            {codeStatus === 'invalid' && (
              <p className="text-red-400 text-xs mt-1">This code is invalid or already used.</p>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 rounded-xl font-semibold transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-zinc-600 text-xs">
          Don't have an invite code?{' '}
          <a href="https://sabhaai.com/waitlist" className="text-brand-400 hover:text-brand-300">
            Join the waitlist
          </a>
        </p>

        <p className="mt-4 text-center text-zinc-500 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-400 hover:text-brand-300">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
