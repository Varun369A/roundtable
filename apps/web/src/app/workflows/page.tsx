'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Workflow {
  id: string
  name: string
  description: string
  triggerType: 'MANUAL' | 'SCHEDULED' | 'WEBHOOK'
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  stepCount: number
  lastRun?: {
    id: string
    status: 'RUNNING' | 'COMPLETED' | 'FAILED'
    startedAt: string
  }
  createdAt: string
}

interface WorkflowStats {
  activeCount: number
  totalRuns: number
  successRate: number
}

// ─── Badge helpers ─────────────────────────────────────────────────────────────

const TRIGGER_BADGE: Record<string, string> = {
  MANUAL:    'bg-zinc-700/60 text-zinc-400 border border-zinc-600/50',
  SCHEDULED: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  WEBHOOK:   'bg-purple-500/15 text-purple-400 border border-purple-500/30',
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT:    'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  ACTIVE:   'bg-green-500/15 text-green-400 border border-green-500/30',
  PAUSED:   'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  ARCHIVED: 'bg-red-500/15 text-red-400 border border-red-500/30',
}

const RUN_DOT: Record<string, string> = {
  RUNNING:   'bg-blue-400 animate-pulse',
  COMPLETED: 'bg-green-400',
  FAILED:    'bg-red-400',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Create Workflow Dialog ────────────────────────────────────────────────────

function CreateDialog({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (wf: Workflow) => void
}) {
  const [name, setName]             = useState('')
  const [description, setDesc]      = useState('')
  const [triggerType, setTrigger]   = useState<'MANUAL' | 'SCHEDULED' | 'WEBHOOK'>('MANUAL')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    const res = await apiFetch<{ workflow: Workflow }>('/api/v1/workflows', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), description: description.trim(), triggerType }),
    })
    setSaving(false)
    if (res.success && res.data?.workflow) {
      onCreate(res.data.workflow)
    } else {
      setError(res.error?.message || 'Failed to create workflow')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">New Workflow</h2>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors text-lg leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Research → Draft → Review"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 focus:border-zinc-500 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What does this workflow accomplish?"
              rows={2}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 focus:border-zinc-500 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Trigger</label>
            <div className="flex gap-2">
              {(['MANUAL', 'SCHEDULED', 'WEBHOOK'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrigger(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                    triggerType === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700'
                  }`}
                >
                  {t === 'MANUAL' ? '▶ Manual' : t === 'SCHEDULED' ? '⏰ Scheduled' : '🔗 Webhook'}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-300 bg-zinc-800 border border-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all duration-200 active:scale-95"
            >
              {saving ? 'Creating…' : 'Create Workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Run Now Dialog ────────────────────────────────────────────────────────────

function RunDialog({ workflow, onClose }: {
  workflow: Workflow
  onClose: () => void
}) {
  const router                = useRouter()
  const [payload, setPayload] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError]     = useState('')

  async function handleRun(e: React.FormEvent) {
    e.preventDefault()
    setRunning(true)
    setError('')

    let triggerPayload: Record<string, unknown> | undefined
    if (payload.trim()) {
      try {
        triggerPayload = JSON.parse(payload)
      } catch {
        setError('Invalid JSON payload')
        setRunning(false)
        return
      }
    }

    const res = await apiFetch<{ run: { id: string } }>(`/api/v1/workflows/${workflow.id}/run`, {
      method: 'POST',
      body: JSON.stringify({ payload: triggerPayload }),
    })
    setRunning(false)
    if (res.success && res.data?.run) {
      router.push(`/workflows/${workflow.id}/runs/${res.data.run.id}`)
    } else {
      setError(res.error?.message || 'Failed to start workflow')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Run Workflow</h2>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors text-lg leading-none">×</button>
        </div>
        <form onSubmit={handleRun} className="px-6 py-5 space-y-4">
          <p className="text-sm text-zinc-400">
            Start workflow <span className="text-zinc-200 font-medium">"{workflow.name}"</span>?
          </p>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Trigger payload <span className="text-zinc-700">(optional JSON)</span>
            </label>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder={'{\n  "key": "value"\n}'}
              rows={4}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 focus:border-zinc-500 rounded-xl text-xs text-zinc-300 placeholder-zinc-700 outline-none transition-colors resize-none font-mono"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-300 bg-zinc-800 border border-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={running}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all duration-200 active:scale-95"
            >
              {running ? 'Starting…' : '▶ Run Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Workflow Card ─────────────────────────────────────────────────────────────

function WorkflowCard({ workflow, onRun, onEdit, onToggle, onDelete }: {
  workflow: Workflow
  onRun:    (wf: Workflow) => void
  onEdit:   (wf: Workflow) => void
  onToggle: (wf: Workflow) => void
  onDelete: (wf: Workflow) => void
}) {
  return (
    <div className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl px-5 py-4 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        {/* Left: info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-semibold text-sm text-zinc-200 truncate">{workflow.name}</p>
            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${TRIGGER_BADGE[workflow.triggerType]}`}>
              {workflow.triggerType}
            </span>
            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[workflow.status]}`}>
              {workflow.status}
            </span>
            <span className="shrink-0 text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
              {workflow.stepCount} {workflow.stepCount === 1 ? 'step' : 'steps'}
            </span>
          </div>
          {workflow.description && (
            <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{workflow.description}</p>
          )}
          {workflow.lastRun && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${RUN_DOT[workflow.lastRun.status] || 'bg-zinc-500'}`} />
              <span className="text-[11px] text-zinc-600">
                Last run {relativeTime(workflow.lastRun.startedAt)}
                {' · '}
                <span className={workflow.lastRun.status === 'FAILED' ? 'text-red-400' : 'text-zinc-500'}>
                  {workflow.lastRun.status.toLowerCase()}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={() => onRun(workflow)}
            title="Run now"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-indigo-600 text-zinc-400 hover:text-white text-sm transition-all duration-150"
          >
            ▶
          </button>
          <button
            onClick={() => onEdit(workflow)}
            title="Edit"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-all duration-150"
          >
            ✏
          </button>
          <button
            onClick={() => onToggle(workflow)}
            title={workflow.status === 'ACTIVE' ? 'Pause' : 'Activate'}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-all duration-150"
          >
            {workflow.status === 'ACTIVE' ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => onDelete(workflow)}
            title="Delete"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-red-900/60 text-zinc-500 hover:text-red-400 text-sm transition-all duration-150"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Stats Bar ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, loading }: { label: string; value: string | number; loading: boolean }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4">
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 w-16 bg-zinc-800 rounded-lg animate-pulse" />
          <div className="h-3 w-24 bg-zinc-800 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-zinc-100">{value}</p>
          <p className="text-xs text-zinc-500 mt-1">{label}</p>
        </>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const router                                  = useRouter()
  const [workflows, setWorkflows]               = useState<Workflow[]>([])
  const [stats, setStats]                       = useState<WorkflowStats | null>(null)
  const [loading, setLoading]                   = useState(true)
  const [showCreate, setShowCreate]             = useState(false)
  const [runTarget, setRunTarget]               = useState<Workflow | null>(null)
  const [deleteTarget, setDeleteTarget]         = useState<Workflow | null>(null)
  const [confirmDelete, setConfirmDelete]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch<{ workflows: Workflow[]; stats: WorkflowStats }>('/api/v1/workflows')
    if (res.success && res.data) {
      setWorkflows(res.data.workflows || [])
      setStats(res.data.stats || null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(wf: Workflow) {
    const newStatus = wf.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    const res = await apiFetch<{ workflow: Workflow }>(`/api/v1/workflows/${wf.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.success && res.data?.workflow) {
      setWorkflows((prev) => prev.map((w) => w.id === wf.id ? res.data!.workflow : w))
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await apiFetch(`/api/v1/workflows/${deleteTarget.id}`, { method: 'DELETE' })
    setWorkflows((prev) => prev.filter((w) => w.id !== deleteTarget.id))
    setDeleteTarget(null)
    setConfirmDelete(false)
  }

  const activeCount    = stats?.activeCount ?? workflows.filter((w) => w.status === 'ACTIVE').length
  const totalRuns      = stats?.totalRuns ?? 0
  const successRate    = stats?.successRate != null ? `${Math.round(stats.successRate)}%` : '—'

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* Header nav */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-10 px-6 py-3 flex items-center justify-between">
        <span className="text-lg font-bold">Sabha<span className="text-indigo-500">.</span></span>
        <nav className="flex items-center gap-4">
          <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Dashboard</Link>
          <Link href="/workflows" className="text-xs text-zinc-200 font-medium">Workflows</Link>
          <Link href="/dashboard/scheduled" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Scheduled</Link>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Workflows</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Automate multi-step AI tasks. Chain Sabha roundtables into powerful pipelines.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold text-white transition-all duration-200 active:scale-95"
          >
            + New Workflow
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Active Workflows" value={activeCount} loading={loading} />
          <StatCard label="Total Runs (last 30 days)" value={totalRuns} loading={loading} />
          <StatCard label="Success Rate" value={successRate} loading={loading} />
        </div>

        {/* Workflow list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl">
              ⚡
            </div>
            <h3 className="text-base font-semibold text-zinc-300 mb-2">No workflows yet</h3>
            <p className="text-sm text-zinc-600 mb-6 max-w-xs mx-auto">
              Chain multiple Sabha roundtables to automate complex research, writing, and analysis pipelines.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold text-white transition-all duration-200 active:scale-95"
            >
              Create your first workflow
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onRun={setRunTarget}
                onEdit={(w) => router.push(`/workflows/${w.id}`)}
                onToggle={handleToggle}
                onDelete={(w) => { setDeleteTarget(w); setConfirmDelete(true) }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Dialogs */}
      {showCreate && (
        <CreateDialog
          onClose={() => setShowCreate(false)}
          onCreate={(wf) => {
            setWorkflows((prev) => [wf, ...prev])
            setShowCreate(false)
            router.push(`/workflows/${wf.id}`)
          }}
        />
      )}

      {runTarget && (
        <RunDialog workflow={runTarget} onClose={() => setRunTarget(null)} />
      )}

      {/* Delete confirm */}
      {confirmDelete && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm px-6 py-5">
            <h2 className="text-sm font-semibold text-zinc-200 mb-2">Delete Workflow?</h2>
            <p className="text-xs text-zinc-500 mb-5">
              "<span className="text-zinc-300">{deleteTarget.name}</span>" and all its run history will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmDelete(false); setDeleteTarget(null) }}
                className="flex-1 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-300 bg-zinc-800 border border-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-all duration-200 active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
