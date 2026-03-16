'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

type Step = 0 | 1 | 2 | 3

const STEPS = [
  {
    title: 'Welcome to Sabha',
    subtitle: 'Your AI roundtable is ready. Let's get you set up in 60 seconds.',
    emoji: '👋',
  },
  {
    title: 'What will you use Sabha for?',
    subtitle: 'We'll recommend AI teams tailored to your goals.',
    emoji: '🎯',
  },
  {
    title: 'Meet your AI team',
    subtitle: 'Sabha coordinates specialised AI models that collaborate on your tasks.',
    emoji: '🤝',
  },
  {
    title: 'You're ready!',
    subtitle: 'Create your first roundtable task and watch your AI team get to work.',
    emoji: '🚀',
  },
]

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

const AI_TEAM_PREVIEW = [
  { name: 'Claude', role: 'Strategist & Writer', color: 'from-orange-500 to-amber-400', icon: '🧠' },
  { name: 'GPT-4o', role: 'Research & Analysis', color: 'from-emerald-500 to-teal-400', icon: '🔍' },
  { name: 'Perplexity', role: 'Live Web Research', color: 'from-blue-500 to-indigo-400', icon: '🌐' },
  { name: 'Midjourney', role: 'Image Generation', color: 'from-purple-500 to-pink-400', icon: '🎨' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([])
  const [finishing, setFinishing] = useState(false)

  const toggleUseCase = (id: string) => {
    setSelectedUseCases((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    )
  }

  const handleFinish = async () => {
    setFinishing(true)
    try {
      // Save preferences and mark onboarding complete
      await apiFetch('/api/v1/auth/onboarding', {
        method: 'POST',
        body: JSON.stringify({ useCases: selectedUseCases }),
      })
    } catch {
      // Non-fatal — proceed anyway
    }
    router.push('/dashboard')
  }

  const canAdvance = step !== 1 || selectedUseCases.length > 0
  const current = STEPS[step]

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-10">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-indigo-500' : i < step ? 'w-4 bg-indigo-500/40' : 'w-4 bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">{current.emoji}</div>
            <h1 className="text-2xl font-bold text-white mb-2">{current.title}</h1>
            <p className="text-zinc-400 text-sm">{current.subtitle}</p>
          </div>

          {/* Step content */}
          {step === 0 && (
            <div className="space-y-3">
              {[
                { icon: '⚡', text: 'Multiple AIs collaborate in parallel or sequentially' },
                { icon: '🔒', text: 'Your tasks are private by default — no one else can see them' },
                { icon: '🎯', text: 'Pre-built templates for every use case' },
                { icon: '🌐', text: 'Supports 10+ languages including Hindi, Tamil, and more' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl">
                  <span className="text-xl">{icon}</span>
                  <p className="text-sm text-zinc-300">{text}</p>
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-2">
              {USE_CASES.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => toggleUseCase(id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-all ${
                    selectedUseCases.includes(id)
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                      : 'bg-white/3 border-white/8 text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{icon}</span>
                  <span className="font-medium">{label}</span>
                  {selectedUseCases.includes(id) && (
                    <span className="ml-auto text-indigo-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {AI_TEAM_PREVIEW.map(({ name, role, color, icon }) => (
                <div key={name} className="flex items-center gap-4 p-4 bg-white/3 rounded-xl">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-lg flex-shrink-0`}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{name}</p>
                    <p className="text-xs text-zinc-500">{role}</p>
                  </div>
                  <div className="ml-auto">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                </div>
              ))}
              <p className="text-xs text-center text-zinc-600 mt-2">+ 9 more AI models available</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {[
                { label: 'Explore Templates', href: '/templates', icon: '📋', desc: 'Pre-built AI teams for your use case' },
                { label: 'Create a Task', href: '/dashboard', icon: '⚡', desc: 'Start a roundtable now' },
                { label: 'Workspace Settings', href: '/workspace/settings', icon: '⚙️', desc: 'Invite teammates (Power plan)' },
              ].map(({ label, href, icon, desc }) => (
                <a
                  key={label}
                  href={href}
                  className="flex items-center gap-3 p-4 bg-white/3 hover:bg-white/6 border border-white/5 rounded-xl transition-colors group"
                >
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">{label}</p>
                    <p className="text-xs text-zinc-600">{desc}</p>
                  </div>
                  <span className="ml-auto text-zinc-700 group-hover:text-zinc-400 transition-colors">→</span>
                </a>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={!canAdvance}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-xl font-medium transition-colors"
              >
                {step === 1 && selectedUseCases.length === 0 ? 'Select at least one →' : 'Next →'}
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={finishing}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-xl font-medium transition-colors"
              >
                {finishing ? 'Getting ready…' : 'Go to Dashboard →'}
              </button>
            )}
          </div>
        </div>

        {/* Skip */}
        {step < 3 && (
          <p className="text-center mt-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
            >
              Skip onboarding
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
