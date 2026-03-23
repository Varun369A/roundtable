'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PackAgent {
  role: string
  model: string
  systemPrompt?: string
}

interface Pack {
  id: string
  name: string
  category: string
  icon: string
  description: string
  disclaimer?: string
  agents: PackAgent[]
  includedInPlan?: string
  creditsPerTask?: number
  isSubscribed: boolean
}

// ─── Sample use cases ─────────────────────────────────────────────────────────

const SAMPLE_USE_CASES: Record<string, string[]> = {
  legal: [
    'Review this employment contract for unfair terms',
    'Research SEBI regulations for crypto assets',
    'Draft an NDA for a software partnership',
  ],
  medical: [
    'Summarize latest clinical trials for Type 2 diabetes treatment',
    'Write patient education material for post-cardiac surgery care',
    'Create a systematic review outline for hypertension management',
  ],
  finance: [
    'Analyze Q3 2024 earnings report for Infosys',
    'Create a tax optimization strategy for ₹50L annual income',
    'Research SEBI compliance requirements for a new mutual fund',
  ],
  engineering: [
    'Review this microservices architecture for scale to 1M users',
    'Audit this authentication code for OWASP vulnerabilities',
    'Design a CI/CD pipeline for a multi-region deployment',
  ],
  hr: [
    'Create a performance review template for a 50-person engineering team',
    'Draft a remote work policy compliant with Indian labor law',
    'Write job descriptions for a senior data scientist role',
  ],
}

// ─── Category gradient colours ─────────────────────────────────────────────────

const CAT_GRADIENT: Record<string, string> = {
  legal:       'from-blue-50 via-blue-50/60 to-transparent',
  medical:     'from-red-50 via-red-50/60 to-transparent',
  finance:     'from-emerald-50 via-emerald-50/60 to-transparent',
  engineering: 'from-orange-50 via-orange-50/60 to-transparent',
  hr:          'from-pink-50 via-pink-50/60 to-transparent',
  content:     'from-purple-50 via-purple-50/60 to-transparent',
  default:     'from-indigo-50 via-indigo-50/60 to-transparent',
}

const MODEL_BADGE_COLORS = [
  'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'bg-amber-500/10 text-amber-600 border-amber-500/20',
]

// ─── Pack detail modal ────────────────────────────────────────────────────────

