'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduledTask {
  id: string
  name: string
  goal: string
  cronExpression: string
  timezone: string
  scheduleDescription?: string
  nextRunAt?: string
  lastRunAt?: string
  lastRunStatus?: 'completed' | 'failed' | null
  runCount: number
  isActive: boolean
  maxRuns?: number | null
  notifyOnFail: boolean
  notifyOnComplete: boolean
  createdAt: string
}

interface ScheduleRun {
  id: string
  status: 'completed' | 'failed' | 'running'
  startedAt: string
  endedAt?: string
  taskId?: string
  durationMs?: number
}

interface Stats {
  active: number
  totalRuns: number
  failedRuns: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: 'Asia/Kolkata',     label: 'Asia/Kolkata (IST)' },
  { value: 'UTC',              label: 'UTC' },
  { value: 'Asia/Dubai',       label: 'Asia/Dubai (GST)' },
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'Europe/London',    label: 'Europe/London (GMT/BST)' },
]

const PRESETS = [
  { label: 'Daily 9am',    cron: '0 9 * * *',   description: 'Every day at 9:00 AM' },
  { label: 'Every weekday',cron: '0 9 * * 1-5', description: 'Monday–Friday at 9:00 AM' },
  { label: 'Every Monday', cron: '0 9 * * 1',   description: 'Every Monday at 9:00 AM' },
  { label: 'Monthly 1st',  cron: '0 9 1 * *',   description: 'First of every month at 9:00 AM' },
  { label: 'Custom',       cron: '',             description: '' },
]

function isValidCron(expr: string): boolean {
  // Basic 5-part cron validation
  const parts = expr.trim().split(/\s+/)
  return parts.length === 5
}

function humanCron(expr: string, timezone: string): string {
  const tz = TIMEZONES.find((t) => t.value === timezone)?.label || timezone
  const preset = PRESETS.find((p) => p.cron === expr && p.cron !== '')
  if (preset) return `Will run: ${preset.description} (${tz})`
  if (expr && isValidCron(expr)) return `Will run: ${expr} (${tz})`
  return ''
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return 'Never'
  const diff = new Date(dateStr).getTime() - Date.now()
  const absDiff = Math.abs(diff)
  const isPast = diff < 0

  if (absDiff < 60_000) return isPast ? 'just now' : 'in a moment'
  if (absDiff < 3_600_000) {
    const m = Math.round(absDiff / 60_000)
    return isPast ? `${m}m ago` : `in ${m}m`
  }
  if (absDiff < 86_400_000) {
    const h = Math.round(absDiff / 3_600_000)
    return isPast ? `${h}h ago` : `in ${h}h`
  }
  const d = Math.round(absDiff / 86_400_000)
  return isPast ? `${d}d ago` : `in ${d} day${d !== 1 ? 's' : ''}`
}

