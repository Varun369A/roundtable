'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface ModelDetail {
  model: string
  displayName: string
  provider: string
  description: string
  longDescription: string
  capabilities: string[]
  categories: string[]
  availableOnPlans: string[]
  isAvailable: boolean
  logoColor: string
  inputCostPer1M: number
  outputCostPer1M: number
  useCases: string[]
  limitations: string[]
  stats: { avgLatencyMs: number; successRate: number }
  planAccess: Array<{ planId: string; planName: string; hasAccess: boolean }>
}

export default function ModelDetailPage({ params }: { params: Promise<{ model: string }> }) {
  const { model: modelSlug } = use(params)
  const router = useRouter()
  const [model, setModel]     = useState<ModelDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ model: ModelDetail }>(`/api/v1/marketplace/models/${encodeURIComponent(modelSlug)}`)
      .then((res) => {
        if (!res.success) { router.push('/marketplace'); return }
        // The API returns the data flat (not nested under 'model')
        setModel(res.data as unknown as ModelDetail)
      })
      .finally(() => setLoading(false))
  }, [modelSlug, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    )
  }

  if (!model) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 sticky top-0 z-10 bg-white/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/marketplace" className="text-slate-400 hover:text-slate-700 text-sm transition-colors">
            ← Marketplace
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <span className="font-medium text-sm" style={{ color: model.logoColor }}>
            {model.displayName}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left — main info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-sm text-slate-400 mb-1">{model.provider}</p>
                  <h1 className="text-3xl font-bold" style={{ color: model.logoColor }}>
                    {model.displayName}
                  </h1>
                </div>
                {model.isAvailable ? (
                  <span className="flex items-center gap-1.5 text-sm text-green-600 shrink-0 mt-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Available
                  </span>
                ) : (
                  <span className="text-sm text-slate-400 shrink-0 mt-2">Needs API key</span>
                )}
              </div>
              <p className="text-slate-700 text-lg leading-relaxed">{model.description}</p>
            </div>

            {/* Long description */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <p className="text-slate-700 leading-relaxed">{model.longDescription}</p>
            </div>

            {/* Capabilities */}
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Capabilities</h3>
              <div className="flex flex-wrap gap-2">
                {model.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: model.logoColor + '15', color: model.logoColor }}
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Use cases */}
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Best for</h3>
              <ul className="space-y-2">
                {model.useCases.map((uc) => (
                  <li key={uc} className="flex items-center gap-2 text-sm text-slate-700">
                    <span style={{ color: model.logoColor }}>✓</span>
                    {uc}
                  </li>
                ))}
              </ul>
            </div>

            {/* Limitations */}
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Limitations</h3>
              <ul className="space-y-2">
                {model.limitations.map((lim) => (
                  <li key={lim} className="flex items-center gap-2 text-sm text-slate-400">
                    <span>—</span>
                    {lim}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right — sidebar */}
          <div className="space-y-4">
            {/* Plan access */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold mb-3 text-sm text-slate-900">Plan access</h3>
              <div className="space-y-2">
                {model.planAccess.map((p) => (
                  <div key={p.planId} className="flex items-center justify-between">
                    <span className="text-sm capitalize text-slate-500">{p.planName}</span>
                    {p.hasAccess ? (
                      <span className="text-green-600 text-sm">✓</span>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            {(model.inputCostPer1M > 0 || model.outputCostPer1M > 0) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold mb-3 text-sm text-slate-900">API pricing</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Input</span>
                    <span className="font-mono text-slate-700">${model.inputCostPer1M}/1M tokens</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Output</span>
                    <span className="font-mono text-slate-700">${model.outputCostPer1M}/1M tokens</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3">Arivarangam absorbs API costs within plan limits.</p>
              </div>
            )}

            {/* CTA */}
            <Link
              href="/dashboard"
              className="block w-full py-3 text-center rounded-xl font-semibold text-sm transition-all hover:scale-105"
              style={{ backgroundColor: model.logoColor + '20', color: model.logoColor, border: `1px solid ${model.logoColor}40` }}
            >
              Use {model.displayName} →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
