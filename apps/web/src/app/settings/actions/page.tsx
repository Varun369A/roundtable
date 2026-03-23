'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

// ── Types ───────────────────────────────────────────────────────────────────

type ActionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED'
type FilterTab    = 'ALL' | ActionStatus

interface ExecutionAction {
  id: string
  taskId: string
  taskTitle: string
  subtaskId: string
  subtaskTitle: string
  type: string           // e.g. 'GITHUB_PUSH', 'GMAIL_SEND'
  provider: string       // e.g. 'GITHUB', 'GMAIL'
  summary: string
  payload: Record<string, unknown>
  status: ActionStatus
  createdAt: string
  expiresAt?: string
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const PROVIDER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  GITHUB:  { bg: 'bg-slate-100',       text: 'text-slate-700',   border: 'border-slate-200'   },
  GMAIL:   { bg: 'bg-red-50',          text: 'text-red-600',     border: 'border-red-200'     },
  NOTION:  { bg: 'bg-slate-100',       text: 'text-slate-600',   border: 'border-slate-200'   },
  SLACK:   { bg: 'bg-purple-50',       text: 'text-purple-600',  border: 'border-purple-200'  },
  LINEAR:  { bg: 'bg-indigo-50',       text: 'text-indigo-600',  border: 'border-indigo-200'  },
  JIRA:    { bg: 'bg-blue-50',         text: 'text-blue-600',    border: 'border-blue-200'    },
}

const STATUS_STYLES: Record<ActionStatus, { label: string; color: string }> = {
  PENDING:  { label: 'Pending',  color: 'text-amber-600'  },
  APPROVED: { label: 'Approved', color: 'text-green-600'  },
  REJECTED: { label: 'Rejected', color: 'text-red-600'    },
  EXECUTED: { label: 'Executed', color: 'text-indigo-600' },
}

const FILTER_TABS: Array<{ key: FilterTab; label: string }> = [
  { key: 'ALL',      label: 'All'      },
  { key: 'PENDING',  label: 'Pending'  },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
]

// ── Countdown ───────────────────────────────────────────────────────────────

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function update() {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Expired'); return }
      const totalSeconds = Math.floor(diff / 1000)
      const h = Math.floor(totalSeconds / 3600)
      const m = Math.floor((totalSeconds % 3600) / 60)
      const s = totalSeconds % 60
      if (h > 0) setRemaining(`${h}h ${m}m`)
      else setRemaining(`${m}m ${s}s`)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  const isUrgent = new Date(expiresAt).getTime() - Date.now() < 3600_000

  return (
    <span className={`tabular-nums ${isUrgent ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
      {remaining}
    </span>
  )
}

// ── Reject Modal ────────────────────────────────────────────────────────────

interface RejectModalProps {
  action: ExecutionAction
  onClose: () => void
  onRejected: () => void
}

function RejectModal({ action, onClose, onRejected }: RejectModalProps) {
  const [reason, setReason]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleReject() {
    setLoading(true)
    await apiFetch(`/api/v1/actions/${action.id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() || 'No reason provided' }),
    })
    onRejected()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/60 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Reject Action</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Optionally explain why you are rejecting this action. The AI will receive this feedback.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Wrong branch, please target main instead of develop"
          rows={3}
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          autoFocus
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Rejecting…' : 'Reject Action'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Action Row ──────────────────────────────────────────────────────────────

interface ActionRowProps {
  action: ExecutionAction
  onApprove: (id: string) => void
  onReject:  (action: ExecutionAction) => void
  approvingId: string | null
}

