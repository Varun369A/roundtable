'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import NotificationBell from '@/components/NotificationBell'
import CreditBadge from '@/components/credits/CreditBadge'
import SessionExpiryWarning from '@/components/auth/SessionExpiryWarning'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string
  title: string
  status: string
  visibility: string
  templateId?: string
  createdAt: string
  _count?: { subtasks: number }
}

interface UserProfile {
  isEmailVerified: boolean
  email: string
}

interface Template {
  id: string
  name: string
  description: string
  category: string
  icon: string
  color: string
  agents: { role: string }[]
  examplePrompts: string[]
}

interface Workspace {
  id: string
  name: string
  type: string
  role: string
  memberCount: number
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:     'text-yellow-400 bg-yellow-400/10',
  ROUTING:     'text-blue-400 bg-blue-400/10',
  IN_PROGRESS: 'text-indigo-400 bg-indigo-400/10',
  COMPLETED:   'text-emerald-400 bg-emerald-400/10',
  FAILED:      'text-red-400 bg-red-400/10',
  CANCELLED:   'text-zinc-500 bg-zinc-500/10',
}

const CAT_ICONS: Record<string, string> = {
  development: '💻', design: '🎨', learning: '🎓', marketing: '📣',
  business: '💼', content: '✍️', research: '📊', personal: '🌱',
}

// ─── Template Quick-Pick ──────────────────────────────────────────────────────

