'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface ArivarangamStatus {
  status: 'LEARNING' | 'READY' | 'ENABLED' | 'DISABLED'
  knowledgeCount: number
  readyThreshold: number
  progressPercent: number
  enabledAt?: string
  lastLearnedAt?: string
  categoryBreakdown: Array<{ category: string; count: number }>
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  LEARNING: { label: 'Learning silently', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200',  dot: 'bg-yellow-500' },
  READY:    { label: 'Ready to enable',   color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',      dot: 'bg-blue-500 animate-pulse' },
  ENABLED:  { label: 'Active',            color: 'text-green-600',  bg: 'bg-green-50 border-green-200',    dot: 'bg-green-500 animate-pulse' },
  DISABLED: { label: 'Disabled',          color: 'text-slate-500',  bg: 'bg-slate-100 border-slate-200',   dot: 'bg-slate-400' },
}

export default function ArivarangamAIAdminPage() {
  const [status, setStatus]           = useState<ArivarangamStatus | null>(null)
  const [loading, setLoading]         = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  async function load() {
    const res = await apiFetch<{ data: ArivarangamStatus }>('/api/v1/admin/sabha-ai/status')
    if (res.success && res.data) setStatus((res.data as any).data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggle() {
    if (!status) return
    setActionLoading(true)
    const endpoint = status.status === 'ENABLED'
      ? '/api/v1/admin/sabha-ai/disable'
      : '/api/v1/admin/sabha-ai/enable'
    await apiFetch(endpoint, { method: 'POST' })
    await load()
    setActionLoading(false)
  }

  if (loading) {
    return <div className="p-8 text-slate-400 text-sm">Loading Arivarangam status…</div>
  }

  if (!status) {
    return <div className="p-8 text-red-500 text-sm">Failed to load status</div>
  }

  const cfg = STATUS_CONFIG[status.status] || STATUS_CONFIG.DISABLED
  const canToggle = ['READY', 'ENABLED', 'DISABLED'].includes(status.status)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Arivarangam 🧠</h1>
        <p className="text-slate-500 text-sm">
          Self-learning AI that absorbs knowledge from every task on the platform and provides
          culturally aware, Arivarangam-specific responses.
        </p>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl border p-6 mb-6 ${cfg.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${cfg.dot}`} />
            <div>
              <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
              {status.enabledAt && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Enabled {new Date(status.enabledAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          {canToggle && (
            <button
              onClick={toggle}
              disabled={actionLoading}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                status.status === 'ENABLED'
                  ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                  : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
              }`}
            >
              {actionLoading ? '…' : status.status === 'ENABLED' ? 'Disable Arivarangam' : 'Enable Arivarangam'}
            </button>
          )}
        </div>
      </div>

      {/* Learning progress */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Learning Progress</h2>
          <span className="text-xs text-slate-400">
            {status.knowledgeCount} / {status.readyThreshold} examples
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
            style={{ width: `${status.progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-slate-400">
          {status.status === 'LEARNING'
            ? `Arivarangam is silently observing tasks. ${Math.max(0, status.readyThreshold - status.knowledgeCount)} more high-quality examples needed.`
            : status.status === 'READY'
            ? 'Arivarangam has accumulated enough knowledge. Enable it above to activate.'
            : 'Arivarangam is active and continues learning from every new task.'}
        </p>
        {status.lastLearnedAt && (
          <p className="text-xs text-slate-400 mt-1">
            Last example: {new Date(status.lastLearnedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Category breakdown */}
      {status.categoryBreakdown.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Knowledge by Category</h2>
          <div className="space-y-2">
            {status.categoryBreakdown.map((c) => {
              const maxCount = status.categoryBreakdown[0]?.count || 1
              const pct = Math.round((c.count / maxCount) * 100)
              return (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-28 shrink-0 capitalize">
                    {c.category.replace('_', ' ')}
                  </span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-8 text-right">{c.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl bg-slate-100 border border-slate-200 p-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          Arivarangam observes high-quality outputs (500+ chars, structured content) from all AI models on the
          platform and stores them as knowledge examples. During learning, it stays completely silent and doesn't
          affect task routing. Once enabled, it handles text-based tasks — research, strategy, copywriting — using
          its accumulated knowledge as few-shot context, providing more Arivarangam-aware, contextually rich responses.
          It uses Claude 3.5 Sonnet as its backbone, enriched with platform knowledge.
        </p>
      </div>
    </div>
  )
}
