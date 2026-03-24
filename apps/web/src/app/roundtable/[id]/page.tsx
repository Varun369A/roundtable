'use client'

import { useEffect, useRef, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTaskStream, StreamEvent } from '@/hooks/useTaskStream'
import { ClarificationModal } from '@/components/roundtable/ClarificationModal'
import { SteeringInput } from '@/components/roundtable/SteeringInput'
import { SessionPanel } from '@/components/roundtable/SessionPanel'
import { VoiceInputButton } from '@/components/roundtable/VoiceInputButton'
import { OutputViewer, getModelConfig } from '@/components/roundtable'
import type { Message, TeamMember } from '@/components/roundtable'
import { apiFetch } from '@/lib/api'
import RequestReviewModal from '@/components/marketplace/RequestReviewModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskInfo {
  id: string
  title: string
  originalGoal: string
  status: string
  template?: { category: string }
}

interface ActiveSubtask {
  subtaskId: string
  title: string
  model: string
  role?: 'INITIAL' | 'REVIEW' | 'SYNTHESIS'
  roundNumber?: number
}

type Phase = 'routing' | 'planning' | 'implementation' | 'review' | 'synthesis' | 'done' | 'failed'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:               { label: 'Queued',      color: 'text-amber-600' },
  ROUTING:               { label: 'Routing…',    color: 'text-blue-600'  },
  IN_PROGRESS:           { label: 'Live',        color: 'text-indigo-600' },
  COMPLETED:             { label: 'Complete',    color: 'text-emerald-600' },
  FAILED:                { label: 'Failed',      color: 'text-red-600'   },
  CANCELLED:             { label: 'Cancelled',   color: 'text-slate-500' },
  WAITING_CLARIFICATION: { label: 'Needs input', color: 'text-amber-600' },
}

const PHASE_LABELS: Record<Phase, { label: string; description: string; color: string }> = {
  routing:        { label: 'Assembling team',   description: 'Arivarangam AI is selecting the right AIs for your task', color: 'text-blue-600'    },
  planning:       { label: 'Planning',          description: 'AIs are discussing the approach together',                color: 'text-violet-600'  },
  implementation: { label: 'Building',          description: 'AIs are working on your task in parallel',               color: 'text-indigo-600'  },
  review:         { label: 'Peer review',       description: 'AIs are reviewing each other\'s work',                   color: 'text-amber-600'   },
  synthesis:      { label: 'Synthesising',      description: 'Arivarangam AI is merging all outputs',                  color: 'text-emerald-600' },
  done:           { label: 'Complete',          description: 'Your deliverables are ready',                            color: 'text-emerald-700' },
  failed:         { label: 'Failed',            description: 'Task encountered errors',                                color: 'text-red-600'     },
}

// ─── Round Table Seat ─────────────────────────────────────────────────────────

interface SeatProps {
  model: string
  role?: string
  isSpeaking: boolean
  isDone: boolean
  messageCount: number
  index: number
  total: number
  tableRadius: number // px
}

