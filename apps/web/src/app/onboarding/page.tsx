'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

type Step = 0 | 1 | 2

const USE_CASES = [
  { id: 'development', label: 'Software Development', icon: '💻' },
  { id: 'design', label: 'Design & Brand', icon: '🎨' },
  { id: 'content', label: 'Content & Writing', icon: '✍️' },
  { id: 'marketing', label: 'Marketing', icon: '📣' },
  { id: 'learning', label: 'Learning & Research', icon: '📚' },
  { id: 'business', label: 'Business & Strategy', icon: '📊' },
  { id: 'personal', label: 'Personal Projects', icon: '✨' },
  { id: 'other', label: 'Something else', icon: '💡' },
]

const EXAMPLE_PROMPTS = [
  'Create a go-to-market strategy for my SaaS product',
  'Write a blog post about sustainable fashion trends',
  'Design a social media campaign for our product launch',
  'Analyse the competitive landscape for my startup idea',
  'Build a marketing plan for a local restaurant',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([])
  const [goal, setGoal] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const toggleUseCase = (id: string) => {
    setSelectedUseCases((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    )
  }

  async function savePreferences() {
    try {
      await apiFetch('/api/v1/auth/onboarding', {
        method: 'POST',
        body: JSON.stringify({ useCases: selectedUseCases }),
      })
    } catch {
      // Non-fatal
    }
  }

  async function handleLaunchTask(e: React.FormEvent) {
    e.preventDefault()
    const goalText = goal.trim()
    if (!goalText) return

    setCreating(true)
    setCreateError('')

    // Save preferences in background
    savePreferences()

    try {
      const data = await apiFetch('/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({ goal: goalText, visibility: 'private' }),
      })

      if (data.success) {
        router.push(`/roundtable/${(data.data as any).task.id}`)
      } else {
        setCreateError(data.error?.message || 'Failed to create task')
        setCreating(false)
      }
    } catch {
      setCreateError('Network error — please try again')
      setCreating(false)
    }
  }

  function handleSkipToDashboard() {
    savePreferences()
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-10">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-indigo-600' : i < step ? 'w-4 bg-indigo-300' : 'w-4 bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Step 0 — Welcome */}
        {step === 0 && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">👋</div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome to Arivarangam</h1>
              <p className="text-slate-500 text-sm">
                Your AI roundtable is ready. Multiple AIs collaborate on your tasks in parallel —
                let's get you to your first result in seconds.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {[
                { icon: '⚡', text: 'Claude, GPT-4o, Perplexity and 13 more AIs working together' },
                { icon: '🔒', text: 'Your tasks are private by default — no one else can see them' },
                { icon: '🎯', text: 'Pre-built templates for marketing, coding, design and more' },
                { icon: '🌐', text: 'Supports Hindi, Tamil, Bengali, and 10+ other languages' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-xl flex-shrink-0">{icon}</span>
                  <p className="text-sm text-slate-700">{text}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl font-semibold transition-colors"
            >
              Let's go →
            </button>
          </div>
        )}

        {/* Step 1 — Use case (skippable) */}
        {step === 1 && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🎯</div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">What will you use Arivarangam for?</h1>
              <p className="text-slate-500 text-sm">We'll surface relevant templates. Pick as many as you like.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-8">
              {USE_CASES.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => toggleUseCase(id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-all ${
                    selectedUseCases.includes(id)
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>{icon}</span>
                  <span className="font-medium">{label}</span>
                  {selectedUseCases.includes(id) && (
                    <span className="ml-auto text-indigo-600">✓</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => setStep(0)}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl font-semibold transition-colors"
              >
                {selectedUseCases.length > 0 ? 'Next →' : 'Skip →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — First task (value moment) */}
        {step === 2 && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🚀</div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Start your first Roundtable</h1>
              <p className="text-slate-500 text-sm">
                Describe what you want to accomplish — Arivarangam will assemble an AI team for it.
              </p>
            </div>

            <form onSubmit={handleLaunchTask}>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-indigo-400 focus:outline-none transition-colors text-slate-900 placeholder-slate-400 resize-none text-sm mb-3"
                placeholder="Create a go-to-market strategy for my SaaS product…"
                rows={4}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && goal.trim()) {
                    e.preventDefault()
                    handleLaunchTask(e as unknown as React.FormEvent)
                  }
                }}
              />

              {/* Example prompts */}
              {!goal && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setGoal(p)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all text-left"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {createError && (
                <p className="text-red-500 text-xs mb-3">{createError}</p>
              )}

              <div className="flex justify-between items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-sm text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={creating || !goal.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm rounded-xl font-semibold transition-all active:scale-95"
                >
                  {creating ? 'Starting your Roundtable…' : 'Start Roundtable →'}
                </button>
              </div>

              <p className="text-xs text-slate-400 text-center mt-3">
                Ctrl+Enter to submit
              </p>
            </form>
          </div>
        )}

        {/* Skip to dashboard */}
        <p className="text-center mt-4">
          <button
            onClick={handleSkipToDashboard}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip and go to dashboard
          </button>
        </p>
      </div>
    </div>
  )
}
