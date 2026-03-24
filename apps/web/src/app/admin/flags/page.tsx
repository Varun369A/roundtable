'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface Flag {
  key: string
  enabled: boolean
  description: string | null
  config: { allowlist?: string[]; rolloutPercent?: number } | null
  updatedAt: string
}

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/api/v1/admin/flags').then((res) => {
      if (res.success) setFlags((res.data as any) ?? [])
    }).finally(() => setLoading(false))
  }, [])

  async function toggle(key: string, current: boolean) {
    setToggling(key)
    const res = await apiFetch(`/api/v1/admin/flags/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !current }),
    })
    if (res.success) {
      setFlags((prev) => prev.map((f) => f.key === key ? { ...f, enabled: !current } : f))
    }
    setToggling(null)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Feature Flags</h1>
        <p className="text-slate-500 text-sm mt-1">Toggle platform features on or off.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
          </div>
        ) : flags.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12">No feature flags configured</p>
        ) : (
          flags.map((flag) => (
            <div key={flag.key} className="flex items-center justify-between px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 font-mono">{flag.key}</p>
                {flag.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{flag.description}</p>
                )}
                {flag.config?.rolloutPercent !== undefined && (
                  <p className="text-xs text-indigo-500 mt-0.5">Rollout: {flag.config.rolloutPercent}%</p>
                )}
              </div>
              <button
                onClick={() => toggle(flag.key, flag.enabled)}
                disabled={toggling === flag.key}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  flag.enabled ? 'bg-indigo-600' : 'bg-slate-200'
                } ${toggling === flag.key ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                    flag.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