function TableSeat({ model, role, isSpeaking, isDone, messageCount, index, total, tableRadius }: SeatProps) {
  const cfg = getModelConfig(model)
  const angleDeg = (index / total) * 360 - 90
  const angleRad = (angleDeg * Math.PI) / 180
  const x = 50 + (tableRadius / 2) * Math.cos(angleRad)
  const y = 50 + (tableRadius / 2) * Math.sin(angleRad)

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {/* Seat circle */}
      <div className="relative">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold border-2 transition-all duration-300 ${
            isSpeaking
              ? 'shadow-lg scale-110'
              : isDone
              ? 'opacity-90'
              : 'opacity-60'
          }`}
          style={{
            backgroundColor: cfg.bg,
            borderColor: isSpeaking ? cfg.color : isDone ? `${cfg.color}80` : `${cfg.color}30`,
            boxShadow: isSpeaking ? `0 0 20px ${cfg.color}60` : undefined,
          }}
          title={cfg.label}
        >
          {cfg.emoji}
        </div>
        {/* Speaking pulse ring */}
        {isSpeaking && (
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ backgroundColor: cfg.color }}
          />
        )}
        {/* Done checkmark */}
        {isDone && !isSpeaking && (
          <div
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ backgroundColor: cfg.color, color: '#fff' }}
          >
            {messageCount > 1 ? messageCount : '✓'}
          </div>
        )}
      </div>
      {/* Label */}
      <div className="text-center">
        <div className="text-[11px] font-semibold text-slate-700 whitespace-nowrap leading-tight">{cfg.label}</div>
        {role && <div className="text-[9px] text-slate-400 capitalize">{role}</div>}
      </div>
    </div>
  )
}

// ─── Round Table Visual ───────────────────────────────────────────────────────

interface RoundTableProps {
  team: TeamMember[]
  activeSubtasks: ActiveSubtask[]
  messages: Message[]
  phase: Phase
  taskTitle?: string
}

function RoundTable({ team, activeSubtasks, messages, phase, taskTitle }: RoundTableProps) {
  const phaseCfg = PHASE_LABELS[phase]
  const activeModels = new Set(activeSubtasks.map((s) => s.model))
  const doneModels = new Map<string, number>()
  for (const m of messages) {
    if (m.type === 'ai' && m.model && !m.isError) {
      doneModels.set(m.model, (doneModels.get(m.model) || 0) + 1)
    }
  }

  // De-duplicate team by model (keep first occurrence)
  const uniqueTeam = team.filter((t, i) => team.findIndex((u) => u.model === t.model) === i)
  const N = uniqueTeam.length

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Table container */}
      <div className="relative w-72 h-72 shrink-0">
        {/* Table surface */}
        <div
          className="absolute rounded-full border border-slate-700"
          style={{
            inset: '18%',
            background: 'radial-gradient(circle at 35% 35%, #1e293b, #0f172a)',
            boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.5), 0 4px 32px rgba(0,0,0,0.3)',
          }}
        >
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
              {phaseCfg.label}
            </span>
            {taskTitle && (
              <span className="text-[9px] text-slate-600 leading-tight line-clamp-2 px-1">
                {taskTitle}
              </span>
            )}
            {/* Rotating indicator when active */}
            {['routing', 'planning', 'implementation', 'review', 'synthesis'].includes(phase) && (
              <div className="mt-2 flex gap-1">
                {[0, 100, 200].map((d) => (
                  <div
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Seats */}
        {N > 0 && uniqueTeam.map((member, i) => (
          <TableSeat
            key={member.model}
            model={member.model}
            role={member.category}
            isSpeaking={activeModels.has(member.model)}
            isDone={doneModels.has(member.model)}
            messageCount={doneModels.get(member.model) || 0}
            index={i}
            total={N}
            tableRadius={87}
          />
        ))}

        {/* Empty state seats placeholder when routing */}
        {N === 0 && [0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${50 + 43 * Math.cos(((i / 3) * 360 - 90) * Math.PI / 180)}%`,
              top:  `${50 + 43 * Math.sin(((i / 3) * 360 - 90) * Math.PI / 180)}%`,
            }}
          >
            <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-dashed border-slate-700 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Phase description */}
      <p className={`text-xs font-medium text-center ${phaseCfg.color}`}>
        {phaseCfg.description}
      </p>
    </div>
  )
}

// ─── Activity Entry ───────────────────────────────────────────────────────────

