'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

interface ContinueBuildingProps {
  taskId: string
  originalGoal: string
}

const SUGGESTIONS = [
  'Add user authentication and login',
  'Add a payment integration',
  'Make it mobile responsive',
  'Add dark mode support',
  'Write unit tests for all functions',
  'Add error handling and loading states',
  'Deploy to production',
  'Add an admin dashboard',
]

export function ContinueBuilding({ taskId, originalGoal }: ContinueBuildingProps) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const MAX_CHARS = 2000
  const charsLeft = MAX_CHARS - message.length
  const canSubmit = message.trim().length >= 5 && !loading

  async function handleContinue() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)

    try {
      const res = await apiFetch(`/api/v1/tasks/${taskId}/continue`, {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() }),
      })

      if (!res.success) {
        setError(res.error?.message || 'Failed to start continuation task.')
        return
      }

      // Redirect to new task page
      router.push(`/roundtable/${res.data.task.id}`)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
      e.preventDefault()
      handleContinue()
    }
  }

  function useSuggestion(text: string) {
    setMessage(text)
    setExpanded(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="border-t border-slate-200 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-4">

        {/* Header */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between group mb-3"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-sm font-semibold text-slate-800">Continue Building</span>
            <span className="text-xs text-slate-500">Tell Arivarangam what to add or change</span>
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div className="space-y-3">

            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => useSuggestion(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Text area */}
            <div className="relative">
              <textarea
                ref={inputRef}
                value={message}
                onChange={e => {
                  setError(null)
                  setMessage(e.target.value.slice(0, MAX_CHARS))
                }}
                onKeyDown={handleKeyDown}
                disabled={loading}
                rows={3}
                placeholder="Describe what you want to add, change, or fix… (e.g. 'Add JWT authentication with refresh tokens')"
                className="w-full px-4 py-3 pr-16 rounded-xl text-sm border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 resize-none outline-none transition-colors text-slate-900 placeholder-slate-400 disabled:bg-slate-50"
              />
              <span className={`absolute bottom-3 right-3 text-xs tabular-nums pointer-events-none ${charsLeft < 100 ? 'text-amber-500' : 'text-slate-300'}`}>
                {charsLeft}
              </span>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Context note + submit */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Full context from this task will be passed to the new roundtable
              </p>
              <button
                onClick={handleContinue}
                disabled={!canSubmit}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  canSubmit
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                    Continue Building
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Collapsed preview of what can be done */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center shrink-0 transition-colors">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-slate-700 group-hover:text-indigo-700">Add more features</p>
              <p className="text-xs text-slate-400">Authentication, payments, tests, deployment…</p>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}
