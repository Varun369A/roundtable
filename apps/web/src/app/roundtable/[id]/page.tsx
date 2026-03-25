'use client'

import { useEffect, useRef, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full bg-[#1e1e2e] text-slate-500 text-xs">Loading editor…</div>
)})
import { useTaskStream, StreamEvent } from '@/hooks/useTaskStream'
import { ClarificationModal } from '@/components/roundtable/ClarificationModal'
import { SteeringInput } from '@/components/roundtable/SteeringInput'
import { ContinueBuilding } from '@/components/roundtable/ContinueBuilding'
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
  PENDING:               { label: 'Queued',      color: 'text-amber-600'   },
  ROUTING:               { label: 'Routing…',    color: 'text-blue-600'    },
  IN_PROGRESS:           { label: 'Live',        color: 'text-indigo-600'  },
  COMPLETED:             { label: 'Complete',    color: 'text-emerald-600' },
  FAILED:                { label: 'Failed',      color: 'text-red-500'     },
  CANCELLED:             { label: 'Cancelled',   color: 'text-slate-400'   },
  WAITING_CLARIFICATION: { label: 'Needs input', color: 'text-amber-600'   },
}

const PHASE_LABELS: Record<Phase, { label: string; description: string; color: string }> = {
  routing:        { label: 'Assembling',   description: 'Selecting the right specialists', color: 'text-blue-600'    },
  planning:       { label: 'Planning',     description: 'Specialists aligning on approach', color: 'text-violet-600'  },
  implementation: { label: 'Building',     description: 'Specialists working in parallel',  color: 'text-indigo-600'  },
  review:         { label: 'Reviewing',    description: 'Cross-checking outputs',           color: 'text-amber-600'   },
  synthesis:      { label: 'Synthesising', description: 'Arivarangam AI building output',   color: 'text-emerald-600' },
  done:           { label: 'Complete',     description: 'Deliverable ready',               color: 'text-emerald-700' },
  failed:         { label: 'Failed',       description: 'Task encountered errors',          color: 'text-red-500'     },
}

// ─── Live Preview ─────────────────────────────────────────────────────────────

function extractBlock(text: string, lang: string): string {
  const re = new RegExp('```(?:' + lang + ')\\s*\\n([\\s\\S]*?)```', 'i')
  return re.exec(text)?.[1]?.trim() ?? ''
}

function LivePreview({ content }: { content: string }) {
  const html = extractBlock(content, 'html')
  const css  = extractBlock(content, 'css')
  const js   = extractBlock(content, 'javascript') || extractBlock(content, 'js') || extractBlock(content, 'tsx') || extractBlock(content, 'jsx')

  const hasPreviewable = !!(html || css)
  if (!hasPreviewable) return null

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}${css}</style></head><body>${html || '<div id="app"></div>'}<script>${js}</script></body></html>`

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-slate-500 font-medium ml-1">Live Preview</span>
        </div>
        <span className="text-[10px] text-slate-400">Sandboxed</span>
      </div>
      <iframe
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin"
        className="w-full"
        style={{ height: '420px', border: 'none' }}
        title="Live Preview"
      />
    </div>
  )
}

// ─── Streaming Message ────────────────────────────────────────────────────────

function StreamingMessage({ text, role }: { text: string; role?: string }) {
  const isSynthesis = role === 'SYNTHESIS'
  const lines = text.split('\n')

  return (
    <div className={`rounded-xl border ${isSynthesis ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 animate-pulse"
          style={{
            backgroundColor: isSynthesis ? '#EEF2FF' : '#F1F5F9',
            color: isSynthesis ? '#6366F1' : '#64748B',
            border: `1.5px solid ${isSynthesis ? '#6366F140' : '#94A3B830'}`,
          }}
        >
          {isSynthesis ? '✦' : '⚙'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              {isSynthesis ? 'Arivarangam AI' : 'Specialist'}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              isSynthesis ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {isSynthesis ? 'Building…' : 'Consulting…'}
            </span>
          </div>
        </div>
        {/* streaming indicator */}
        <div className="flex gap-0.5 items-center shrink-0">
          {[0, 80, 160].map((d) => (
            <div key={d} className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>

      {text && (
        <div className="px-4 pb-3">
          <div className="text-xs text-slate-600 leading-relaxed font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
            {lines.slice(-30).join('\n')}
            <span className="inline-block w-2 h-3.5 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
          </div>
        </div>
      )}
    </div>
  )
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
  tableRadius: number
}

function TableSeat({ model, role, isSpeaking, isDone, messageCount, index, total, tableRadius }: SeatProps) {
  const cfg      = getModelConfig(model)
  const angleDeg = (index / total) * 360 - 90
  const angleRad = (angleDeg * Math.PI) / 180
  const x = 50 + (tableRadius / 2) * Math.cos(angleRad)
  const y = 50 + (tableRadius / 2) * Math.sin(angleRad)
  const isSynthesiser = model === 'sabha-ai' || model === 'arivarangam-ai'
  const displayLabel  = isSynthesiser ? cfg.label : (isSpeaking ? 'Working…' : isDone ? cfg.label : '•••')

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className="relative">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-all duration-300 ${
            isSpeaking ? 'shadow-lg scale-110' : isDone ? 'opacity-90' : 'opacity-50'
          }`}
          style={{
            backgroundColor: cfg.bg,
            borderColor: isSpeaking ? cfg.color : isDone ? `${cfg.color}80` : `${cfg.color}25`,
            boxShadow: isSpeaking ? `0 0 18px ${cfg.color}50` : undefined,
          }}
          title={isDone ? cfg.label : 'Specialist'}
        >
          {isSpeaking || isDone ? cfg.emoji : '🤖'}
        </div>
        {isSpeaking && <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: cfg.color }} />}
        {isDone && !isSpeaking && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: cfg.color, color: '#fff' }}>
            {messageCount > 1 ? messageCount : '✓'}
          </div>
        )}
      </div>
      <div className="text-center max-w-14">
        <div className="text-[10px] font-semibold text-slate-600 whitespace-nowrap leading-tight truncate">{displayLabel}</div>
        {role && isDone && <div className="text-[9px] text-slate-400 capitalize">{role}</div>}
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
  const phaseCfg    = PHASE_LABELS[phase]
  const activeModels = new Set(activeSubtasks.map((s) => s.model))
  const doneModels   = new Map<string, number>()
  for (const m of messages) {
    if (m.type === 'ai' && m.model && !m.isError) doneModels.set(m.model, (doneModels.get(m.model) || 0) + 1)
  }
  const uniqueTeam = team.filter((t, i) => team.findIndex((u) => u.model === t.model) === i)
  const N = uniqueTeam.length

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-64 h-64 shrink-0">
        <div
          className="absolute rounded-full border border-indigo-100"
          style={{
            inset: '18%',
            background: 'radial-gradient(circle at 35% 35%, #eef2ff, #e0e7ff)',
            boxShadow: 'inset 0 2px 12px rgba(99,102,241,0.08), 0 2px 20px rgba(99,102,241,0.06)',
          }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3">
            <span className="text-indigo-600 text-xl mb-0.5">✦</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-0.5">{phaseCfg.label}</span>
            {taskTitle && <span className="text-[9px] text-slate-500 leading-tight line-clamp-2 px-1">{taskTitle}</span>}
            {['routing', 'planning', 'implementation', 'review', 'synthesis'].includes(phase) && (
              <div className="mt-2 flex gap-1">
                {[0, 100, 200].map((d) => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            )}
          </div>
        </div>

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

        {N === 0 && [0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${50 + 43 * Math.cos(((i / 3) * 360 - 90) * Math.PI / 180)}%`,
              top:  `${50 + 43 * Math.sin(((i / 3) * 360 - 90) * Math.PI / 180)}%`,
            }}
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 animate-pulse" />
          </div>
        ))}
      </div>
      <p className={`text-xs font-medium text-center ${phaseCfg.color}`}>{phaseCfg.description}</p>
    </div>
  )
}

