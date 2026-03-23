'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface DailyData {
  date: string
  count?: number
  cost?: number
  completed?: number
}

interface ModelStat {
  model: string
  calls: number
  costUsd: number
  avgLatencyMs: number
  successRate: number
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-400 w-8 text-right">{value}</span>
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [daily, setDaily]     = useState<{ dailyUsers: DailyData[]; dailyTasks: DailyData[]; dailyCosts: DailyData[] } | null>(null)
  const [models, setModels]   = useState<ModelStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiFetch<typeof daily>('/api/v1/admin/analytics/daily?days=30'),
      apiFetch<{ models: ModelStat[] }>('/api/v1/admin/analytics/models'),
    ]).then(([dailyRes, modelsRes]) => {
      if (dailyRes.success && dailyRes.data) setDaily(dailyRes.data)
      if (modelsRes.success && modelsRes.data) setModels(modelsRes.data.models)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-slate-400">Loading analytics…</div>
  if (!daily) return null

  const maxUsers = Math.max(...daily.dailyUsers.map((d) => d.count || 0), 1)
  const maxTasks = Math.max(...daily.dailyTasks.map((d) => d.count || 0), 1)
  const maxCost  = Math.max(...daily.dailyCosts.map((d) => d.cost  || 0), 0.001)
  const maxCalls = Math.max(...models.map((m) => m.calls), 1)

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">Analytics — last 30 days</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New users */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold mb-4">New users / day</h2>
          <div className="space-y-1.5">
            {daily.dailyUsers.slice(-14).map((d) => (
              <div key={d.date}>
                <div className="flex justify-between text-xs text-slate-400 mb-0.5">
                  <span>{new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                </div>
                <MiniBar value={d.count || 0} max={maxUsers} color="bg-brand-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold mb-4">Tasks / day</h2>
          <div className="space-y-1.5">
            {daily.dailyTasks.slice(-14).map((d) => (
              <div key={d.date}>
                <div className="flex justify-between text-xs text-slate-400 mb-0.5">
                  <span>{new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                </div>
                <MiniBar value={d.count || 0} max={maxTasks} color="bg-blue-500" />
              </div>
            ))}
          </div>
        </div>

        {/* API costs */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold mb-4">API cost / day (USD)</h2>
          <div className="space-y-1.5">
            {daily.dailyCosts.slice(-14).map((d) => (
              <div key={d.date}>
                <div className="flex justify-between text-xs text-slate-400 mb-0.5">
                  <span>{new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                  <span>${(d.cost || 0).toFixed(3)}</span>
                </div>
                <MiniBar value={d.cost || 0} max={maxCost} color="bg-red-500" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI model usage */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold mb-5">AI usage — last 30 days</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-200">
                {['Model', 'Calls', 'Cost (USD)', 'Avg latency', 'Success rate', 'Volume'].map((h) => (
                  <th key={h} className="text-left pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {models.map((m) => (
                <tr key={m.model} className="hover:bg-slate-50">
                  <td className="py-3 pr-4 font-mono text-xs">{m.model}</td>
                  <td className="py-3 pr-4 font-mono">{m.calls.toLocaleString()}</td>
                  <td className="py-3 pr-4 font-mono">${m.costUsd.toFixed(4)}</td>
                  <td className="py-3 pr-4 font-mono">{m.avgLatencyMs}ms</td>
                  <td className="py-3 pr-4">
                    <span className={`font-mono ${m.successRate >= 95 ? 'text-green-600' : m.successRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {m.successRate}%
                    </span>
                  </td>
                  <td className="py-3 w-32">
                    <MiniBar value={m.calls} max={maxCalls} color="bg-brand-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
