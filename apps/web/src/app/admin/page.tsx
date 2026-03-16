'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import Link from 'next/link'

interface Overview {
  users: { total: number; today: number; thisMonth: number; growth: number }
  tasks: { total: number; today: number; thisMonth: number; activeNow: number; completionRate: number; failureRate: number }
  revenue: { thisMonthUsd: number; apiCostUsd: number; marginUsd: number; marginPercent: number; thisMonthInr: number }
  tiers: Array<{ tier: string; count: number }>
  languages: Array<{ language: string; count: number }>
}

interface LiveTask {
  id: string
  title: string
  status: string
  user: { email: string; tier: string }
  subtasks: Array<{ status: string; assignedModel: string; title: string }>
}

function KPICard({ label, value, sub, color = 'text-white' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  )
}

const TIER_COLORS: Record<string, string> = {
  FREE: 'bg-zinc-700',
  STARTER: 'bg-blue-600',
  PRO: 'bg-brand-600',
  POWER: 'bg-yellow-600',
  ENTERPRISE: 'bg-green-600',
}

export default function AdminOverviewPage() {
  const [overview, setOverview]   = useState<Overview | null>(null)
  const [live, setLive]           = useState<LiveTask[]>([])
  const [loading, setLoading]     = useState(true)

  async function load() {
    const [ovRes, liveRes] = await Promise.all([
      apiFetch<Overview>('/api/v1/admin/analytics/overview'),
      apiFetch<{ live: LiveTask[] }>('/api/v1/admin/tasks/live'),
    ])
    if (ovRes.success && ovRes.data)     setOverview(ovRes.data)
    if (liveRes.success && liveRes.data) setLive(liveRes.data.live)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000) // refresh every 15s
    return () => clearInterval(interval)
  }, [])

  if (loading || !overview) {
    return (
      <div className="p-8 text-zinc-500">Loading overview…</div>
    )
  }

  const { users, tasks, revenue, tiers, languages } = overview
  const totalUsersForTiers = tiers.reduce((s, t) => s + t.count, 0)

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="flex items-center gap-4">
          <Link href="/admin/nova" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
            🤖 NOVA →
          </Link>
          <Link href="/admin/developer" className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
            🧪 Developer →
          </Link>
          <Link href="/admin/beta" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            Beta →
          </Link>
          <Link href="/admin/feedback" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
            Feedback →
          </Link>
          <span className="text-xs text-zinc-600">
            Auto-refreshes every 15s · {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total users"
          value={users.total.toLocaleString()}
          sub={`+${users.today} today · +${users.thisMonth} this month`}
        />
        <KPICard
          label="Tasks today"
          value={tasks.today.toLocaleString()}
          sub={`${tasks.activeNow} live now · ${tasks.completionRate}% completion`}
          color={tasks.activeNow > 0 ? 'text-brand-400' : 'text-white'}
        />
        <KPICard
          label="Revenue (MTD)"
          value={`₹${revenue.thisMonthInr.toLocaleString('en-IN')}`}
          sub={`$${revenue.thisMonthUsd.toFixed(2)} USD`}
          color="text-green-400"
        />
        <KPICard
          label="Margin (MTD)"
          value={`${revenue.marginPercent}%`}
          sub={`API cost: $${revenue.apiCostUsd.toFixed(2)} · Net: $${revenue.marginUsd.toFixed(2)}`}
          color={revenue.marginPercent > 50 ? 'text-green-400' : revenue.marginPercent > 20 ? 'text-yellow-400' : 'text-red-400'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live tasks */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <h2 className="font-semibold text-sm">
              Live tasks
              {live.length > 0 && (
                <span className="ml-2 text-xs text-brand-400 font-normal">
                  {live.length} running
                </span>
              )}
            </h2>
            <Link href="/admin/tasks" className="text-xs text-zinc-500 hover:text-zinc-300">View all →</Link>
          </div>
          <div className="divide-y divide-zinc-800/50 max-h-80 overflow-y-auto">
            {live.length === 0 ? (
              <p className="px-5 py-6 text-zinc-600 text-sm text-center">No tasks running right now</p>
            ) : (
              live.map((task) => (
                <div key={task.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-zinc-500">{task.user.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${TIER_COLORS[task.user.tier] || 'bg-zinc-700'} text-white`}>
                      {task.user.tier}
                    </span>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {task.subtasks.map((s, i) => (
                      <span
                        key={i}
                        className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                          s.status === 'COMPLETED'   ? 'bg-green-500/10 text-green-400' :
                          s.status === 'IN_PROGRESS' ? 'bg-brand-500/10 text-brand-400' :
                          s.status === 'FAILED'      ? 'bg-red-500/10 text-red-400'     :
                          'bg-zinc-800 text-zinc-600'
                        }`}
                      >
                        {s.assignedModel.split('-')[0]}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Tier breakdown */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="font-semibold text-sm mb-4">Users by plan</h2>
            <div className="space-y-2">
              {tiers.sort((a, b) => b.count - a.count).map((t) => {
                const pct = totalUsersForTiers > 0 ? (t.count / totalUsersForTiers) * 100 : 0
                return (
                  <div key={t.tier}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">{t.tier}</span>
                      <span className="font-mono">{t.count}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full">
                      <div
                        className={`h-full rounded-full ${TIER_COLORS[t.tier] || 'bg-zinc-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top languages */}
          {languages.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="font-semibold text-sm mb-4">Top languages</h2>
              <div className="space-y-1.5">
                {languages.slice(0, 6).map((l) => (
                  <div key={l.language} className="flex justify-between text-sm">
                    <span className="text-zinc-400 uppercase text-xs">{l.language}</span>
                    <span className="font-mono text-xs">{l.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