function durationLabel(ms?: number): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}m`
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    failed:    'text-red-600 bg-red-50 border-red-200',
    running:   'text-indigo-600 bg-indigo-50 border-indigo-200',
    never:     'text-slate-500 bg-slate-100 border-slate-200',
  }
  const cls = map[status] || map.never
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {status}
    </span>
  )
}

// ─── Create/Edit Dialog ───────────────────────────────────────────────────────

interface DialogProps {
  initial?: ScheduledTask | null
  onClose: () => void
  onSaved: () => void
}

function ScheduleDialog({ initial, onClose, onSaved }: DialogProps) {
  const [name, setName] = useState(initial?.name || '')
  const [goal, setGoal] = useState(initial?.goal || '')
  const [selectedPreset, setSelectedPreset] = useState(() => {
    if (!initial) return 'Daily 9am'
    const p = PRESETS.find((p) => p.cron === initial.cronExpression && p.cron !== '')
    return p ? p.label : 'Custom'
  })
  const [customCron, setCustomCron] = useState(() => {
    if (!initial) return ''
    const p = PRESETS.find((p) => p.cron === initial.cronExpression && p.cron !== '')
    return p ? '' : (initial.cronExpression || '')
  })
  const [timezone, setTimezone] = useState(initial?.timezone || 'Asia/Kolkata')
  const [limitRuns, setLimitRuns] = useState(initial?.maxRuns != null)
  const [maxRuns, setMaxRuns] = useState(String(initial?.maxRuns || 10))
  const [notifyOnFail, setNotifyOnFail] = useState(initial?.notifyOnFail ?? true)
  const [notifyOnComplete, setNotifyOnComplete] = useState(initial?.notifyOnComplete ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeCron = selectedPreset === 'Custom'
    ? customCron
    : PRESETS.find((p) => p.label === selectedPreset)?.cron || ''

  const preview = humanCron(activeCron, timezone)
  const cronValid = activeCron ? isValidCron(activeCron) : false

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !goal.trim() || !cronValid) return

    setSaving(true)
    setError(null)
    try {
      const body = {
        name: name.trim(),
        goal: goal.trim(),
        cronExpression: activeCron,
        timezone,
        maxRuns: limitRuns ? parseInt(maxRuns, 10) || null : null,
        notifyOnFail,
        notifyOnComplete,
      }

      const res = initial
        ? await apiFetch(`/api/v1/scheduled-tasks/${initial.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await apiFetch('/api/v1/scheduled-tasks', {
            method: 'POST',
            body: JSON.stringify(body),
          })

      if (!res.success) {
        setError(res.error?.message || 'Failed to save schedule.')
        return
      }
      onSaved()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {initial ? 'Edit Schedule' : 'New Schedule'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Arivarangam will automatically run this task on your schedule
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Schedule Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly market report"
                required
                className="w-full px-3 py-2.5 bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-sm outline-none transition-colors"
              />
            </div>

            {/* Goal */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Goal <span className="text-slate-400">(what Arivarangam should do each run)</span>
              </label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Research and summarise top 5 industry news stories from the past week…"
                required
                rows={3}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-sm outline-none transition-colors resize-none"
              />
            </div>

            {/* Schedule picker */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Schedule</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setSelectedPreset(p.label)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedPreset === p.label
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {selectedPreset === 'Custom' && (
                <div className="mb-3">
                  <input
                    type="text"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="Cron expression, e.g. 0 9 * * 1"
                    className={`w-full px-3 py-2.5 bg-white border rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 outline-none transition-colors ${
                      customCron && !isValidCron(customCron)
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                    }`}
                  />
                  {customCron && !isValidCron(customCron) && (
                    <p className="text-xs text-red-500 mt-1">
                      Invalid cron — use 5-part format: minute hour day month weekday
                    </p>
                  )}
                </div>
              )}

              {preview && (
                <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-lg">
                  {preview}
                </p>
              )}
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-sm outline-none transition-colors"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {/* Max runs */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Run limit</label>
              <div className="flex items-center gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => setLimitRuns(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    !limitRuns ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Unlimited
                </button>
                <button
                  type="button"
                  onClick={() => setLimitRuns(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    limitRuns ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Limit to N
                </button>
              </div>
              {limitRuns && (
                <input
                  type="number"
                  value={maxRuns}
                  onChange={(e) => setMaxRuns(e.target.value)}
                  min={1}
                  placeholder="e.g. 10"
                  className="w-32 px-3 py-2 bg-white border border-slate-200 text-slate-900 focus:border-indigo-500 rounded-lg text-sm outline-none"
                />
              )}
            </div>

            {/* Notifications */}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-600">Notifications</label>
              {[
                { id: 'fail',     label: 'Notify on fail',     checked: notifyOnFail,     set: setNotifyOnFail },
                { id: 'complete', label: 'Notify on complete', checked: notifyOnComplete, set: setNotifyOnComplete },
              ].map((item) => (
                <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => item.set(!item.checked)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                      item.checked ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        item.checked ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !goal.trim() || !cronValid}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-colors"
            >
              {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? 'Saving…' : initial ? 'Save changes' : 'Create schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Run History Panel ────────────────────────────────────────────────────────

function RunHistoryPanel({ schedule, onClose }: { schedule: ScheduledTask; onClose: () => void }) {
  const [runs, setRuns] = useState<ScheduleRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await apiFetch<{ runs: ScheduleRun[] }>(
          `/api/v1/scheduled-tasks/${schedule.id}/runs`,
        )
        if (res.success && res.data) setRuns(res.data.runs || [])
        else setError(res.error?.message || 'Failed to load runs.')
      } catch {
        setError('Network error loading run history.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [schedule.id])

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white border-l border-slate-200 flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{schedule.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Run history (last 50)</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Runs list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <p className="text-xs text-red-500 text-center py-8">{error}</p>
          ) : runs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">No runs yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <StatusBadge status={run.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700">
                      {new Date(run.startedAt).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Duration: {durationLabel(run.durationMs)}
                    </p>
                  </div>
                  {run.taskId && (
                    <Link
                      href={`/roundtable/${run.taskId}`}
                      className="shrink-0 text-[10px] text-indigo-600 hover:text-indigo-500 transition-colors"
                    >
                      View →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScheduledTasksPage() {
  const [schedules, setSchedules] = useState<ScheduledTask[]>([])
  const [stats, setStats] = useState<Stats>({ active: 0, totalRuns: 0, failedRuns: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<ScheduledTask | null>(null)
  const [historyTarget, setHistoryTarget] = useState<ScheduledTask | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ scheduledTasks: ScheduledTask[]; stats: Stats }>(
        '/api/v1/scheduled-tasks',
      )
      if (res.success && res.data) {
        const list = res.data.scheduledTasks || []
        setSchedules(list)
        // Derive stats if not returned by API
        if (res.data.stats) {
          setStats(res.data.stats)
        } else {
          setStats({
            active: list.filter((s) => s.isActive).length,
            totalRuns: list.reduce((n, s) => n + (s.runCount || 0), 0),
            failedRuns: 0,
          })
        }
      } else {
        setError(res.error?.message || 'Failed to load schedules.')
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleToggle(s: ScheduledTask) {
    setTogglingId(s.id)
    try {
      const res = await apiFetch(`/api/v1/scheduled-tasks/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !s.isActive }),
      })
      if (res.success) {
        setSchedules((prev) =>
          prev.map((x) => (x.id === s.id ? { ...x, isActive: !x.isActive } : x)),
        )
        setStats((prev) => ({
          ...prev,
          active: prev.active + (s.isActive ? -1 : 1),
        }))
      }
    } finally {
      setTogglingId(null)
    }
  }

  async function handleRunNow(s: ScheduledTask) {
    setRunningId(s.id)
    try {
      await apiFetch(`/api/v1/scheduled-tasks/${s.id}/run`, { method: 'POST' })
    } finally {
      setRunningId(null)
      fetchAll()
    }
  }

  async function handleDelete(s: ScheduledTask) {
    if (!confirm(`Delete schedule "${s.name}"?`)) return
    setDeletingId(s.id)
    try {
      const res = await apiFetch(`/api/v1/scheduled-tasks/${s.id}`, { method: 'DELETE' })
      if (res.success) {
        setSchedules((prev) => prev.filter((x) => x.id !== s.id))
        setStats((prev) => ({
          ...prev,
          active: prev.active - (s.isActive ? 1 : 0),
        }))
      }
    } finally {
      setDeletingId(null)
    }
  }

  const statCards = [
    { label: 'Active Schedules', value: stats.active,    icon: '⚡' },
    { label: 'Total Runs',       value: stats.totalRuns, icon: '▶' },
    { label: 'Failed (30d)',     value: stats.failedRuns, icon: '✕', warn: stats.failedRuns > 0 },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/dashboard" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                ← Dashboard
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Scheduled Tasks</h1>
            <p className="text-slate-500 text-sm mt-1">
              Automate Arivarangam to run tasks on a recurring schedule — daily reports, weekly audits, and more.
            </p>
          </div>
          <button
            onClick={() => { setEditTarget(null); setShowDialog(true) }}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold text-white transition-colors"
          >
            + New Schedule
          </button>
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.warn ? 'text-red-500' : 'text-slate-900'}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Error ───────────────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {/* ── Schedules list ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-slate-200" />
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl py-20 text-center shadow-sm">
            <p className="text-3xl mb-3">⏰</p>
            <p className="text-slate-500 text-sm font-medium">No schedules yet</p>
            <p className="text-slate-400 text-xs mt-1 mb-5">
              Automate any Arivarangam task to run on a recurring schedule
            </p>
            <button
              onClick={() => { setEditTarget(null); setShowDialog(true) }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium text-white transition-colors"
            >
              Create your first schedule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl px-5 py-4 transition-colors shadow-sm"
              >
                <div className="flex items-start gap-4">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(s)}
                    disabled={togglingId === s.id}
                    className={`mt-0.5 w-10 h-5 rounded-full transition-colors relative shrink-0 ${
                      s.isActive ? 'bg-indigo-600' : 'bg-slate-300'
                    } ${togglingId === s.id ? 'opacity-50' : ''}`}
                    aria-label={s.isActive ? 'Disable' : 'Enable'}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        s.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900">{s.name}</h3>
                      {!s.isActive && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          paused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-lg">{s.goal}</p>

                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="text-xs text-slate-600">
                        {s.scheduleDescription || s.cronExpression}
                      </span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-500">
                        Next: <span className="text-slate-700">{relativeTime(s.nextRunAt)}</span>
                      </span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-500">
                        Last:{' '}
                        {s.lastRunStatus ? (
                          <StatusBadge status={s.lastRunStatus} />
                        ) : (
                          <span className="text-slate-400">never</span>
                        )}
                      </span>
                      <span className="text-slate-300 text-xs">·</span>
                      <span className="text-xs text-slate-500">
                        {s.runCount} run{s.runCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setHistoryTarget(s)}
                      className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                    >
                      History
                    </button>
                    <button
                      onClick={() => handleRunNow(s)}
                      disabled={runningId === s.id}
                      className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg text-slate-600 transition-colors"
                    >
                      {runningId === s.id ? 'Running…' : 'Run now'}
                    </button>
                    <button
                      onClick={() => { setEditTarget(s); setShowDialog(true) }}
                      className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={deletingId === s.id}
                      className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      {deletingId === s.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      {showDialog && (
        <ScheduleDialog
          initial={editTarget}
          onClose={() => { setShowDialog(false); setEditTarget(null) }}
          onSaved={() => { setShowDialog(false); setEditTarget(null); fetchAll() }}
        />
      )}

      {historyTarget && (
        <RunHistoryPanel
          schedule={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  )
}
