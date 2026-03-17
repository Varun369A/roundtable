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
  GITHUB:  { bg: 'bg-gray-700/40',    text: 'text-gray-300',   border: 'border-gray-600/40' },
  GMAIL:   { bg: 'bg-red-500/10',     text: 'text-red-400',    border: 'border-red-500/20'  },
  NOTION:  { bg: 'bg-zinc-600/30',    text: 'text-zinc-300',   border: 'border-zinc-500/30' },
  SLACK:   { bg: 'bg-purple-500/15',  text: 'text-purple-400', border: 'border-purple-500/20' },
  LINEAR:  { bg: 'bg-indigo-500/15',  text: 'text-indigo-400', border: 'border-indigo-500/20' },
  JIRA:    { bg: 'bg-blue-500/15',    text: 'text-blue-400',   border: 'border-blue-500/20'  },
}

const STATUS_STYLES: Record<ActionStatus, { label: string; color: string }> = {
  PENDING:  { label: 'Pending',  color: 'text-amber-400'  },
  APPROVED: { label: 'Approved', color: 'text-green-400'  },
  REJECTED: { label: 'Rejected', color: 'text-red-400'    },
  EXECUTED: { label: 'Executed', color: 'text-indigo-400' },
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
    <span className={`tabular-nums ${isUrgent ? 'text-red-400 font-semibold' : 'text-zinc-500'}`}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60 p-6 space-y-4">
        <h2 className="text-base font-bold text-white">Reject Action</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Optionally explain why you are rejecting this action. The AI will receive this feedback.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Wrong branch, please target main instead of develop"
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
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
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm transition-colors"
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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
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
                className="text-xs font-semibold text-zinc-300 hover:text-white transition-colors truncate"
              >
                {action.taskTitle}
              </Link>
              {action.subtaskTitle && (
                <>
                  <span className="text-zinc-700">›</span>
                  <span className="text-xs text-zinc-500 truncate">{action.subtaskTitle}</span>
                </>
              )}
            </div>
            <p className="text-sm text-zinc-200 leading-snug">{action.summary}</p>
            <div className="flex items-center gap-3 flex-wrap text-[10px]">
              <span className={`font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
              <span className="text-zinc-600">{new Date(action.createdAt).toLocaleString()}</span>
              {action.expiresAt && action.status === 'PENDING' && (
                <span className="flex items-center gap-1 text-zinc-500">
                  Expires in <Countdown expiresAt={action.expiresAt} />
                </span>
              )}
              {action.rejectionReason && (
                <span className="text-red-400/80">Reason: {action.rejectionReason}</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {action.status === 'PENDING' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onApprove(action.id)}
                disabled={!!approvingId}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving ? (
                  <span className="w-3 h-3 border border-green-400/40 border-t-green-400 rounded-full animate-spin" />
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
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-600/15 hover:bg-red-600/30 text-red-400 border border-red-500/20 transition-colors disabled:opacity-50"
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
          className="flex items-center gap-1 mt-2.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
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
        <div className="border-t border-zinc-800 bg-zinc-950/60 px-4 pb-4 pt-3">
          <pre className="text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed whitespace-pre-wrap break-words max-h-64">
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
      <div className="p-8 flex items-center gap-3 text-zinc-500 text-sm">
        <span className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
        Loading actions…
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-white">Action Approvals</h1>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {pendingCount} pending
            </span>
          )}
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Review and approve AI-proposed real-world actions before they are executed.
        </p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline text-red-400/70 hover:text-red-400">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-zinc-800 pb-0">
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
                  ? 'border-indigo-500 text-white font-medium'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    filter === tab.key ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-800 text-zinc-500'
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
          <svg className="w-12 h-12 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <div>
            <p className="text-zinc-400 font-medium">No pending actions</p>
            <p className="text-zinc-600 text-sm mt-1">
              {filter === 'ALL'
                ? 'When Sabha proposes real-world actions, they will appear here for your review.'
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
                  className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors truncate"
                >
                  {taskActions[0]?.taskTitle || taskId}
                </Link>
                <span className="text-[10px] text-zinc-600">{taskActions.length} action{taskActions.length !== 1 ? 's' : ''}</span>
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
