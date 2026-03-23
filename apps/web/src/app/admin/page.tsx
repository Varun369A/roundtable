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

const TIER_COLORS: Record<string, string> = {
  FREE:       'bg-slate-100 text-slate-600',
  BUILDER:    'bg-blue-100 text-blue-700',
  STUDIO:     'bg-indigo-100 text-indigo-700',
  ENTERPRISE: 'bg-emerald-100 text-emerald-700',
}

const AUTOMATED_SYSTEMS = [
  { name: 'Task Router',        desc: 'Auto-assigns AI models based on goal type',          status: 'active',  icon: '🎯' },
  { name: 'Credit Deduction',   desc: 'Charges credits on task completion',                 status: 'active',  icon: '💳' },
  { name: 'Skill Detector',     desc: 'Builds user passport from task history',             status: 'active',  icon: '🧠' },
  { name: 'Referral Engine',    desc: 'Pays referral bonus after first task',               status: 'active',  icon: '🎁' },
  { name: 'Token Rotation',     desc: 'Auto-rotates JWT refresh tokens',                    status: 'active',  icon: '🔑' },
  { name: 'Rate Limiter',       desc: 'Blocks brute force on login',                        status: 'active',  icon: '🛡️' },
  { name: 'Email Verification', desc: 'Sends verify email on signup',                       status: 'paused',  icon: '📧' },
  { name: 'Cron Workers',       desc: 'Scheduled task processing via BullMQ',               status: 'active',  icon: '⏱️' },
  { name: 'Error Recovery',     desc: 'Auto-retries failed subtasks up to 3 times',        status: 'active',  icon: '🔄' },
  { name: 'Plan Limits',        desc: 'Enforces monthly task quotas per tier',              status: 'active',  icon: '📊' },
]

function KPICard({ label, value, sub, trend, color = 'text-slate-900' }: {
  label: string; value: string | number; sub?: string; trend?: string; color?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-medium">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      {trend && <p className="text-xs text-emerald-600 mt-1 font-medium">{trend}</p>}
    </div>
  )
}

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [live, setLive]         = useState<LiveTask[]>([])
  const [loading, setLoading]   = useState(true)

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
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  if (loading || !overview) {
    return (
      <div className="p-8 space-y-4">
        {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl bg-slate-200 animate-pulse" />)}
      </div>
    )
  }

  const { users, tasks, revenue, tiers, languages } = overview
  const totalUsersForTiers = tiers.reduce((s, t) => s + t.count, 0)

  return (
    <div className="p-8 space-y-8 max-w-7xl">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Platform overview · auto-refreshes every 15s</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/nova"
            className="text-xs px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg transition-colors font-medium">
            🔮 Nova AI
          </Link>
          <Link href="/admin/developer"
            className="text-xs px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg transition-colors font-medium">
            🧪 Dev Tools
          </Link>
          <Link href="/admin/flags"
            className="text-xs px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-colors font-medium">
            🚩 Feature Flags
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Users"
          value={users.total.toLocaleString()}
          sub={`+${users.today} today · +${users.thisMonth} this month`}
          trend={users.growth > 0 ? `↑ ${users.growth}% growth` : undefined}
        />
        <KPICard
          label="Tasks Today"
          value={tasks.today.toLocaleString()}
          sub={`${tasks.activeNow} live · ${tasks.completionRate}% completion`}
          color={tasks.activeNow > 0 ? 'text-indigo-600' : 'text-slate-900'}
        />
        <KPICard
          label="Revenue (MTD)"
          value={`₹${revenue.thisMonthInr.toLocaleString('en-IN')}`}
          sub={`$${revenue.thisMonthUsd.toFixed(2)} USD`}
          color="text-emerald-700"
        />
        <KPICard
          label="Margin (MTD)"
          value={`${revenue.marginPercent}%`}
          sub={`API cost: $${revenue.apiCostUsd.toFixed(2)} · Net: $${revenue.marginUsd.toFixed(2)}`}
          color={revenue.marginPercent > 50 ? 'text-emerald-700' : revenue.marginPercent > 20 ? 'text-amber-700' : 'text-red-600'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Live tasks */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-sm text-slate-800">
              Live tasks
              {live.length > 0 && (
                <span className="ml-2 text-xs text-indigo-600 font-normal bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                  {live.length} running
                </span>
              )}
            </h2>
            <Link href="/admin/tasks" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">View all →</Link>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {live.length === 0 ? (
              <p className="px-5 py-8 text-slate-400 text-sm text-center">No tasks running right now</p>
            ) : (
              live.map((task) => (
                <div key={task.id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                      <p className="text-xs text-slate-400">{task.user.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${TIER_COLORS[task.user.tier] || 'bg-slate-100 text-slate-600'}`}>
                      {task.user.tier}
                    </span>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {task.subtasks.map((s, i) => (
                      <span
                        key={i}
                        className={`text-xs px-1.5 py-0.5 rounded font-mono border ${
                          s.status === 'COMPLETED'   ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          s.status === 'IN_PROGRESS' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          s.status === 'FAILED'      ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-slate-100 text-slate-500 border-slate-200'
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
          {/* Users by plan */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="font-semibold text-sm text-slate-800 mb-4">Users by plan</h2>
            <div className="space-y-2.5">
              {tiers.sort((a, b) => b.count - a.count).map((t) => {
                const pct = totalUsersForTiers > 0 ? (t.count / totalUsersForTiers) * 100 : 0
                return (
                  <div key={t.tier}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 font-medium">{t.tier}</span>
                      <span className="font-mono text-slate-500">{t.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="font-semibold text-sm text-slate-800 mb-3">Quick actions</h2>
            <div className="space-y-1.5">
              <Link href="/admin/users" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700 border border-slate-200">
                <span>👥</span> Manage users
              </Link>
              <Link href="/admin/flags" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700 border border-slate-200">
                <span>🚩</span> Toggle features
              </Link>
              <Link href="/admin/connectors" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700 border border-slate-200">
                <span>🤖</span> AI model health
              </Link>
              <Link href="/admin/marketing" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700 border border-slate-200">
                <span>📣</span> Waitlist & invites
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Automated Systems */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Automated Systems</h2>
            <p className="text-xs text-slate-400 mt-0.5">These run automatically — no manual action required</p>
          </div>
          <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-medium">
            {AUTOMATED_SYSTEMS.filter(s => s.status === 'active').length}/{AUTOMATED_SYSTEMS.length} active
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {AUTOMATED_SYSTEMS.map((sys) => (
            <div
              key={sys.name}
              className={`rounded-xl border p-3 ${
                sys.status === 'active'
                  ? 'bg-white border-slate-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{sys.icon}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  sys.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {sys.status === 'active' ? '● ON' : '● PAUSED'}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-800 leading-tight">{sys.name}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{sys.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Languages */}
      {languages.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <h2 className="font-semibold text-sm text-slate-800 mb-4">Top languages used</h2>
          <div className="flex flex-wrap gap-2">
            {languages.slice(0, 10).map((l) => (
              <span key={l.language} className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="uppercase font-semibold">{l.language}</span>
                <span className="text-slate-400 font-mono">{l.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