function ActivityEntry({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false)

  if (message.type === 'system') {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-slate-700" />
        <span className="text-[10px] text-slate-500 whitespace-nowrap">{message.title}</span>
        <div className="h-px flex-1 bg-slate-700" />
      </div>
    )
  }

  if (message.type === 'routing_card') {
    return null // handled by the table
  }

  const cfg = getModelConfig(message.model || '')
  const isReview    = message.role === 'REVIEW'
  const isSynthesis = message.role === 'SYNTHESIS'
  const label = isSynthesis ? 'Final synthesis' : isReview ? 'Peer review' : 'Output'
  const content = message.output?.content || ''
  const preview = content.slice(0, 180)
  const hasMore = content.length > 180

  return (
    <div
      className={`rounded-xl border transition-all ${
        message.isError
          ? 'border-red-900/40 bg-red-950/20'
          : isSynthesis
          ? 'border-emerald-800/40 bg-emerald-950/20'
          : isReview
          ? 'border-amber-800/40 bg-amber-950/10'
          : 'border-slate-700/60 bg-slate-800/40'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 font-bold"
          style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.color}40` }}
        >
          {cfg.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200">{cfg.label}</span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                isSynthesis ? 'bg-emerald-900/60 text-emerald-400' :
                isReview    ? 'bg-amber-900/60 text-amber-400'     :
                              'bg-slate-700 text-slate-400'
              }`}
            >
              {label}
            </span>
          </div>
          {message.title && (
            <div className="text-[10px] text-slate-500 truncate">{message.title}</div>
          )}
        </div>
        {content && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-slate-500 hover:text-slate-300 shrink-0 transition-colors"
          >
            {expanded ? 'collapse' : 'expand'}
          </button>
        )}
      </div>

      {/* Content */}
      {message.isError ? (
        <p className="px-4 pb-3 text-xs text-red-400">Failed to complete this step.</p>
      ) : message.output?.type === 'image' && message.output.fileUrl ? (
        <div className="px-4 pb-3">
          <img src={message.output.fileUrl} alt="Generated" className="rounded-lg max-h-48 w-auto" />
        </div>
      ) : content ? (
        <div className="px-4 pb-3">
          {expanded ? (
            <OutputViewer
              type={message.output!.type}
              content={message.output!.content}
              fileUrl={message.output!.fileUrl}
            />
          ) : (
            <p className="text-xs text-slate-400 leading-relaxed">
              {preview}{hasMore && !expanded && <span className="text-slate-600">…</span>}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ─── Delivery Panel ───────────────────────────────────────────────────────────

function DeliveryPanel({ taskId, hasCode }: { taskId: string; hasCode: boolean }) {
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null)
  const [showRepoInput, setShowRepoInput]     = useState(false)
  const [repoName, setRepoName]               = useState('')
  const [pushing, setPushing]                 = useState(false)
  const [pushed, setPushed]                   = useState<string | null>(null)
  const [error, setError]                     = useState<string | null>(null)
  const [assembling, setAssembling]           = useState(false)
  const [assembled, setAssembled]             = useState(false)

  useEffect(() => {
    if (!hasCode) return
    // Check GitHub connection
    apiFetch<{ connection: { login: string } | null }>('/api/v1/github/connection').then((r) => {
      setGithubConnected(!!(r.success && (r.data as any)?.connection))
    })
    // Trigger assembly
    apiFetch(`/api/v1/code-projects/${taskId}/assemble`, { method: 'POST' }).then((r) => {
      if (r.success) setAssembled(true)
    })
  }, [taskId, hasCode])

  async function handleDownload() {
    setAssembling(true)
    const response = await fetch(`/api/v1/code-projects/${taskId}/download`, { credentials: 'include' })
    if (!response.ok) { setAssembling(false); return }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `arivarangam-project-${taskId.slice(0, 8)}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setAssembling(false)
  }

  async function handlePush() {
    if (!repoName.trim()) return
    setPushing(true)
    setError(null)
    const r = await apiFetch<{ repoUrl: string }>(`/api/v1/code-projects/${taskId}/push`, {
      method: 'POST',
      body: JSON.stringify({ repoName: repoName.trim() }),
    })
    setPushing(false)
    if (r.success && (r.data as any)?.repoUrl) {
      setPushed((r.data as any).repoUrl)
    } else {
      setError((r as any)?.error?.message || 'Push failed. Please try again.')
    }
  }

  if (!hasCode) return null

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 mt-3">
      <p className="text-xs font-semibold text-slate-300 mb-3">Download your project</p>
      <div className="flex flex-wrap gap-2">
        {/* ZIP Download */}
        <button
          onClick={handleDownload}
          disabled={assembling}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {assembling ? (
            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : '📦'}
          Download ZIP
        </button>

        {/* GitHub push */}
        {pushed ? (
          <a
            href={pushed}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
          >
            ✓ View on GitHub →
          </a>
        ) : githubConnected === false ? (
          <Link
            href="/settings/integrations?connect=github"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 hover:border-slate-400 text-slate-300 text-sm font-medium transition-colors"
          >
            🔗 Connect GitHub to push
          </Link>
        ) : githubConnected && !showRepoInput ? (
          <button
            onClick={() => setShowRepoInput(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 hover:border-indigo-500 text-slate-300 hover:text-white text-sm font-medium transition-colors"
          >
            Push to GitHub →
          </button>
        ) : null}
      </div>

      {/* Repo name input */}
      {showRepoInput && !pushed && (
        <div className="mt-3 flex gap-2">
          <input
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="repo-name"
            className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && handlePush()}
            autoFocus
          />
          <button
            onClick={handlePush}
            disabled={pushing || !repoName.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {pushing ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
            ) : 'Push'}
          </button>
          <button
            onClick={() => setShowRepoInput(false)}
            className="px-3 py-2 rounded-lg border border-slate-600 text-slate-400 hover:text-white text-sm transition-colors"
          >
            ✕
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoundtablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [task, setTask]                       = useState<TaskInfo | null>(null)
  const [messages, setMessages]               = useState<Message[]>([])
  const [activeSubtasks, setActiveSubtasks]   = useState<ActiveSubtask[]>([])
  const [taskStatus, setTaskStatus]           = useState<string>('PENDING')
  const [phase, setPhase]                     = useState<Phase>('routing')
  const [team, setTeam]                       = useState<TeamMember[]>([])
  const [hasCodeWorkspace, setHasCodeWorkspace] = useState(false)
  const [synthesisComplete, setSynthesisComplete] = useState(false)
  const [clarifications, setClarifications]   = useState<any[]>([])
  const [showClarification, setShowClarification] = useState(false)
  const [steeringText, setSteeringText]       = useState('')
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewToast, setReviewToast]         = useState(false)
  const [showKeyDialog, setShowKeyDialog]     = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)
  const logRef     = useRef<HTMLDivElement>(null)

  // Auto-scroll log
  useEffect(() => {
    const el = logRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    if (dist < 300) el.scrollTop = el.scrollHeight
  }, [messages, activeSubtasks])

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: `sys-${Date.now()}`, type: 'system', title: text, timestamp: new Date() }])
  }

  // Load task + auto-start
  useEffect(() => {
    async function init() {
      const result = await apiFetch<{ task: TaskInfo }>(`/api/v1/tasks/${id}`)
      if (!result.success || !result.data) { router.push('/dashboard'); return }
      const t = result.data.task
      setTask(t)
      setTaskStatus(t.status)

      if (t.status === 'COMPLETED') {
        setPhase('done')
      } else if (t.status === 'FAILED') {
        setPhase('failed')
      }

      if (t.status === 'PENDING' && !hasStarted.current) {
        hasStarted.current = true
        const connRes = await apiFetch<{ providers: Array<{ connected: boolean; verified: boolean }> }>('/api/v1/ai-connections')
        const hasKeys = connRes.success && (connRes.data as any)?.providers?.some((p: any) => p.connected && p.verified)
        if (!hasKeys) { setShowKeyDialog(true); return }
        await apiFetch(`/api/v1/tasks/${id}/start`, { method: 'POST' })
        setTaskStatus('ROUTING')
      } else if (t.status === 'WAITING_CLARIFICATION') {
        const clRes = await apiFetch<{ clarifications: any[] }>(`/api/v1/tasks/${id}/clarifications`)
        if (clRes.success && (clRes.data as any)?.clarifications?.length) {
          setClarifications((clRes.data as any).clarifications)
          setShowClarification(true)
        }
      } else if (t.status === 'ROUTING' || t.status === 'IN_PROGRESS') {
        addSystemMessage('Reconnected — resuming…')
      }
    }
    init()
  }, [id, router])

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    switch (event.event) {
      case 'connected':
        if (event.status) setTaskStatus(event.status)
        break

      case 'routing_decided':
        if (event.team?.length) {
          setTeam(event.team)
          setMessages((prev) =>
            prev.some((m) => m.id === 'routing-decision')
              ? prev
              : [...prev, { id: 'routing-decision', type: 'routing_card', team: event.team, timestamp: new Date() }]
          )
          setPhase('planning')
        }
        break

      case 'subtask_started':
        if (event.subtaskId && event.model) {
          setActiveSubtasks((prev) => [
            ...prev.filter((s) => s.subtaskId !== event.subtaskId),
            { subtaskId: event.subtaskId!, title: event.title || '', model: event.model!, role: event.role, roundNumber: event.roundNumber },
          ])
          // Set phase based on role
          if (event.role === 'REVIEW') setPhase('review')
          else if (event.role === 'SYNTHESIS') setPhase('synthesis')
          else setPhase((prev) => (prev === 'planning' || prev === 'routing') ? 'implementation' : prev)
        }
        break

      case 'subtask_completed':
        setActiveSubtasks((prev) => prev.filter((s) => s.subtaskId !== event.subtaskId))
        setMessages((prev) => [
          ...prev,
          {
            id:          event.subtaskId || `msg-${Date.now()}`,
            type:        'ai',
            model:       event.model,
            title:       event.title,
            output:      event.output as Message['output'],
            timestamp:   new Date(),
            role:        event.role,
            roundNumber: event.roundNumber,
          },
        ])
        break

      case 'subtask_failed':
        setActiveSubtasks((prev) => prev.filter((s) => s.subtaskId !== event.subtaskId))
        setMessages((prev) => [
          ...prev,
          { id: event.subtaskId || `err-${Date.now()}`, type: 'ai', isError: true, title: 'A step encountered an error', timestamp: new Date() },
        ])
        break

      case 'discussion_round_started':
        setPhase('review')
        addSystemMessage('Peer Review — each AI critiques the others\' work')
        break

      case 'synthesis_started':
        setPhase('synthesis')
        addSystemMessage('Arivarangam AI is synthesising all outputs…')
        break

      case 'synthesis_complete':
        setSynthesisComplete(true)
        break

      case 'task_completed':
        setTaskStatus('COMPLETED')
        setPhase('done')
        setActiveSubtasks([])
        if (event.hasCodeWorkspace) setHasCodeWorkspace(true)
        addSystemMessage('All done — your deliverables are ready')
        break

      case 'task_failed':
        setTaskStatus('FAILED')
        setPhase('failed')
        setActiveSubtasks([])
        addSystemMessage('Task encountered errors. Partial results are shown below.')
        break

      case 'task_cancelled':
        setTaskStatus('CANCELLED')
        setActiveSubtasks([])
        addSystemMessage('Task was cancelled.')
        break

      case 'clarification_needed':
        setClarifications(event.questions || [])
        setShowClarification(true)
        setTaskStatus('WAITING_CLARIFICATION')
        break

      case 'steering_applied':
        addSystemMessage('Steering applied ✓')
        break
    }
  }, [])

  const { connected } = useTaskStream({ taskId: id, onEvent: handleStreamEvent, enabled: !!task })

  const statusCfg = STATUS_LABEL[taskStatus] || STATUS_LABEL.PENDING
  const isLive    = ['ROUTING', 'IN_PROGRESS'].includes(taskStatus)

  async function proceedWithPlatformKeys() {
    setShowKeyDialog(false)
    await apiFetch(`/api/v1/tasks/${id}/start`, { method: 'POST' })
    setTaskStatus('ROUTING')
    addSystemMessage('Using Arivarangam platform keys — assembling your team…')
  }

  // Visible activity messages (exclude routing_card — shown in table)
  const activityMessages = messages.filter((m) => m.type !== 'routing_card')

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-none px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 text-sm shrink-0 transition-colors">
            ← Dashboard
          </Link>
          <div className="h-4 w-px bg-slate-700" />
          <p className="flex-1 text-sm font-medium truncate text-slate-200">
            {task?.originalGoal || '…'}
          </p>
          <div className="flex items-center gap-3 shrink-0">
            {!['COMPLETED', 'FAILED', 'CANCELLED'].includes(taskStatus) && (
              <button
                onClick={async () => {
                  if (!confirm('Cancel this task?')) return
                  await apiFetch(`/api/v1/tasks/${id}`, { method: 'DELETE' })
                  router.push('/dashboard')
                }}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-950/30"
              >
                Cancel
              </button>
            )}
            <div className="flex items-center gap-2">
              {isLive && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />}
              <span className={`text-xs font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
            </div>
            <SessionPanel taskId={id} taskStatus={taskStatus} isOwner />
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left — Round Table */}
        <div className="hidden md:flex w-80 shrink-0 flex-col items-center border-r border-slate-800 bg-slate-900 py-10 px-4 gap-6 overflow-y-auto">
          <RoundTable
            team={team}
            activeSubtasks={activeSubtasks}
            messages={messages}
            phase={phase}
            taskTitle={task?.originalGoal}
          />

          {/* Phase progress steps */}
          <div className="w-full space-y-1.5 mt-2">
            {((['routing', 'planning', 'implementation', 'review', 'synthesis', 'done']) as Phase[]).map((p) => {
              const cfg = PHASE_LABELS[p]
              const phases: Phase[] = ['routing', 'planning', 'implementation', 'review', 'synthesis', 'done']
              const currentIdx = phases.indexOf(phase)
              const thisIdx    = phases.indexOf(p)
              const isActive   = phase === p
              const isPast     = thisIdx < currentIdx
              return (
                <div
                  key={p}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                    isActive ? 'bg-slate-800 border border-slate-700' : 'opacity-40'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isPast    ? 'bg-emerald-500' :
                      isActive  ? 'bg-indigo-500 animate-pulse' :
                                  'bg-slate-600'
                    }`}
                  />
                  <div>
                    <div className={`text-[11px] font-semibold ${isActive ? cfg.color : 'text-slate-500'}`}>
                      {cfg.label}
                    </div>
                  </div>
                  {isPast && <span className="ml-auto text-emerald-500 text-[10px]">✓</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right — Activity Feed */}
        <div ref={logRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-3">

          {/* Mobile: compact AI seats row */}
          <div className="flex md:hidden gap-3 overflow-x-auto pb-2 mb-2">
            {team.filter((t, i) => team.findIndex((u) => u.model === t.model) === i).map((member) => {
              const cfg = getModelConfig(member.model)
              const isSpeaking = activeSubtasks.some((s) => s.model === member.model)
              const isDone = messages.some((m) => m.type === 'ai' && m.model === member.model && !m.isError)
              return (
                <div key={member.model} className="flex flex-col items-center gap-1 shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 transition-all ${
                      isSpeaking ? 'scale-110' : isDone ? '' : 'opacity-50'
                    }`}
                    style={{
                      backgroundColor: cfg.bg,
                      borderColor: isSpeaking ? cfg.color : `${cfg.color}40`,
                      boxShadow: isSpeaking ? `0 0 12px ${cfg.color}60` : undefined,
                    }}
                  >
                    {cfg.emoji}
                  </div>
                  <span className="text-[9px] text-slate-500 whitespace-nowrap">{cfg.label}</span>
                </div>
              )
            })}
          </div>

          {/* Empty state */}
          {activityMessages.length === 0 && activeSubtasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center gap-3">
              <div className="flex gap-2">
                {[0, 150, 300].map((d) => (
                  <div key={d} className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
              <p className="text-slate-500 text-sm max-w-xs">
                {taskStatus === 'ROUTING' ? 'Assembling your AI team…' : 'Preparing your roundtable…'}
              </p>
            </div>
          )}

          {/* Clarification waiting */}
          {taskStatus === 'WAITING_CLARIFICATION' && !showClarification && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <p className="text-2xl">💬</p>
              <p className="text-slate-300 font-medium text-sm">A few quick questions</p>
              <button
                onClick={() => setShowClarification(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Answer questions
              </button>
            </div>
          )}

          {/* Activity messages */}
          {activityMessages.map((msg) => (
            <ActivityEntry key={msg.id} message={msg} />
          ))}

          {/* Typing indicators */}
          {activeSubtasks.map((s) => {
            const cfg = getModelConfig(s.model)
            return (
              <div key={s.subtaskId} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-700/50 bg-slate-800/30">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 font-bold"
                  style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.color}40` }}
                >
                  {cfg.emoji}
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-300">{cfg.label}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {s.role === 'REVIEW' ? 'reviewing…' : s.role === 'SYNTHESIS' ? 'synthesising…' : 'thinking…'}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <div
                      key={d}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ backgroundColor: cfg.color, animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Completion card */}
          {taskStatus === 'COMPLETED' && (
            <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/30 p-6 text-center mt-4">
              <p className="text-emerald-400 font-semibold text-lg mb-1">
                {synthesisComplete ? '🏆 Roundtable Complete' : 'Roundtable complete'}
              </p>
              <p className="text-slate-400 text-sm">
                {messages.filter((m) => m.type === 'ai' && !m.isError).length} outputs ·{' '}
                {new Set(messages.filter((m) => m.model).map((m) => m.model)).size} AIs
                {synthesisComplete && ' · Planning → Building → Review → Synthesis'}
              </p>
              <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                {hasCodeWorkspace && (
                  <Link
                    href={`/workspace/${id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                  >
                    💻 Open Workspace
                  </Link>
                )}
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-900/30 hover:bg-amber-900/50 border border-amber-800/60 text-amber-400 text-sm font-medium transition-colors"
                >
                  🎓 Request Expert Review
                </button>
              </div>

              {/* Delivery panel */}
              <DeliveryPanel taskId={id} hasCode={hasCodeWorkspace} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Steering input ───────────────────────────────────────────────────── */}
      <div className="relative shrink-0">
        <SteeringInput
          taskId={id}
          isVisible={taskStatus === 'IN_PROGRESS'}
          initialText={steeringText}
          onTextChange={setSteeringText}
        />
        {taskStatus === 'IN_PROGRESS' && (
          <div className="absolute bottom-0 right-[5.5rem] h-[3.25rem] flex items-center pr-1">
            <VoiceInputButton onTranscription={(text) => setSteeringText(text)} disabled={false} />
          </div>
        )}
      </div>

      {/* ── Reconnecting banner ──────────────────────────────────────────────── */}
      {!connected && isLive && (
        <div className="fixed bottom-0 inset-x-0 bg-yellow-500/10 border-t border-yellow-500/20 py-2 text-center text-xs text-yellow-400">
          Reconnecting to live feed…
        </div>
      )}

      {/* ── API Key dialog ───────────────────────────────────────────────────── */}
      {showKeyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">🔑</div>
              <h2 className="text-lg font-bold text-slate-100">No AI keys connected</h2>
              <p className="text-sm text-slate-400 mt-1.5">
                Connect your own keys for free unlimited usage, or use Arivarangam platform keys (credits deducted).
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={proceedWithPlatformKeys}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                💳 Use platform keys (deduct credits)
              </button>
              <Link
                href="/settings/ai-connections"
                className="w-full py-3 border border-slate-700 hover:border-slate-500 text-slate-300 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center"
              >
                🔧 Connect my own API keys
              </Link>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="text-center text-[11px] text-slate-600 mt-4">
              Own keys = free forever · Platform keys use credit balance
            </p>
          </div>
        </div>
      )}

      {/* ── Clarification modal ──────────────────────────────────────────────── */}
      {showClarification && clarifications.length > 0 && (
        <ClarificationModal
          taskId={id}
          questions={clarifications}
          onComplete={() => {
            setShowClarification(false)
            setTaskStatus('ROUTING')
            addSystemMessage('Answers saved — assembling your team…')
          }}
        />
      )}

      {/* ── Expert review modal ──────────────────────────────────────────────── */}
      {showReviewModal && task && (
        <RequestReviewModal
          taskId={id}
          taskTitle={task.originalGoal}
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            setShowReviewModal(false)
            setReviewToast(true)
            setTimeout(() => setReviewToast(false), 5000)
          }}
        />
      )}

      {/* ── Review toast ─────────────────────────────────────────────────────── */}
      {reviewToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 shadow-2xl flex items-center gap-2">
          <span className="text-amber-400">🎓</span>
          Expert review requested! You'll be notified when ready.
          <button onClick={() => setReviewToast(false)} className="ml-2 text-slate-400 hover:text-slate-200">&times;</button>
        </div>
      )}
    </div>
  )
}