function ActionRow({ action, onApprove, onReject, approvingId }: ActionRowProps) {
  const [expanded, setExpanded] = useState(false)

  const providerStyle = PROVIDER_STYLES[action.provider] || PROVIDER_STYLES.GITHUB
  const statusCfg     = STATUS_STYLES[action.status]
  const isApproving   = approvingId === action.id

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Provider badge */}
          <span
            className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wide mt-0.5 ${providerStyle.bg} ${providerStyle.text} ${providerStyle.border}`}
          >
            {action.provider}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/roundtable/${action.taskId}`}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors truncate"
              >
                {action.taskTitle}
              </Link>
              {action.subtaskTitle && (
                <>
                  <span className="text-slate-300">›</span>
                  <span className="text-xs text-slate-500 truncate">{action.subtaskTitle}</span>
                </>
              )}
            </div>
            <p className="text-sm text-slate-800 leading-snug">{action.summary}</p>
            <div className="flex items-center gap-3 flex-wrap text-[10px]">
              <span className={`font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
              <span className="text-slate-400">{new Date(action.createdAt).toLocaleString()}</span>
              {action.expiresAt && action.status === 'PENDING' && (
                <span className="flex items-center gap-1 text-slate-400">
                  Expires in <Countdown expiresAt={action.expiresAt} />
                </span>
              )}
              {action.rejectionReason && (
                <span className="text-red-500">Reason: {action.rejectionReason}</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {action.status === 'PENDING' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onApprove(action.id)}
                disabled={!!approvingId}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving ? (
                  <span className="w-3 h-3 border border-green-500/40 border-t-green-600 rounded-full animate-spin" />
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Approve
              </button>
              <button
                onClick={() => onReject(action)}
                disabled={!!approvingId}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors disabled:opacity-50"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject
              </button>
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 mt-2.5 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {expanded ? 'Hide' : 'View'} payload
        </button>
      </div>

      {/* Payload viewer */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 pb-4 pt-3">
          <pre className="text-[11px] font-mono text-slate-700 overflow-x-auto leading-relaxed whitespace-pre-wrap break-words max-h-64">
            {JSON.stringify(action.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ActionsPage() {
  const [actions, setActions]       = useState<ExecutionAction[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<FilterTab>('ALL')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ExecutionAction | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const refreshTimer                = useRef<ReturnType<typeof setInterval>>()

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const res = await apiFetch<{ actions: ExecutionAction[] }>('/api/v1/actions')
    if (res.success && res.data) {
      setActions(res.data.actions)
    } else if (!res.success && !silent) {
      setError('Failed to load actions.')
    }
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Auto-refresh every 30s when there are pending items
  useEffect(() => {
    const hasPending = actions.some((a) => a.status === 'PENDING')
    clearInterval(refreshTimer.current)
    if (hasPending) {
      refreshTimer.current = setInterval(() => load(true), 30_000)
    }
    return () => clearInterval(refreshTimer.current)
  }, [actions])

  async function handleApprove(id: string) {
    setApprovingId(id)
    // Optimistic update
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'APPROVED' as ActionStatus } : a)),
    )
    const res = await apiFetch(`/api/v1/actions/${id}/approve`, { method: 'POST' })
    if (!res.success) {
      // Revert on failure
      setActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'PENDING' as ActionStatus } : a)),
      )
      setError('Failed to approve action. Please try again.')
    }
    setApprovingId(null)
  }

  function handleRejectConfirm() {
    setRejectTarget(null)
    load(true)
  }

  const filtered = filter === 'ALL' ? actions : actions.filter((a) => a.status === filter)
  const pendingCount = actions.filter((a) => a.status === 'PENDING').length

  // Group by taskId for display
  const grouped = filtered.reduce<Record<string, ExecutionAction[]>>((acc, a) => {
    if (!acc[a.taskId]) acc[a.taskId] = []
    acc[a.taskId].push(a)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-slate-500 text-sm">
        <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
        Loading actions…
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-slate-900">Action Approvals</h1>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
              {pendingCount} pending
            </span>
          )}
        </div>
        <p className="text-slate-500 text-sm leading-relaxed">
          Review and approve AI-proposed real-world actions before they are executed.
        </p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline text-red-500 hover:text-red-600">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 pb-0">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.key === 'ALL'
              ? actions.length
              : actions.filter((a) => a.status === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
                filter === tab.key
                  ? 'border-indigo-500 text-slate-900 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    filter === tab.key ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <div>
            <p className="text-slate-600 font-medium">No pending actions</p>
            <p className="text-slate-400 text-sm mt-1">
              {filter === 'ALL'
                ? 'When Arivarangam proposes real-world actions, they will appear here for your review.'
                : `No ${filter.toLowerCase()} actions.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([taskId, taskActions]) => (
            <div key={taskId}>
              {/* Task group header */}
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href={`/roundtable/${taskId}`}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors truncate"
                >
                  {taskActions[0]?.taskTitle || taskId}
                </Link>
                <span className="text-[10px] text-slate-400">{taskActions.length} action{taskActions.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2.5">
                {taskActions.map((action) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    onApprove={handleApprove}
                    onReject={setRejectTarget}
                    approvingId={approvingId}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectTarget && (
        <RejectModal
          action={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={handleRejectConfirm}
        />
      )}
    </div>
  )
}
