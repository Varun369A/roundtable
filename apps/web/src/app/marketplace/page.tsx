'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface ModelData {
  model: string
  displayName: string
  provider: string
  description: string
  capabilities: string[]
  categories: string[]
  availableOnPlans: string[]
  isAvailable: boolean
  logoColor: string
  inputCostPer1M: number
  outputCostPer1M: number
  useCases: string[]
}

interface Category {
  id: string
  label: string
  emoji: string
}

interface MarketplaceStats {
  totalModels: number
  availableModels: number
  sabhaProPriceInr: number
  retailTotalInr: number
  savingsInr: number
  savingsPercent: number
}

const PLAN_COLORS: Record<string, string> = {
  free:       'bg-slate-100 text-slate-500',
  starter:    'bg-blue-500/10 text-blue-600',
  pro:        'bg-brand-500/10 text-brand-600',
  power:      'bg-yellow-500/10 text-yellow-600',
  enterprise: 'bg-green-500/10 text-green-600',
}

export default function MarketplacePage() {
  const [models, setModels]         = useState<ModelData[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stats, setStats]           = useState<MarketplaceStats | null>(null)
  const [loading, setLoading]       = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [search, setSearch]         = useState('')

  useEffect(() => {
    Promise.all([
      apiFetch<{ models: ModelData[] }>('/api/v1/marketplace/models'),
      apiFetch<{ categories: Category[] }>('/api/v1/marketplace/categories'),
      apiFetch<MarketplaceStats>('/api/v1/marketplace/stats'),
    ]).then(([modelsRes, catRes, statsRes]) => {
      if (modelsRes.success && modelsRes.data) setModels(modelsRes.data.models)
      if (catRes.success && catRes.data) setCategories(catRes.data.categories)
      if (statsRes.success && statsRes.data) setStats(statsRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = models.filter((m) => {
    const matchCat = activeCategory === 'all' || m.categories.includes(activeCategory)
    const matchSearch = !search ||
      m.displayName.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase()) ||
      m.provider.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 text-sm transition-colors">
              ← Dashboard
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <span className="font-semibold text-slate-900">AI Marketplace</span>
          </div>
          <Link
            href="/dashboard"
            className="text-sm px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors"
          >
            Start a task
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Value prop banner */}
        {stats && (
          <div className="mb-10 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold mb-1 text-slate-900">
                  {stats.totalModels} AIs. One subscription.
                </h1>
                <p className="text-slate-500">
                  Buying these separately costs{' '}
                  <span className="text-slate-900 font-semibold line-through">
                    ₹{stats.retailTotalInr.toLocaleString('en-IN')}/month
                  </span>
                  {' '}— Arivarangam Pro is{' '}
                  <span className="text-brand-600 font-bold text-lg">
                    ₹1,299/month
                  </span>
                </p>
              </div>
              <div className="text-center shrink-0">
                <div className="text-4xl font-bold text-green-600">
                  {stats.savingsPercent}%
                </div>
                <div className="text-slate-400 text-sm">cheaper than separate</div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search AIs by name, capability, or use case…"
            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-brand-500 focus:outline-none transition-colors text-sm text-slate-900 placeholder-slate-400"
          />
        </div>

        {/* Category filters */}
        <div className="flex gap-2 flex-wrap mb-8">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
            }`}
          >
            All ({models.length})
          </button>
          {categories.map((cat) => {
            const count = models.filter((m) => m.categories.includes(cat.id)).length
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                <span className="text-xs opacity-60">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Model grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            No AIs found for this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((model) => (
              <ModelCard key={model.model} model={model} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ModelCard({ model }: { model: ModelData }) {
  const lowestPlan = model.availableOnPlans[0]

  return (
    <Link
      href={`/marketplace/${model.model}`}
      className="group block rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all p-5"
    >
      {/* Provider + availability */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">{model.provider}</span>
        <div className="flex items-center gap-2">
          {model.isAvailable ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Live
            </span>
          ) : (
            <span className="text-xs text-slate-400">API key needed</span>
          )}
        </div>
      </div>

      {/* Name */}
      <h3
        className="font-bold text-lg mb-1 group-hover:underline underline-offset-2"
        style={{ color: model.logoColor }}
      >
        {model.displayName}
      </h3>

      {/* Description */}
      <p className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-2">
        {model.description}
      </p>

      {/* Capability tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {model.capabilities.slice(0, 4).map((cap) => (
          <span
            key={cap}
            className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500"
          >
            {cap}
          </span>
        ))}
        {model.capabilities.length > 4 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
            +{model.capabilities.length - 4}
          </span>
        )}
      </div>

      {/* Plan access */}
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PLAN_COLORS[lowestPlan] || PLAN_COLORS.free}`}>
          From {lowestPlan}
        </span>
        <span className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
          View details →
        </span>
      </div>
    </Link>
  )
}
