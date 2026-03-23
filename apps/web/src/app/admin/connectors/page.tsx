'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface ConnectorStatus {
  model: string
  isAvailable: boolean
  stats7d: {
    calls: number
    totalCostUsd: number
    avgLatencyMs: number
  } | null
}

const MODEL_LABELS: Record<string, string> = {
  'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
  'claude-3-opus':     'Claude 3 Opus',
  'gpt-4o':            'GPT-4o',
  'gpt-4-turbo':       'GPT-4 Turbo',
  'gemini-pro':        'Gemini 1.5 Pro',
  'perplexity-sonar':  'Perplexity Sonar',
  'dalle-3':           'DALL-E 3',
  'midjourney-v6':     'Midjourney v6',
  'stability-xl':      'Stability XL',
  'elevenlabs':        'ElevenLabs',
  'runway-gen3':       'Runway Gen-3',
  'sarvam-1':          'Sarvam AI',
  'gamma':             'Gamma',
}

export default function AdminConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([])
  const [summary, setSummary]       = useState<{ total: number; available: number; unavailable: number } | null>(null)
  const [pinging, setPinging]       = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)

  async function load() {
    const res = await apiFetch<{ connectors: ConnectorStatus[]; summary: typeof summary }>(
      '/api/v1/admin/connectors'
    )
    if (res.success && res.data) {
      setConnectors(res.data.connectors)
      setSummary(res.data.summary)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function ping(model: string) {
    setPinging(model)
    await apiFetch<{ available: boolean; latencyMs: number }>(
      `/api/v1/admin/connectors/${encodeURIComponent(model)}/health`,
      { method: 'POST' }
    )
    await load()
    setPinging(null)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">AI Connector Health</h1>
        {summary && (
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">{summary.available} available</span>
            <span className="text-red-600">{summary.unavailable} need API key</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connectors.map((c) => (
            <div
              key={c.model}
              className={`rounded-xl border p-5 ${
                c.isAvailable
                  ? 'border-slate-200 bg-white'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-sm">
                    {MODEL_LABELS[c.model] || c.model}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">{c.model}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${c.isAvailable ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className={`text-xs ${c.isAvailable ? 'text-green-600' : 'text-red-500'}`}>
                    {c.isAvailable ? 'Live' : 'No key'}
                  </span>
                </div>
              </div>

              {c.stats7d ? (
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div>
                    <p className="text-slate-400">Calls (7d)</p>
                    <p className="font-mono font-medium">{c.stats7d.calls.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Cost (7d)</p>
                    <p className="font-mono font-medium">${c.stats7d.totalCostUsd.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Avg latency</p>
                    <p className="font-mono font-medium">{c.stats7d.avgLatencyMs}ms</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mb-3">No activity in last 7 days</p>
              )}

              <button
                onClick={() => ping(c.model)}
                disabled={pinging === c.model}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
              >
                {pinging === c.model ? 'Pinging…' : 'Ping →'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