// ─── Activity Entry ───────────────────────────────────────────────────────────

function ActivityEntry({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  if (message.type === 'system') {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] text-slate-400 whitespace-nowrap">{message.title}</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
    )
  }

  if (message.type === 'routing_card') return null

  const isSynthesis  = message.role === 'SYNTHESIS'
  const isReview     = message.role === 'REVIEW'
  const displayLabel = isSynthesis ? 'Arivarangam AI' : isReview ? 'Peer review' : 'Specialist output'
  const displayEmoji = isSynthesis ? '✦' : isReview ? '🔍' : '⚙'
  const displayBg    = isSynthesis ? '#EEF2FF' : isReview ? '#FFFBEB' : '#F8FAFC'
  const displayColor = isSynthesis ? '#6366F1' : isReview ? '#D97706' : '#64748B'

  const content   = message.output?.content || ''
  const preview   = content.slice(0, 200)
  const hasMore   = content.length > 200
  const hasCode   = isSynthesis && (content.includes('```html') || content.includes('```css'))

  return (
    <div className={`rounded-xl border transition-all ${
      message.isError    ? 'border-red-200 bg-red-50' :
      isSynthesis        ? 'border-indigo-200 bg-indigo-50/50 shadow-sm' :
      isReview           ? 'border-amber-200 bg-amber-50/50' :
                           'border-slate-200 bg-white'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 font-bold" style={{ backgroundColor: displayBg, color: displayColor, border: `1.5px solid ${displayColor}30` }}>
          {displayEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">{displayLabel}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              isSynthesis ? 'bg-indigo-100 text-indigo-600' :
              isReview    ? 'bg-amber-100 text-amber-700'   :
                            'bg-slate-100 text-slate-500'
            }`}>
              {isSynthesis ? 'Final output' : isReview ? 'Review' : 'Consulting'}
            </span>
          </div>
          {isSynthesis && message.title && <div className="text-[10px] text-slate-500 truncate">{message.title}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasCode && (
            <button
              onClick={() => setShowPreview((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                showPreview ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
              }`}
            >
              {showPreview ? '✕ Preview' : '▶ Preview'}
            </button>
          )}
          {content && (
            <button onClick={() => setExpanded((v) => !v)} className="text-[10px] text-slate-400 hover:text-slate-700 transition-colors">
              {expanded ? 'collapse' : 'expand'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {message.isError ? (
        <p className="px-4 pb-3 text-xs text-red-500">This step encountered an error.</p>
      ) : message.output?.type === 'image' && message.output.fileUrl ? (
        <div className="px-4 pb-3">
          <img src={message.output.fileUrl} alt="Generated" className="rounded-lg max-h-48 w-auto" />
        </div>
      ) : content ? (
        <div className="px-4 pb-3 space-y-3">
          {expanded ? (
            <OutputViewer type={message.output!.type} content={message.output!.content} fileUrl={message.output!.fileUrl} />
          ) : (
            <p className="text-xs text-slate-500 leading-relaxed">
              {preview}{hasMore && !expanded && <span className="text-slate-300">…</span>}
            </p>
          )}
          {/* Live preview */}
          {showPreview && <LivePreview content={content} />}
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

  useEffect(() => {
    if (!hasCode) return
    apiFetch<{ connection: { login: string } | null }>('/api/v1/github/connection').then((r) => {
      setGithubConnected(!!(r.success && (r.data as any)?.connection))
    })
    apiFetch(`/api/v1/code-projects/${taskId}/assemble`, { method: 'POST' })
  }, [taskId, hasCode])

  async function handleDownload() {
    setAssembling(true)
    const response = await fetch(`/api/v1/code-projects/${taskId}/download`, { credentials: 'include' })
    if (!response.ok) { setAssembling(false); return }
    const blob = await response.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `arivarangam-project-${taskId.slice(0, 8)}.zip`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setAssembling(false)
  }

  async function handlePush() {
    if (!repoName.trim()) return
    setPushing(true); setError(null)
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mt-3">
      <p className="text-xs font-semibold text-slate-600 mb-3">Download your project</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={handleDownload} disabled={assembling} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
          {assembling ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '📦'}
          Download ZIP
        </button>
        {pushed ? (
          <a href={pushed} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
            ✓ View on GitHub →
          </a>
        ) : githubConnected === false ? (
          <Link href="/settings/integrations?connect=github" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 hover:border-slate-400 text-slate-600 text-sm font-medium transition-colors">
            🔗 Connect GitHub to push
          </Link>
        ) : githubConnected && !showRepoInput ? (
          <button onClick={() => setShowRepoInput(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 hover:border-indigo-400 text-slate-600 hover:text-indigo-700 text-sm font-medium transition-colors">
            Push to GitHub →
          </button>
        ) : null}
      </div>
      {showRepoInput && !pushed && (
        <div className="mt-3 flex gap-2">
          <input
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="repo-name"
            className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
            onKeyDown={(e) => e.key === 'Enter' && handlePush()}
            autoFocus
          />
          <button onClick={handlePush} disabled={pushing || !repoName.trim()} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {pushing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : 'Push'}
          </button>
          <button onClick={() => setShowRepoInput(false)} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 text-sm transition-colors">✕</button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── Save to Repo Panel ───────────────────────────────────────────────────────

interface RepoOption { id: string; name: string; category: string }

function SaveToRepoPanel({ taskId, taskTitle, content, category }: {
  taskId: string; taskTitle: string; content: string; category: string
}) {
  const [open, setOpen]         = useState(false)
  const [repos, setRepos]       = useState<RepoOption[]>([])
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')
  const [newRepoName, setNewRepoName] = useState('')
  const [mode, setMode]         = useState<'pick' | 'new'>('pick')
  const [error, setError]       = useState<string | null>(null)

  async function openPanel() {
    if (saved) return
    setOpen(true)
    setLoading(true)
    const res = await apiFetch('/api/v1/repos')
    if (res.success && res.data) {
      setRepos(res.data as RepoOption[])
      if ((res.data as RepoOption[]).length === 0) setMode('new')
    }
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      let repoId = selectedId
      if (mode === 'new') {
        if (!newRepoName.trim()) { setError('Enter a repo name'); setSaving(false); return }
        const cr = await apiFetch('/api/v1/repos', {
          method: 'POST',
          body: JSON.stringify({ name: newRepoName.trim(), category, visibility: 'PRIVATE' }),
        })
        if (!cr.success) { setError('Failed to create repo'); setSaving(false); return }
        repoId = (cr.data as any).id
      }
      if (!repoId) { setError('Select a repo'); setSaving(false); return }
      const title = taskTitle.slice(0, 80) || 'Task output'
      const res = await apiFetch(`/api/v1/repos/${repoId}/items`, {
        method: 'POST',
        body: JSON.stringify({ title, category, content }),
      })
      if (!res.success) { setError('Failed to save'); setSaving(false); return }
      setSaved(true)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2 mt-2">
        <span className="text-emerald-600 text-sm">✓ Saved to repo</span>
        <Link href="/repos" className="text-xs text-emerald-700 underline ml-auto">View repos →</Link>
      </div>
    )
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          onClick={openPanel}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 text-sm font-medium transition-colors"
        >
          📁 Save to Repo
        </button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">Save output to a Repo</p>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-3 h-3 border border-slate-300 border-t-indigo-500 rounded-full animate-spin" /> Loading repos…
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('pick')}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${mode === 'pick' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  Existing repo
                </button>
                <button
                  onClick={() => setMode('new')}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${mode === 'new' ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  Create new
                </button>
              </div>

              {mode === 'pick' && (
                repos.length === 0 ? (
                  <p className="text-xs text-slate-400">No repos yet — create one above.</p>
                ) : (
                  <select
                    value={selectedId}
                    onChange={e => setSelectedId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-400"
                  >
                    <option value="">Select a repo…</option>
                    {repos.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )
              )}

              {mode === 'new' && (
                <input
                  value={newRepoName}
                  onChange={e => setNewRepoName(e.target.value)}
                  placeholder="New repo name…"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                  autoFocus
                />
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Specialist Accordion ─────────────────────────────────────────────────────

function SpecialistAccordion({ messages }: { messages: Message[] }) {
  const [open, setOpen] = useState(false)
  const completed = messages.filter((m) => !m.isError).length
  const errors    = messages.filter((m) => m.isError).length

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs shrink-0">⚙</div>
          <span className="text-xs font-semibold text-slate-600">
            {completed} specialist{completed !== 1 ? 's' : ''} contributed
            {errors > 0 && <span className="text-red-400 ml-1">({errors} error{errors !== 1 ? 's' : ''})</span>}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">{open ? 'hide ↑' : 'view ↓'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-200 space-y-2 p-2">
          {messages.map((m) => <ActivityEntry key={m.id} message={m} />)}
        </div>
      )}
    </div>
  )
}

// ─── Quick Actions (Security Audit / Test Generation) ────────────────────────

function QuickActions({ taskId, onStart }: { taskId: string; onStart: (newTaskId: string) => void }) {
  const [running, setRunning] = useState<string | null>(null)

  async function run(actionKey: string, message: string) {
    if (running) return
    setRunning(actionKey)
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      if (data.success) onStart(data.data.task.id)
    } catch { /* ignore */ } finally {
      setRunning(null)
    }
  }

  const ACTIONS = [
    {
      key: 'security',
      icon: '🔒',
      label: 'Security Audit',
      prompt: 'Perform a thorough security audit of the code above. Check for OWASP Top 10 vulnerabilities, authentication flaws, SQL injection, XSS, CSRF, insecure dependencies, hardcoded secrets, and improper error handling. Provide a prioritised list of issues with severity ratings and concrete remediation steps.',
    },
    {
      key: 'tests',
      icon: '🧪',
      label: 'Generate Tests',
      prompt: 'Write comprehensive tests for the code above. Include unit tests for all functions, integration tests for API endpoints, and edge case tests. Use the appropriate testing framework (Jest/Vitest for JS/TS, pytest for Python). Aim for >80% coverage and include mock strategies for external dependencies.',
    },
    {
      key: 'docs',
      icon: '📄',
      label: 'Generate Docs',
      prompt: 'Write complete developer documentation for the project above. Include: README with setup instructions, API reference with request/response examples, architecture overview, environment variable reference, deployment guide, and a contributing guide. Use clear markdown formatting.',
    },
  ]

  return (
    <div className="shrink-0 px-4 py-2 border-t border-slate-100">
      <p className="text-[10px] text-slate-400 mb-2 font-medium uppercase tracking-wide">One-click actions</p>
      <div className="flex gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => run(a.key, a.prompt)}
            disabled={!!running}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 transition-colors disabled:opacity-50"
            title={a.prompt.slice(0, 80) + '…'}
          >
            {running === a.key ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <span>{a.icon}</span>}
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoundtablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [task, setTask]                           = useState<TaskInfo | null>(null)
  const [messages, setMessages]                   = useState<Message[]>([])
  const [streamingTexts, setStreamingTexts]       = useState<Map<string, { text: string; role?: string }>>(new Map())
  const [activeSubtasks, setActiveSubtasks]       = useState<ActiveSubtask[]>([])
  const [taskStatus, setTaskStatus]               = useState<string>('PENDING')
  const [phase, setPhase]                         = useState<Phase>('routing')
  const [team, setTeam]                           = useState<TeamMember[]>([])
  const [hasCodeWorkspace, setHasCodeWorkspace]   = useState(false)
  const [synthesisComplete, setSynthesisComplete] = useState(false)
  const [clarifications, setClarifications]       = useState<any[]>([])
  const [showClarification, setShowClarification] = useState(false)
  const [steeringText, setSteeringText]           = useState('')
  const [showReviewModal, setShowReviewModal]     = useState(false)
  const [reviewToast, setReviewToast]             = useState(false)
  // ── Live preview + file browser
  const [viewMode, setViewMode]                   = useState<'feed' | 'preview' | 'files'>('feed')
  const [livePreviewDoc, setLivePreviewDoc]       = useState<string | null>(null)
  const [projectFiles, setProjectFiles]           = useState<{ path: string; content: string; language: string }[]>([])
  const [selectedFilePath, setSelectedFilePath]   = useState<string | null>(null)
  const [filesLoading, setFilesLoading]           = useState(false)
  const [filesLoaded, setFilesLoaded]             = useState(false)
  // ── Runtime error detection
  const [previewErrors, setPreviewErrors]         = useState<{ message: string; line?: number; stack?: string }[]>([])
  const [showErrorPanel, setShowErrorPanel]       = useState(false)
  const [fixingError, setFixingError]             = useState(false)
  // ── Version history
  const [versionHistory, setVersionHistory]       = useState<{ id: string; title: string; status: string; isRoot: boolean }[]>([])
  const [showVersionMenu, setShowVersionMenu]     = useState(false)
  // ── Vercel deploy
  const [deployUrl, setDeployUrl]                 = useState<string | null>(null)
  const [deploying, setDeploying]                 = useState(false)
  const [showTokenInput, setShowTokenInput]       = useState(false)
  const [vercelToken, setVercelToken]             = useState('')
  const feedRef    = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)

  // Auto-scroll feed to bottom on new content
  const scrollToBottom = useCallback(() => {
    const el = feedRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    if (dist < 400) el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, streamingTexts, scrollToBottom])

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: `sys-${Date.now()}`, type: 'system', title: text, timestamp: new Date() }])
  }

  /** Build a sandboxed HTML doc with injected error reporter for runtime error detection */
  const buildPreviewDocFromContent = useCallback((content: string): string | null => {
    const html = extractBlock(content, 'html')
    const css  = extractBlock(content, 'css')
    const js   = extractBlock(content, 'javascript') || extractBlock(content, 'js') || extractBlock(content, 'tsx') || extractBlock(content, 'jsx')
    if (!html && !css) return null
    // Inject error handler BEFORE user scripts so all errors are caught
    const errorReporter = `<script>(function(){window.onerror=function(m,s,l,c,e){window.parent.postMessage({type:'sabha-preview-error',message:m,line:l,col:c,stack:e&&e.stack},'*');return true};window.addEventListener('unhandledrejection',function(e){window.parent.postMessage({type:'sabha-preview-error',message:e.reason&&e.reason.message||String(e.reason),stack:e.reason&&e.reason.stack},'*')})})();</script>`
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${errorReporter}<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}${css}</style></head><body>${html || '<div id="app"></div>'}<script>${js}</script></body></html>`
  }, [])

  const loadProjectFiles = useCallback(async () => {
    if (filesLoaded) return
    setFilesLoading(true)
    try {
      const res = await apiFetch<{ project: { files: { path: string; content: string; language: string }[] } | null }>(
        `/api/v1/code-projects/${id}`
      )
      if (res.success && res.data?.project?.files?.length) {
        setProjectFiles(res.data.project.files)
        if (!selectedFilePath) setSelectedFilePath(res.data.project.files[0]?.path ?? null)
      }
    } finally {
      setFilesLoaded(true)
      setFilesLoading(false)
    }
  }, [id, filesLoaded, selectedFilePath])

  /** Auto-fix: send the first runtime error back through the continue endpoint */
  const handleAutoFix = useCallback(async () => {
    if (!previewErrors.length || fixingError) return
    const err = previewErrors[0]
    setFixingError(true)
    try {
      const message = `Fix this runtime JavaScript error in the preview:\n\nError: ${err.message}${err.line ? ` (line ${err.line})` : ''}${err.stack ? `\n\nStack:\n${err.stack.slice(0, 400)}` : ''}\n\nFind and fix the root cause in the code. Do not just wrap in try/catch.`
      const res = await apiFetch<{ task: { id: string } }>(`/api/v1/tasks/${id}/continue`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      })
      if (res.success && res.data?.task?.id) {
        window.location.href = `/roundtable/${res.data.task.id}`
      }
    } catch {
      // non-fatal
    } finally {
      setFixingError(false)
    }
  }, [id, previewErrors, fixingError])

  /** Deploy to Vercel */
  const handleVercelDeploy = useCallback(async (token: string) => {
    setDeploying(true)
    try {
      const res = await apiFetch<{ deploymentUrl: string }>(`/api/v1/deploy/vercel/${id}`, {
        method: 'POST',
        body: JSON.stringify({ token: token || undefined }),
      })
      if (res.success && res.data?.deploymentUrl) {
        setDeployUrl(res.data.deploymentUrl)
        setShowTokenInput(false)
        setVercelToken('')
      }
    } catch {
      // non-fatal
    } finally {
      setDeploying(false)
    }
  }, [id])

  // ── Listen for runtime errors from Live Preview iframe via postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'sabha-preview-error') {
        const { message, line, stack } = e.data
        setPreviewErrors((prev) => {
          // Deduplicate — don't add the same error repeatedly
          if (prev.some((p) => p.message === message)) return prev
          return [...prev, { message, line, stack }]
        })
        setShowErrorPanel(true)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // ── Clear preview errors when a new preview doc is generated
  useEffect(() => {
    setPreviewErrors([])
    setShowErrorPanel(false)
  }, [livePreviewDoc])

  // ── Load version history when task is terminal
  useEffect(() => {
    if (!['COMPLETED', 'FAILED'].includes(taskStatus)) return
    apiFetch<{ history: { id: string; title: string; status: string; isRoot: boolean }[] }>(
      `/api/v1/tasks/${id}/history`
    ).then((res) => {
      if (res.success && res.data?.history && res.data.history.length > 1) {
        setVersionHistory(res.data.history)
      }
    }).catch(() => {})
  }, [id, taskStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load deployment info when task completes with code workspace
  useEffect(() => {
    if (taskStatus !== 'COMPLETED' || !hasCodeWorkspace) return
    apiFetch<{ vercelUrl: string | null }>(`/api/v1/deploy/${id}`).then((res) => {
      if (res.success && res.data?.vercelUrl) setDeployUrl(res.data.vercelUrl)
    }).catch(() => {})
  }, [id, taskStatus, hasCodeWorkspace]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load task + auto-start
  useEffect(() => {
    async function init() {
      const result = await apiFetch<{ task: TaskInfo }>(`/api/v1/tasks/${id}`)
      if (!result.success || !result.data) { router.push('/dashboard'); return }
      const t = (result.data as any).task
      setTask(t)
      setTaskStatus(t.status)
      if (t.status === 'COMPLETED') setPhase('done')
      else if (t.status === 'FAILED') setPhase('failed')

      // ── Backfill output for already-completed/failed tasks ──────────────
      // The API returns subtasks+outputs in the same call. Use them to populate
      // the feed so the user sees results immediately without waiting for SSE.
      if (t.status === 'COMPLETED' || t.status === 'FAILED') {
        const subtasks: any[] = t.subtasks || []

        // Build the team sidebar from all subtasks
        if (subtasks.length > 0) {
          setTeam(subtasks.map((s: any) => ({
            subtaskId:      s.id,
            title:          s.title,
            model:          s.assignedModel?.replace(/_/g, '-') ?? '',
            category:       s.category,
            executionOrder: s.executionOrder,
          })))
        }

        // Populate messages from completed subtask outputs
        const backfilled: Message[] = subtasks
          .filter((s: any) => s.status === 'COMPLETED' && s.output)
          .sort((a: any, b: any) => a.executionOrder - b.executionOrder)
          .map((s: any) => ({
            id:          s.id,
            type:        'ai' as const,
            model:       s.assignedModel?.replace(/_/g, '-'),
            title:       s.title,
            output:      s.output ? {
              type:    s.output.type,
              content: s.output.content,
              fileUrl: s.output.fileUrl,
            } : undefined,
            timestamp:   new Date(s.completedAt || s.createdAt),
            role:        s.role,
            roundNumber: s.roundNumber,
          }))

        if (backfilled.length > 0) setMessages(backfilled)

        // Build live preview from synthesis output (best previewable content)
        const synthSubtask = subtasks.find((s: any) => s.role === 'SYNTHESIS' && s.output?.content)
        if (synthSubtask?.output?.content) {
          const doc = buildPreviewDocFromContent(synthSubtask.output.content)
          if (doc) setLivePreviewDoc(doc)
        } else {
          // Try any completed subtask with html/css
          for (const s of [...subtasks].reverse()) {
            if (s.output?.content) {
              const doc = buildPreviewDocFromContent(s.output.content)
              if (doc) { setLivePreviewDoc(doc); break }
            }
          }
        }

        // Show download/GitHub panel if any output contains code
        const hasCode = subtasks.some((s: any) =>
          s.output?.content && (s.output.content.includes('```') || s.category === 'code')
        )
        if (hasCode && t.status === 'COMPLETED') setHasCodeWorkspace(true)

        return  // no SSE needed for terminal tasks
      }

      if (t.status === 'PENDING' && !hasStarted.current) {
        hasStarted.current = true
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
        if (event.status) {
          setTaskStatus(event.status)
          if (event.status === 'FAILED')    setPhase('failed')
          else if (event.status === 'COMPLETED') setPhase('done')
          else if (event.status === 'CANCELLED') { /* phase stays as-is */ }
        }
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
          if (event.role === 'REVIEW')     setPhase('review')
          else if (event.role === 'SYNTHESIS') setPhase('synthesis')
          else setPhase((prev) => (prev === 'planning' || prev === 'routing') ? 'implementation' : prev)
        }
        break

      // NEW: AI started streaming tokens
      case 'subtask_streaming':
        if (event.subtaskId) {
          const activeSubtask = event.subtaskId
          setActiveSubtasks((prev) => prev.map((s) =>
            s.subtaskId === activeSubtask ? s : s
          ))
          setStreamingTexts((prev) => {
            const next = new Map(prev)
            if (!next.has(activeSubtask)) {
              next.set(activeSubtask, { text: '', role: undefined })
            }
            return next
          })
        }
        break

      // NEW: Token chunk arrived
      case 'subtask_token':
        if (event.subtaskId && event.chunk) {
          setStreamingTexts((prev) => {
            const next = new Map(prev)
            const existing = next.get(event.subtaskId!) || { text: '', role: undefined }
            next.set(event.subtaskId!, { ...existing, text: existing.text + event.chunk })
            return next
          })
          scrollToBottom()
        }
        break

      case 'subtask_completed':
        setActiveSubtasks((prev) => prev.filter((s) => s.subtaskId !== event.subtaskId))
        setStreamingTexts((prev) => { const next = new Map(prev); next.delete(event.subtaskId!); return next })
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
        // Auto-update live preview if this subtask has HTML/CSS
        if ((event.output as any)?.content) {
          const doc = buildPreviewDocFromContent((event.output as any).content)
          if (doc) setLivePreviewDoc(doc)
        }
        break

      case 'subtask_failed':
        setActiveSubtasks((prev) => prev.filter((s) => s.subtaskId !== event.subtaskId))
        setStreamingTexts((prev) => { const next = new Map(prev); next.delete(event.subtaskId!); return next })
        setMessages((prev) => [
          ...prev,
          { id: event.subtaskId || `err-${Date.now()}`, type: 'ai', isError: true, title: 'A step encountered an error', timestamp: new Date() },
        ])
        break

      case 'discussion_round_started':
        setPhase('review')
        addSystemMessage('Cross-reviewing outputs…')
        break

      case 'synthesis_started':
        setPhase('synthesis')
        addSystemMessage('Arivarangam AI is building your output…')
        break

      case 'synthesis_complete':
        setSynthesisComplete(true)
        break

      case 'task_completed':
        setTaskStatus('COMPLETED')
        setPhase('done')
        setActiveSubtasks([])
        setStreamingTexts(new Map())
        if (event.hasCodeWorkspace) setHasCodeWorkspace(true)
        addSystemMessage('Done — your deliverable is ready')
        break

      case 'task_failed':
        setTaskStatus('FAILED')
        setPhase('failed')
        setActiveSubtasks([])
        setStreamingTexts(new Map())
        addSystemMessage('Task encountered errors. Partial results are shown below.')
        break

      case 'task_cancelled':
        setTaskStatus('CANCELLED')
        setActiveSubtasks([])
        setStreamingTexts(new Map())
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
  }, [scrollToBottom, buildPreviewDocFromContent])

  const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(taskStatus)
  const { connected } = useTaskStream({ taskId: id, onEvent: handleStreamEvent, enabled: !!task && !isTerminal })

  const statusCfg  = STATUS_LABEL[taskStatus] || STATUS_LABEL.PENDING
  const isLive     = ['ROUTING', 'IN_PROGRESS'].includes(taskStatus)
  const activityMessages   = messages.filter((m) => m.type !== 'routing_card')
  const synthesisMsg       = messages.find((m) => m.role === 'SYNTHESIS')
  const specialistMessages = activityMessages.filter((m) => m.type === 'ai' && m.role !== 'SYNTHESIS')
  const systemMessages     = activityMessages.filter((m) => m.type === 'system')
  const synthesisMessages  = activityMessages.filter((m) => m.role === 'SYNTHESIS')

  return (
    <div className="h-screen flex flex-col bg-white text-slate-900 overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-700 text-sm shrink-0 transition-colors flex items-center gap-1">
            ← Dashboard
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <p className="flex-1 text-sm font-medium truncate text-slate-700">{task?.originalGoal || '…'}</p>
          <div className="flex items-center gap-3 shrink-0">
            {/* Version history dropdown */}
            {versionHistory.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setShowVersionMenu((v) => !v)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  v{versionHistory.findIndex((v) => v.id === id) + 1}/{versionHistory.length}
                  <span className="text-[10px]">▾</span>
                </button>
                {showVersionMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[220px] overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Version History</div>
                    {versionHistory.map((v, i) => (
                      <a
                        key={v.id}
                        href={`/roundtable/${v.id}`}
                        className={`flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${v.id === id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700'}`}
                      >
                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span className="truncate flex-1">{v.title.replace('[Continued] ', '')}</span>
                        <span className={`text-[9px] px-1 py-0.5 rounded-full ${
                          v.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' :
                          v.status === 'FAILED'    ? 'bg-red-100 text-red-500' :
                                                     'bg-amber-100 text-amber-600'
                        }`}>{v.status === 'COMPLETED' ? '✓' : v.status === 'FAILED' ? '✕' : '…'}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Connection indicator */}
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${connected ? 'bg-emerald-400' : 'bg-slate-300'}`} title={connected ? 'Connected' : 'Reconnecting…'} />

            {!['COMPLETED', 'FAILED', 'CANCELLED'].includes(taskStatus) && (
              <button
                onClick={async () => {
                  if (!confirm('Cancel this task?')) return
                  await apiFetch(`/api/v1/tasks/${id}`, { method: 'DELETE' })
                  router.push('/dashboard')
                }}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
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

        {/* ── Left sidebar: Round Table + Phase ─────────────────────────────── */}
        <div className="hidden md:flex w-72 shrink-0 flex-col items-center border-r border-slate-100 bg-slate-50 py-8 px-4 gap-6 overflow-y-auto">
          <RoundTable
            team={team}
            activeSubtasks={activeSubtasks}
            messages={messages}
            phase={phase}
            taskTitle={task?.originalGoal}
          />

          {/* Phase timeline */}
          <div className="w-full space-y-1">
            {(['routing', 'planning', 'implementation', 'review', 'synthesis', 'done'] as Phase[]).map((p) => {
              const cfg    = PHASE_LABELS[p]
              const phases = ['routing', 'planning', 'implementation', 'review', 'synthesis', 'done'] as Phase[]
              const cur    = phases.indexOf(phase)
              const idx    = phases.indexOf(p)
              const isAct  = phase === p
              const isPast = idx < cur
              return (
                <div
                  key={p}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
                    isAct ? 'bg-white border border-indigo-100 shadow-sm' : isPast ? 'opacity-60' : 'opacity-25'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                      isPast   ? 'bg-emerald-100 text-emerald-600' :
                      isAct    ? 'bg-indigo-100 text-indigo-600'   :
                                 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isPast ? '✓' : idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold truncate ${isAct ? cfg.color : 'text-slate-600'}`}>{cfg.label}</div>
                    {isAct && <div className="text-[10px] text-slate-400 leading-tight">{cfg.description}</div>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Specialist note */}
          <div className="w-full text-center text-[10px] text-slate-400 px-2 leading-relaxed">
            Specialists consult internally. Arivarangam AI builds your final output.
          </div>
        </div>

        {/* ── Right main: streaming feed ─────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* ── Tab bar ─────────────────────────────────────────────────────── */}
          <div className="shrink-0 flex items-center gap-1 px-4 pt-2 pb-0 border-b border-slate-100 bg-white">
            <button
              onClick={() => setViewMode('feed')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
                viewMode === 'feed'
                  ? 'bg-white border border-b-white border-slate-200 text-slate-800 -mb-px'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              Activity
            </button>
            {livePreviewDoc && (
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-white border border-b-white border-slate-200 text-indigo-700 -mb-px'
                    : 'text-slate-400 hover:text-indigo-600'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Preview
              </button>
            )}
            {hasCodeWorkspace && (
              <button
                onClick={() => { setViewMode('files'); loadProjectFiles() }}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
                  viewMode === 'files'
                    ? 'bg-white border border-b-white border-slate-200 text-slate-800 -mb-px'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                Files
              </button>
            )}
          </div>

          {/* ── Live Preview panel ───────────────────────────────────────────── */}
          {viewMode === 'preview' && livePreviewDoc && (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50 relative">
              <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <span className="text-xs text-slate-500 font-medium ml-1">Live Preview</span>
                  {previewErrors.length > 0 && (
                    <button
                      onClick={() => setShowErrorPanel((v) => !v)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold hover:bg-red-200 transition-colors"
                    >
                      ⚠ {previewErrors.length} error{previewErrors.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">Sandboxed · auto-refreshes</span>
                  <button
                    onClick={() => {
                      const w = window.open('', '_blank')
                      if (w) { w.document.write(livePreviewDoc); w.document.close() }
                    }}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors"
                  >
                    ↗ Pop out
                  </button>
                </div>
              </div>

              {/* Runtime error panel */}
              {showErrorPanel && previewErrors.length > 0 && (
                <div className="shrink-0 bg-red-950 border-b border-red-800 px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-red-300">Runtime Errors</span>
                    <button onClick={() => setShowErrorPanel(false)} className="text-red-400 hover:text-red-200 text-xs">✕</button>
                  </div>
                  {previewErrors.slice(0, 3).map((err, i) => (
                    <div key={i} className="text-[11px] text-red-200 font-mono bg-red-900/50 rounded px-2 py-1 leading-relaxed">
                      {err.message}{err.line ? ` (line ${err.line})` : ''}
                    </div>
                  ))}
                  {taskStatus === 'COMPLETED' && (
                    <button
                      onClick={handleAutoFix}
                      disabled={fixingError}
                      className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                    >
                      {fixingError ? (
                        <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Launching auto-fix…</>
                      ) : (
                        <><span>✦</span> Auto-fix with AI</>
                      )}
                    </button>
                  )}
                </div>
              )}

              <iframe
                key={livePreviewDoc}
                srcDoc={livePreviewDoc}
                sandbox="allow-scripts allow-same-origin"
                className="flex-1 w-full"
                style={{ border: 'none' }}
                title="Live Preview"
              />
            </div>
          )}

          {/* ── File browser panel ───────────────────────────────────────────── */}
          {viewMode === 'files' && (
            <div className="flex-1 flex min-h-0">
              {/* File tree */}
              <div className="w-56 shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto py-2">
                {filesLoading ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">Loading files…</div>
                ) : projectFiles.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">No files assembled yet.</div>
                ) : (
                  <div className="space-y-0.5 px-1">
                    {projectFiles.map((f) => (
                      <button
                        key={f.path}
                        onClick={() => setSelectedFilePath(f.path)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono truncate transition-colors ${
                          selectedFilePath === f.path
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                        title={f.path}
                      >
                        {f.path}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* File content — Monaco editor */}
              <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e2e]">
                {selectedFilePath ? (() => {
                  const file = projectFiles.find((f) => f.path === selectedFilePath)
                  if (!file) return null
                  return (
                    <>
                      <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[#181825] border-b border-white/10">
                        <span className="text-xs text-slate-400 font-mono truncate flex-1">{file.path}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(file.content)}
                          className="text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 transition-colors shrink-0"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="flex-1 min-h-0">
                        <MonacoEditor
                          height="100%"
                          language={file.language || 'plaintext'}
                          value={file.content}
                          theme="vs-dark"
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 12,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            automaticLayout: true,
                          }}
                        />
                      </div>
                    </>
                  )
                })() : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-500">
                    Select a file to view
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Feed scroll area */}
          <div ref={feedRef} className={`flex-1 overflow-y-auto px-4 py-4 space-y-2 scroll-smooth ${viewMode !== 'feed' ? 'hidden' : ''}`}>

            {activityMessages.length === 0 && streamingTexts.size === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-3xl mb-4">✦</div>
                <p className="text-slate-500 text-sm font-medium">Arivarangam AI is assembling your specialists…</p>
                <p className="text-slate-400 text-xs mt-2">Results will appear here in real time</p>
              </div>
            )}

            {/* System event dividers */}
            {systemMessages.map((msg) => (
              <ActivityEntry key={msg.id} message={msg} />
            ))}

            {/* Specialist work — collapsed accordion (INITIAL + REVIEW) */}
            {specialistMessages.length > 0 && (
              <SpecialistAccordion messages={specialistMessages} />
            )}

            {/* Synthesis — always shown prominently */}
            {synthesisMessages.map((msg) => (
              <ActivityEntry key={msg.id} message={msg} />
            ))}

            {/* Active streaming subtasks */}
            {Array.from(streamingTexts.entries()).map(([subtaskId, { text, role }]) => {
              const active = activeSubtasks.find((s) => s.subtaskId === subtaskId)
              return (
                <StreamingMessage key={subtaskId} text={text} role={active?.role || role} />
              )
            })}

            {/* Delivery panel for code workspaces */}
            {hasCodeWorkspace && taskStatus === 'COMPLETED' && (
              <>
                <DeliveryPanel taskId={id} hasCode />
                {/* Vercel deploy */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mt-2">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Deploy to Vercel</p>
                  {deployUrl ? (
                    <a href={deployUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                      ✓ View deployment →
                    </a>
                  ) : showTokenInput ? (
                    <div className="flex gap-2">
                      <input
                        value={vercelToken}
                        onChange={(e) => setVercelToken(e.target.value)}
                        placeholder="Vercel token (vercel.com/account/tokens)"
                        type="password"
                        className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                        onKeyDown={(e) => e.key === 'Enter' && handleVercelDeploy(vercelToken)}
                        autoFocus
                      />
                      <button
                        onClick={() => handleVercelDeploy(vercelToken)}
                        disabled={deploying || !vercelToken.trim()}
                        className="px-3 py-2 rounded-lg bg-black hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                      >
                        {deploying ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : 'Deploy'}
                      </button>
                      <button onClick={() => setShowTokenInput(false)} className="px-2 py-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 text-xs">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowTokenInput(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white text-sm font-semibold transition-colors"
                    >
                      ▲ Deploy to Vercel
                    </button>
                  )}
                  {!deployUrl && !showTokenInput && (
                    <p className="text-[10px] text-slate-400 mt-1.5">Need a token? vercel.com/account/tokens</p>
                  )}
                </div>
              </>
            )}

            {/* Save to Repo — available for all completed tasks */}
            {taskStatus === 'COMPLETED' && synthesisMsg && (
              <SaveToRepoPanel
                taskId={id}
                taskTitle={task?.originalGoal ?? ''}
                content={synthesisMsg.output?.content ?? ''}
                category={task?.template?.category === 'development' ? 'CODE' : 'CONTENT'}
              />
            )}

            {/* ── One-click actions — Security Audit + Test Generation ─────────── */}
            {taskStatus === 'COMPLETED' && task && (
              <QuickActions taskId={id} onStart={(taskId) => router.push(`/roundtable/${taskId}`)} />
            )}

            {/* ── Continue Building — shown after task completes ───────────────── */}
            {(taskStatus === 'COMPLETED' || taskStatus === 'FAILED') && task && (
              <ContinueBuilding
                taskId={id}
                originalGoal={task.originalGoal}
              />
            )}

            <div className="h-4" />
          </div>

          {/* ── Bottom controls ──────────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 space-y-2">

            {/* Reconnect notice */}
            {!connected && isLive && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Reconnecting to live stream…
              </div>
            )}

            <div className="flex items-center gap-2">
              <SteeringInput
                taskId={id}
                isVisible={isLive}
                initialText={steeringText}
                onTextChange={setSteeringText}
              />
              <VoiceInputButton
                onTranscription={(text) => setSteeringText((v) => v + text)}
                disabled={!isLive}
              />
              {taskStatus === 'COMPLETED' && (
                <>
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="shrink-0 px-3 py-2 rounded-lg border border-slate-200 hover:border-indigo-300 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
                    title="Request expert review"
                  >
                    ✦ Review
                  </button>
                  {reviewToast && (
                    <span className="text-xs text-emerald-600 font-medium">Request sent ✓</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      {showClarification && (
        <ClarificationModal
          taskId={id}
          questions={clarifications}
          onComplete={() => {
            setShowClarification(false)
            setTaskStatus('IN_PROGRESS')
            addSystemMessage('Continuing with your answers…')
          }}
        />
      )}

      {showReviewModal && (
        <RequestReviewModal
          taskId={id}
          taskTitle={task?.originalGoal ?? ''}
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            setShowReviewModal(false)
            setReviewToast(true)
            setTimeout(() => setReviewToast(false), 3000)
          }}
        />
      )}
    </div>
  )
}
