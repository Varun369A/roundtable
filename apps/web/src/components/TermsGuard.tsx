'use client'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

export function TermsGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'accepted' | 'pending'>('loading')
  const [terms, setTerms] = useState<{ content: string; version: string; effectiveAt: string } | null>(null)
  const [checked, setChecked] = useState(false)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    checkTerms()
  }, [])

  async function checkTerms() {
    try {
      const res = await apiFetch('/api/v1/terms/status')
      if (res?.data?.accepted) {
        setStatus('accepted')
      } else {
        setStatus('pending')
        const termsRes = await apiFetch('/api/v1/terms/latest')
        if (termsRes?.data) setTerms(termsRes.data as { content: string; version: string; effectiveAt: string })
      }
    } catch {
      setStatus('accepted') // Fail open if auth not set up yet
    }
  }

  async function handleAccept() {
    if (!checked || accepting) return
    setAccepting(true)
    try {
      await apiFetch('/api/v1/terms/accept', { method: 'POST' })
      setStatus('accepted')
    } catch (e) {
      console.error(e)
    } finally {
      setAccepting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  if (status === 'accepted') {
    return <>{children}</>
  }

  // Terms acceptance modal
  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-700 flex-shrink-0">
          <h1 className="text-xl font-bold text-white">Sabha Terms of Service</h1>
          {terms && (
            <p className="text-gray-400 text-sm mt-1">
              Version {terms.version} · Effective {new Date(terms.effectiveAt).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {terms ? (
            <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">
              {terms.content}
            </pre>
          ) : (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-700 flex-shrink-0 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-gray-300 text-sm">
              I have read and agree to Sabha&apos;s Terms of Service and Privacy Policy
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!checked || accepting}
            className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {accepting ? 'Accepting...' : 'Accept and Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