function TemplatePicker({ onSelect }: { onSelect: (t: Template) => void }) {
  const [featured, setFeatured] = useState<Template[]>([])

  useEffect(() => {
    apiFetch('/api/v1/templates?limit=8')
      .then((data) => { if (data.success) setFeatured(data.data as any) })
  }, [])

  if (featured.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-zinc-400">Or start with a template</p>
        <Link href="/templates" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          Browse all →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {featured.slice(0, 8).map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="text-left p-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/5 hover:border-white/10 transition-all group"
          >
            <span className="text-xl block mb-1.5">{t.icon}</span>
            <p className="text-xs font-medium text-white leading-tight line-clamp-1">{t.name}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{t.agents.length} AIs</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Workspace Badge ──────────────────────────────────────────────────────────

function WorkspaceBadge({ workspaces, active, onSwitch }: {
  workspaces: Workspace[]
  active: Workspace | null
  onSwitch: (ws: Workspace) => void
}) {
  const [open, setOpen] = useState(false)

  if (!active) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-sm text-white transition-colors"
      >
        <span className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
          {active.name[0]}
        </span>
        <span className="text-xs max-w-32 truncate">{active.name}</span>
        <span className="text-zinc-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 bg-[#111] border border-white/10 rounded-xl shadow-xl min-w-48 z-20 overflow-hidden">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => { onSwitch(ws); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors ${
                ws.id === active.id ? 'text-white' : 'text-zinc-400'
              }`}
            >
              <span className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                {ws.name[0]}
              </span>
              <div>
                <p className="text-xs font-medium">{ws.name}</p>
                <p className="text-[10px] text-zinc-600">{ws.type === 'PERSONAL' ? 'Personal' : `${ws.memberCount} members`}</p>
              </div>
              {ws.id === active.id && <span className="ml-auto text-indigo-400 text-xs">✓</span>}
            </button>
          ))}
          <div className="border-t border-white/5 px-4 py-2">
            <Link href="/workspace/settings" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Workspace settings →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [goal, setGoal] = useState('')
  const [creating, setCreating] = useState(false)
  const [detectedLang, setDetectedLang] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [visibility, setVisibility] = useState<'private' | 'workspace'>('private')
  const [createError, setCreateError] = useState('')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [verificationResent, setVerificationResent] = useState(false)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const detectTimeout = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) { router.push('/login'); return }
    fetchAll()
  }, [])

  async function fetchAll() {
    const [taskRes, wsRes, meRes, creditRes] = await Promise.allSettled([
      apiFetch('/api/v1/tasks'),
      apiFetch('/api/v1/workspaces/my'),
      apiFetch<{ user: { isEmailVerified: boolean; email: string } }>('/api/v1/auth/me'),
      apiFetch<{ wallet: { balance: number } }>('/api/v1/credits/wallet'),
    ])

    if (taskRes.status === 'fulfilled' && taskRes.value.success) {
      setTasks((taskRes.value.data as any).tasks || taskRes.value.data || [])
    }

    if (wsRes.status === 'fulfilled' && wsRes.value.success) {
      const wsList: Workspace[] = wsRes.value.data as any
      setWorkspaces(wsList)
      setActiveWorkspace(wsList[0] || null)
    }

    if (meRes.status === 'fulfilled' && meRes.value.success) {
      const u = meRes.value.data?.user
      if (u) setUserProfile({ isEmailVerified: u.isEmailVerified, email: u.email })
    }

    if (creditRes.status === 'fulfilled' && creditRes.value.success && creditRes.value.data) {
      setCreditBalance(creditRes.value.data.wallet.balance)
    }

    setLoading(false)
  }

  async function handleResendVerification() {
    setResendingVerification(true)
    try {
      const data = await apiFetch('/api/v1/auth/resend-verification', { method: 'POST' })
      if (data.success) setVerificationResent(true)
    } catch { /* ignore */ } finally {
      setResendingVerification(false)
    }
  }

  // Debounced language detection
  useEffect(() => {
    if (!goal.trim() || goal.length < 10) { setDetectedLang(null); return }
    clearTimeout(detectTimeout.current)
    detectTimeout.current = setTimeout(async () => {
      try {
        const data = await apiFetch('/api/v1/language/detect', {
          method: 'POST',
          body: JSON.stringify({ text: goal }),
        })
        if (data.success && (data.data as any)?.language?.needsTranslation) {
          setDetectedLang((data.data as any).language.name)
        } else {
          setDetectedLang(null)
        }
      } catch { /* ignore */ }
    }, 600)
    return () => clearTimeout(detectTimeout.current)
  }, [goal])

  const handleSwitchWorkspace = async (ws: Workspace) => {
    setActiveWorkspace(ws)
    await apiFetch('/api/v1/workspaces/current', {
      method: 'PUT',
      body: JSON.stringify({ workspaceId: ws.id }),
    })
    // Re-fetch tasks for this workspace
    const res = await apiFetch('/api/v1/tasks')
    if (res.success) setTasks((res.data as any).tasks || res.data || [])
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    const goalText = goal.trim()
    if (!goalText) return
    setCreating(true)
    setCreateError('')

    try {
      const body: Record<string, unknown> = { goal: goalText, visibility }
      if (selectedTemplate) body.templateId = selectedTemplate.id
      if (activeWorkspace && visibility === 'workspace') body.workspaceId = activeWorkspace.id

      const data = await apiFetch('/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (data.success) {
        setGoal('')
        setSelectedTemplate(null)
        router.push(`/roundtable/${(data.data as any).task.id}`)
      } else {
        setCreateError(data.error?.message || 'Failed to create task')
      }
    } catch {
      setCreateError('Network error — please try again')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/5 sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <span className="text-lg font-bold">Arivarangam<span className="text-indigo-500">.</span></span>
        <nav role="navigation" aria-label="Main navigation" className="flex items-center gap-3">
          <WorkspaceBadge
            workspaces={workspaces}
            active={activeWorkspace}
            onSwitch={handleSwitchWorkspace}
          />
          <Link href="/people" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">People</Link>
          <Link href="/friends" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Friends</Link>
          <Link href="/messages" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Messages</Link>
          <Link href="/repos" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Repos</Link>
          <Link href="/templates" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Templates</Link>
          <Link href="/marketplace" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Marketplace</Link>
          <Link href="/marketplace/experts" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Experts</Link>
          <Link href="/packs" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">AI Packs</Link>
          <Link href="/settings/ai-connections" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">AI Keys</Link>
          <Link href="/settings/roundtable" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Roundtable</Link>
          <Link href="/settings/language" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Language</Link>
          <Link href="/settings/billing" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Billing</Link>
          <Link href="/workflows" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Workflows</Link>
          <Link href="/dashboard/scheduled" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Scheduled</Link>
          <Link href="/credits" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Credits</Link>
          <CreditBadge />
          <NotificationBell />
        </nav>
      </header>

      <main id="main-content" className="max-w-3xl mx-auto px-6 py-10">

        {/* Email verification banner */}
        {userProfile && !userProfile.isEmailVerified && !verificationResent && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 mb-6 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-3">
              <span className="text-yellow-400 flex-shrink-0">⚠</span>
              <p className="text-sm text-yellow-300">
                Please verify your email address to unlock all Arivarangam features.
              </p>
            </div>
            <button
              onClick={handleResendVerification}
              disabled={resendingVerification}
              className="flex-shrink-0 text-xs text-yellow-400 hover:text-yellow-300 underline underline-offset-2 transition-colors disabled:opacity-50"
            >
              {resendingVerification ? 'Sending…' : 'Resend verification email'}
            </button>
          </div>
        )}
        {verificationResent && (
          <div className="flex items-center gap-3 px-4 py-3 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-emerald-400">✓</span>
            <p className="text-sm text-emerald-300">Verification email sent — check your inbox.</p>
          </div>
        )}

        {/* Active workspace context */}
        {activeWorkspace && (
          <div className="flex items-center gap-2 mb-6">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0" />
            <p className="text-sm text-zinc-500">
              Working in <span className="text-zinc-300 font-medium">{activeWorkspace.name}</span>
              {activeWorkspace.type === 'PERSONAL' && (
                <span className="ml-2 text-xs text-zinc-600">(private)</span>
              )}
            </p>
          </div>
        )}

        {/* Task creation */}
        <form onSubmit={createTask} aria-label="Create a new Roundtable task" className="mb-10">
          {/* Selected template indicator */}
          {selectedTemplate && (
            <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <span className="text-lg">{selectedTemplate.icon}</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-indigo-300">{selectedTemplate.name} template</p>
                <p className="text-[10px] text-zinc-500">{selectedTemplate.agents.length} AIs in sequence</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          <label htmlFor="goal-input" className="block text-sm text-zinc-400 mb-3">
            {selectedTemplate
              ? `Describe your ${selectedTemplate.name.toLowerCase()} goal`
              : 'What do you want to accomplish?'}
          </label>

          <div className="flex gap-3 mb-3">
            <textarea
              id="goal-input"
              aria-required="true"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-white/20 focus:outline-none transition-colors text-white placeholder-zinc-600 resize-none text-sm"
              placeholder={
                selectedTemplate
                  ? selectedTemplate.name === 'Web App Development'
                    ? 'Build a SaaS expense tracker with team collaboration…'
                    : `Describe your ${selectedTemplate.name.toLowerCase()} goal…`
                  : 'Create a marketing campaign for my chai brand targeting college students…'
              }
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  if (goal.trim()) createTask(e as unknown as React.FormEvent)
                }
              }}
            />
          </div>

          {/* Low-credit warning */}
          {creditBalance !== null && creditBalance < 50 && (
            <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 text-sm">
              <span className="text-amber-300 flex items-center gap-2">
                <span aria-hidden="true">⚠</span>
                <span>Low credits (<strong>{creditBalance}</strong> remaining). This task may cost 10–30 credits.</span>
              </span>
              <Link href="/credits" className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors whitespace-nowrap">
                Buy credits →
              </Link>
            </div>
          )}

          {/* Controls row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Visibility toggle */}
              <button
                type="button"
                onClick={() => setVisibility((v) => v === 'private' ? 'workspace' : 'private')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  visibility === 'workspace'
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                    : 'bg-white/5 text-zinc-500 border border-white/5'
                }`}
              >
                {visibility === 'private' ? '🔒 Private' : '👥 Workspace'}
              </button>

              {detectedLang && (
                <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">
                  {detectedLang} detected
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={creating || !goal.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-sm font-semibold transition-all active:scale-95 whitespace-nowrap"
            >
              {creating ? 'Starting…' : selectedTemplate ? `Start ${selectedTemplate.icon}` : 'Start Roundtable'}
            </button>
          </div>

          {createError && <p role="alert" className="text-red-400 text-xs mt-2">{createError}</p>}
        </form>

        {/* Template quick-pick */}
        <TemplatePicker onSelect={(t) => {
          setSelectedTemplate(t)
          // Auto-set a relevant example prompt if goal is empty
          if (!goal.trim() && t.examplePrompts.length > 0) {
            setGoal(t.examplePrompts[0])
          }
        }} />

        {/* Task History */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Recent tasks</h2>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              {activeWorkspace?.type === 'PERSONAL' ? (
                <span className="flex items-center gap-1">🔒 Personal workspace — only you can see these</span>
              ) : (
                <span className="flex items-center gap-1">
                  <span>🔒 private</span>
                  <span className="text-zinc-700">·</span>
                  <span>👥 shared</span>
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <p className="text-3xl mb-3">✨</p>
              <p className="text-sm">No tasks yet. Start your first Roundtable above.</p>
              <Link href="/templates" className="inline-block mt-3 text-xs text-indigo-400 hover:text-indigo-300">
                Browse templates →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => router.push(`/roundtable/${task.id}`)}
                  className="flex items-center justify-between px-5 py-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/8 hover:border-white/10 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Privacy indicator */}
                    <span className="text-xs flex-shrink-0" title={task.visibility === 'private' ? 'Private' : 'Shared in workspace'}>
                      {task.visibility === 'private' ? '🔒' : '👥'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {new Date(task.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[task.status] || 'text-zinc-400 bg-zinc-400/10'}`}>
                    {task.status.toLowerCase().replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <SessionExpiryWarning />
    </div>
  )
}