function PackDetailModal({
  pack,
  onClose,
  onToggle,
  toggling,
}: {
  pack: Pack
  onClose: () => void
  onToggle: (pack: Pack) => void
  toggling: boolean
}) {
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({})
  const useCases = SAMPLE_USE_CASES[pack.category?.toLowerCase()] || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{pack.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{pack.name}</h2>
              <span className="text-xs text-slate-400 capitalize">{pack.category}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors text-xl leading-none mt-1">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Description */}
          <p className="text-slate-700 text-sm leading-relaxed">{pack.description}</p>

          {/* Disclaimer */}
          {pack.disclaimer && (
            <div className="flex gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠️</span>
              <p className="text-amber-700 text-xs leading-relaxed">{pack.disclaimer}</p>
            </div>
          )}

          {/* Agents */}
          {pack.agents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Agent Roles</h3>
              <div className="space-y-2">
                {pack.agents.map((agent, idx) => (
                  <div key={idx} className="rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedAgents((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${MODEL_BADGE_COLORS[idx % MODEL_BADGE_COLORS.length]}`}>
                          {agent.model}
                        </span>
                        <span className="text-sm text-slate-900">{agent.role}</span>
                      </div>
                      {agent.systemPrompt && (
                        <span className="text-slate-400 text-xs">{expandedAgents[idx] ? '▲' : '▼'}</span>
                      )}
                    </button>
                    {expandedAgents[idx] && agent.systemPrompt && (
                      <div className="px-4 pb-3 border-t border-slate-100">
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed font-mono bg-slate-100 rounded-lg p-3 line-clamp-6">
                          {agent.systemPrompt}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample use cases */}
          {useCases.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Sample Use Cases</h3>
              <div className="space-y-2">
                {useCases.map((uc, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm text-slate-500">
                    <span className="text-indigo-600 font-bold flex-shrink-0 mt-0.5">→</span>
                    <span>{uc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subscribe CTA */}
          <div className="pt-2">
            {pack.includedInPlan ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                  Included in {pack.includedInPlan}
                </span>
                <button
                  onClick={() => onToggle(pack)}
                  disabled={toggling}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                    pack.isSubscribed
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {toggling ? 'Updating…' : pack.isSubscribed ? 'Unsubscribe' : 'Enable Pack'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  {pack.creditsPerTask ? `${pack.creditsPerTask} credits per task` : ''}
                </span>
                <div className="flex items-center gap-3">
                  {!pack.isSubscribed && (
                    <Link href="/pricing" className="text-xs text-indigo-600 hover:text-indigo-500 transition-colors">
                      Upgrade to Power →
                    </Link>
                  )}
                  <button
                    onClick={() => onToggle(pack)}
                    disabled={toggling}
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                      pack.isSubscribed
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {toggling ? 'Updating…' : pack.isSubscribed ? 'Unsubscribe' : 'Subscribe'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PacksPage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ packs: Pack[] }>('/api/v1/packs').then((res) => {
      if (res.success && res.data) setPacks(res.data.packs)
    }).finally(() => setLoading(false))
  }, [])

  const handleToggle = async (pack: Pack) => {
    setToggling(pack.id)
    try {
      const endpoint = pack.isSubscribed
        ? `/api/v1/packs/${pack.id}/unsubscribe`
        : `/api/v1/packs/${pack.id}/subscribe`
      const res = await apiFetch(endpoint, { method: 'POST' })
      if (res.success) {
        setPacks((prev) =>
          prev.map((p) => p.id === pack.id ? { ...p, isSubscribed: !p.isSubscribed } : p),
        )
        if (selectedPack?.id === pack.id) {
          setSelectedPack((p) => p ? { ...p, isSubscribed: !p.isSubscribed } : p)
        }
      }
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 sticky top-0 z-10 bg-white/95 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 text-sm transition-colors">← Dashboard</Link>
        <div className="h-4 w-px bg-slate-200" />
        <span className="font-semibold text-sm text-slate-900">Vertical AI Packs</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2 text-slate-900">Vertical AI Packs</h1>
          <p className="text-slate-500">Specialist AI configurations for your industry</p>
        </div>

        {/* Packs grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-56 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : packs.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <p className="text-3xl mb-2">📦</p>
            <p className="text-sm">No packs available yet — check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {packs.map((pack) => {
              const gradient = CAT_GRADIENT[pack.category?.toLowerCase()] || CAT_GRADIENT.default
              const isTogglingThis = toggling === pack.id
              return (
                <div
                  key={pack.id}
                  className="group relative rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 transition-all cursor-pointer"
                  onClick={() => setSelectedPack(pack)}
                >
                  {/* Gradient bg */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60`} />

                  <div className="relative z-10 p-5 flex flex-col gap-3 h-full">
                    {/* Icon + name */}
                    <div>
                      <span className="text-4xl block mb-2">{pack.icon}</span>
                      <h3 className="font-bold text-slate-900">{pack.name}</h3>
                      <span className="text-xs text-slate-400 capitalize">{pack.category}</span>
                    </div>

                    {/* Description */}
                    <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">{pack.description}</p>

                    {/* Agent model badges */}
                    {pack.agents.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {pack.agents.slice(0, 4).map((agent, idx) => (
                          <span
                            key={idx}
                            className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${MODEL_BADGE_COLORS[idx % MODEL_BADGE_COLORS.length]}`}
                          >
                            {agent.model}
                          </span>
                        ))}
                        {pack.agents.length > 4 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 text-slate-400">
                            +{pack.agents.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Plan / credits + subscribe */}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      {pack.includedInPlan ? (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Included in {pack.includedInPlan}
                        </span>
                      ) : pack.creditsPerTask ? (
                        <span className="text-[10px] text-slate-400">{pack.creditsPerTask} credits/task</span>
                      ) : (
                        <span />
                      )}

                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggle(pack) }}
                        disabled={isTogglingThis}
                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                          pack.isSubscribed
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        {isTogglingThis ? '…' : pack.isSubscribed ? 'Enabled ✓' : 'Subscribe'}
                      </button>
                    </div>

                    {/* Upgrade link if not in plan and not subscribed */}
                    {!pack.includedInPlan && !pack.isSubscribed && (
                      <Link
                        href="/pricing"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-indigo-600 hover:text-indigo-500 transition-colors"
                      >
                        Upgrade to Power to unlock →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Pack detail modal */}
      {selectedPack && (
        <PackDetailModal
          pack={selectedPack}
          onClose={() => setSelectedPack(null)}
          onToggle={handleToggle}
          toggling={toggling === selectedPack.id}
        />
      )}
    </div>
  )
}
