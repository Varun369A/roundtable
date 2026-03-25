'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import NotificationBell from '@/components/NotificationBell'
import CreditBadge from '@/components/credits/CreditBadge'
import SessionExpiryWarning from '@/components/auth/SessionExpiryWarning'
import { CreditEstimate } from '@/components/roundtable/CreditEstimate'

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
  isAdmin: boolean
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
  PENDING:               'text-amber-700 bg-amber-50 border border-amber-200',
  ROUTING:               'text-blue-700 bg-blue-50 border border-blue-200',
  IN_PROGRESS:           'text-indigo-700 bg-indigo-50 border border-indigo-200',
  COMPLETED:             'text-emerald-700 bg-emerald-50 border border-emerald-200',
  FAILED:                'text-red-700 bg-red-50 border border-red-200',
  CANCELLED:             'text-slate-500 bg-slate-100 border border-slate-200',
  WAITING_CLARIFICATION: 'text-amber-700 bg-amber-50 border border-amber-200',
}

const STATUS_LABELS: Record<string, string> = {
  WAITING_CLARIFICATION: 'needs input',
}

// ─── Sidebar Nav ──────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Work',
    items: [
      { href: '/dashboard', icon: '📋', label: 'Tasks' },
      { href: '/templates', icon: '📐', label: 'Templates' },
      { href: '/workflows', icon: '⚡', label: 'Workflows' },
      { href: '/dashboard/scheduled', icon: '🗓', label: 'Scheduled' },
    ],
  },
  {
    label: 'Discover',
    items: [
      { href: '/marketplace', icon: '🤖', label: 'Marketplace' },
      { href: '/packs', icon: '📦', label: 'AI Packs' },
      { href: '/marketplace/experts', icon: '⭐', label: 'Experts' },
    ],
  },
  {
    label: 'Social',
    items: [
      { href: '/people', icon: '👥', label: 'People' },
      { href: '/friends', icon: '👋', label: 'Friends' },
      { href: '/messages', icon: '💬', label: 'Messages' },
      { href: '/repos', icon: '📁', label: 'Repos' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/credits', icon: '💳', label: 'Credits' },
      { href: '/settings/billing', icon: '📊', label: 'Billing' },
      { href: '/settings/language', icon: '🌐', label: 'Language' },
      { href: '/settings', icon: '⚙', label: 'Settings' },
    ],
  },
]

function Sidebar({ userProfile }: { userProfile: UserProfile | null }) {
  const pathname = usePathname()

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-900">
            Arivarangam<span className="text-indigo-600">.</span>
          </span>
        </Link>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold px-2 mb-1">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500 font-medium'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span className="text-base leading-none">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {/* Admin */}
        {userProfile?.isAdmin && (
          <div>
            <ul>
              <li>
                <Link
                  href="/admin"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors border border-indigo-200 bg-indigo-50/50"
                >
                  <span className="text-base leading-none">🛡</span>
                  <span>Admin Panel</span>
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* Bottom user area */}
      <div className="border-t border-slate-100 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <CreditBadge />
          <NotificationBell />
        </div>
        {userProfile?.email && (
          <p className="text-xs text-slate-400 truncate">{userProfile.email}</p>
        )}
        <button
          onClick={async () => {
            try {
              await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
            } catch {}
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            window.location.href = '/login'
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <span className="text-base leading-none">↩</span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
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
        <p className="text-sm text-slate-500">Or start with a template</p>
        <Link href="/templates" className="text-xs text-indigo-500 hover:text-indigo-600 transition-colors">
          Browse all →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {featured.slice(0, 8).map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="text-left p-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all group"
          >
            <span className="text-xl block mb-1.5">{t.icon}</span>
            <p className="text-xs font-medium text-slate-800 leading-tight line-clamp-1">{t.name}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{t.agents.length} specialists</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Domain Expert Packs ──────────────────────────────────────────────────────

const DOMAIN_PACKS = [
  {
    id: 'legal',
    icon: '⚖️',
    name: 'Legal',
    tagline: 'Indian law & compliance',
    prefix: 'Legal analysis required. Apply Indian law (IPC, Contract Act, IT Act, Companies Act as applicable), regulatory compliance requirements, and legal risk assessment. ',
  },
  {
    id: 'medical',
    icon: '🏥',
    name: 'Medical',
    tagline: 'Clinical evidence-based',
    prefix: 'Medical/health analysis required. Base all recommendations on peer-reviewed clinical evidence, standard medical guidelines (ICMR/WHO), and include appropriate safety caveats. ',
  },
  {
    id: 'finance',
    icon: '📊',
    name: 'Finance',
    tagline: 'Risk, ROI & markets',
    prefix: 'Financial analysis required. Include risk assessment, ROI projections, market analysis, regulatory compliance (SEBI/RBI as applicable), and quantitative modelling. ',
  },
  {
    id: 'engineering',
    icon: '⚙️',
    name: 'Engineering',
    tagline: 'System design & scale',
    prefix: 'Engineering analysis required. Cover system architecture, scalability (capacity planning, load estimates), fault tolerance, security posture, and operational considerations. ',
  },
]

function DomainPacks({ onSelect }: { onSelect: (prefix: string) => void }) {
  const [active, setActive] = useState<string | null>(null)

  function handlePack(pack: typeof DOMAIN_PACKS[0]) {
    if (active === pack.id) {
      setActive(null)
    } else {
      setActive(pack.id)
      onSelect(pack.prefix)
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">Domain Expert Packs</p>
        {active && (
          <button
            onClick={() => setActive(null)}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Clear ✕
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DOMAIN_PACKS.map((pack) => (
          <button
            key={pack.id}
            onClick={() => handlePack(pack)}
            className={`text-left p-3 rounded-xl border transition-all ${
              active === pack.id
                ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-indigo-200 hover:shadow-sm'
            }`}
          >
            <span className="text-xl block mb-1.5">{pack.icon}</span>
            <p className="text-xs font-medium text-slate-800 leading-tight">{pack.name}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{pack.tagline}</p>
            {active === pack.id && (
              <span className="inline-block mt-1.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">Active</span>
            )}
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-sm text-slate-700 transition-colors shadow-sm"
      >
        <span className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
          {active.name[0]}
        </span>
        <span className="text-xs max-w-32 truncate">{active.name}</span>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-xl min-w-48 z-20 overflow-hidden">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => { onSwitch(ws); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors ${
                ws.id === active.id ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              <span className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                {ws.name[0]}
              </span>
              <div>
                <p className="text-xs font-medium">{ws.name}</p>
                <p className="text-[10px] text-slate-400">{ws.type === 'PERSONAL' ? 'Personal' : `${ws.memberCount} members`}</p>
              </div>
              {ws.id === active.id && <span className="ml-auto text-indigo-500 text-xs">✓</span>}
            </button>
          ))}
          <div className="border-t border-slate-100 px-4 py-2">
            <Link href="/workspace/settings" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
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
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [maxCredits, setMaxCredits] = useState<number | null>(null)
  const [debateMode, setDebateMode] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activeDomainPrefix, setActiveDomainPrefix] = useState<string | null>(null)
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
      apiFetch<{ user: { isEmailVerified: boolean; isAdmin: boolean; email: string } }>('/api/v1/auth/me'),
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
      if (u) setUserProfile({ isEmailVerified: u.isEmailVerified, isAdmin: u.isAdmin ?? false, email: u.email })
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
    const res = await apiFetch('/api/v1/tasks')
    if (res.success) setTasks((res.data as any).tasks || res.data || [])
  }

  async function deleteTask(e: React.MouseEvent, taskId: string) {
    e.stopPropagation()
    if (!confirm('Delete this task?')) return
    setDeletingTaskId(taskId)
    await apiFetch(`/api/v1/tasks/${taskId}`, { method: 'DELETE' })
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setDeletingTaskId(null)
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    const goalText = goal.trim()
    if (!goalText) return
    setCreating(true)
    setCreateError('')

    try {
      const finalGoal = activeDomainPrefix ? `${activeDomainPrefix}${goalText}` : goalText
      const body: Record<string, unknown> = { goal: finalGoal, visibility }
      if (selectedTemplate) body.templateId = selectedTemplate.id
      if (activeWorkspace && visibility === 'workspace') body.workspaceId = activeWorkspace.id
      if (maxCredits !== null) body.maxCredits = maxCredits
      if (debateMode) body.debateMode = true

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
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <Sidebar userProfile={userProfile} />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <WorkspaceBadge
            workspaces={workspaces}
            active={activeWorkspace}
            onSwitch={handleSwitchWorkspace}
          />
          <div className="flex items-center gap-3">
            <CreditBadge />
            <NotificationBell />
            {userProfile?.email && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" title={userProfile.email}>
                {userProfile.email[0].toUpperCase()}
              </div>
            )}
          </div>
        </header>

        {/* Scrollable content */}
        <main id="main-content" className="flex-1 overflow-auto bg-slate-50">
          <div className="max-w-3xl mx-auto px-6 py-10">

            {/* Email verification banner */}
            {userProfile && !userProfile.isEmailVerified && !verificationResent && (
              <div className="flex items-center justify-between gap-4 px-4 py-3 mb-6 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-3">
                  <span className="text-amber-600 flex-shrink-0">⚠</span>
                  <p className="text-sm text-amber-700">
                    Please verify your email address to unlock all Arivarangam features.
                  </p>
                </div>
                <button
                  onClick={handleResendVerification}
                  disabled={resendingVerification}
                  className="flex-shrink-0 text-xs text-amber-600 hover:text-amber-700 underline underline-offset-2 transition-colors disabled:opacity-50"
                >
                  {resendingVerification ? 'Sending…' : 'Resend verification email'}
                </button>
              </div>
            )}
            {verificationResent && (
              <div className="flex items-center gap-3 px-4 py-3 mb-6 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-600">✓</span>
                <p className="text-sm text-emerald-700">Verification email sent — check your inbox.</p>
              </div>
            )}

            {/* Active workspace context */}
            {activeWorkspace && (
              <div className="flex items-center gap-2 mb-6">
                <div className="w-4 h-4 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0" />
                <p className="text-sm text-slate-500">
                  Working in <span className="text-slate-800 font-medium">{activeWorkspace.name}</span>
                  {activeWorkspace.type === 'PERSONAL' && (
                    <span className="ml-2 text-xs text-slate-400">(private)</span>
                  )}
                </p>
              </div>
            )}

            {/* Task creation */}
            <form onSubmit={createTask} aria-label="Create a new Roundtable task" className="mb-10">
              {/* Selected template indicator */}
              {selectedTemplate && (
                <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <span className="text-lg">{selectedTemplate.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-indigo-700">{selectedTemplate.name} template</p>
                    <p className="text-[10px] text-slate-500">{selectedTemplate.agents.length} AIs in sequence</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Active domain pack badge */}
              {activeDomainPrefix && (
                <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-lg">{DOMAIN_PACKS.find(p => p.prefix === activeDomainPrefix)?.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-emerald-700">
                      {DOMAIN_PACKS.find(p => p.prefix === activeDomainPrefix)?.name} Expert Pack active
                    </p>
                    <p className="text-[10px] text-slate-500">Domain context will be injected automatically</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveDomainPrefix(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}

              <label htmlFor="goal-input" className="block text-sm text-slate-600 font-medium mb-3">
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
                  className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-colors text-slate-900 placeholder-slate-400 resize-none text-sm shadow-sm"
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

              {/* Live credit estimate — shows as user types */}
              {!userProfile?.isAdmin && (
                <div className="mb-3">
                  <CreditEstimate
                    goal={goal}
                    templateId={selectedTemplate?.id}
                  />
                </div>
              )}

              {/* Advanced options — budget cap + debate mode */}
              {!userProfile?.isAdmin && (
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <span className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
                    Advanced options
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                      {/* Smart Budget */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-slate-700">
                            Smart Budget
                            <span className="ml-1.5 text-slate-400 font-normal">— cap AI spend</span>
                          </label>
                          <span className="text-xs text-indigo-600 font-medium">
                            {maxCredits === null ? 'Auto' : `≤ ${maxCredits} credits`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={20}
                          max={200}
                          step={10}
                          value={maxCredits ?? 200}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            setMaxCredits(v >= 200 ? null : v)
                          }}
                          className="w-full accent-indigo-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                          <span>20 (fast)</span>
                          <span>Auto (best quality)</span>
                        </div>
                      </div>

                      {/* Debate Mode */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-slate-700">Debate Mode</p>
                          <p className="text-[11px] text-slate-400">AIs argue their case — synthesis picks the winner</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDebateMode((v) => !v)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                            debateMode ? 'bg-indigo-600' : 'bg-slate-300'
                          }`}
                          role="switch"
                          aria-checked={debateMode}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                            debateMode ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Low-credit warning — hidden for admin */}
              {creditBalance !== null && creditBalance < 50 && !userProfile?.isAdmin && (
                <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-sm">
                  <span className="text-amber-700 flex items-center gap-2">
                    <span aria-hidden="true">⚠</span>
                    <span>Low credits (<strong>{creditBalance}</strong> remaining). This task may cost 10–30 credits.</span>
                  </span>
                  <Link href="/credits" className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors whitespace-nowrap">
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                      visibility === 'workspace'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {visibility === 'private' ? '🔒 Private' : '👥 Workspace'}
                  </button>

                  {detectedLang && (
                    <span className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                      {detectedLang} detected
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={creating || !goal.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-all active:scale-95 whitespace-nowrap shadow-sm"
                >
                  {creating ? 'Starting…' : selectedTemplate ? `Start ${selectedTemplate.icon}` : 'Build with Arivarangam AI'}
                </button>
              </div>

              {createError && <p role="alert" className="text-red-600 text-xs mt-2">{createError}</p>}
            </form>

            {/* Template quick-pick */}
            <TemplatePicker onSelect={(t) => {
              setSelectedTemplate(t)
              if (!goal.trim() && t.examplePrompts.length > 0) {
                setGoal(t.examplePrompts[0])
              }
            }} />

            {/* Domain Expert Packs */}
            <DomainPacks onSelect={(prefix) => setActiveDomainPrefix((p) => p === prefix ? null : prefix)} />

            {/* Task History */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-800">Recent tasks</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {activeWorkspace?.type === 'PERSONAL' ? (
                    <span className="flex items-center gap-1">🔒 Personal workspace — only you can see these</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span>🔒 private</span>
                      <span className="text-slate-300">·</span>
                      <span>👥 shared</span>
                    </span>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-slate-200 animate-pulse" />
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p className="text-3xl mb-3">✨</p>
                  <p className="text-sm">No tasks yet. Start your first Roundtable above.</p>
                  <Link href="/templates" className="inline-block mt-3 text-xs text-indigo-600 hover:text-indigo-700">
                    Browse templates →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => router.push(`/roundtable/${task.id}`)}
                      className="group flex items-center justify-between px-5 py-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-200 hover:shadow-sm cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs flex-shrink-0" title={task.visibility === 'private' ? 'Private' : 'Shared in workspace'}>
                          {task.visibility === 'private' ? '🔒' : '👥'}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-slate-800 truncate">{task.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(task.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[task.status] || 'text-slate-500 bg-slate-100'}`}>
                          {STATUS_LABELS[task.status] || task.status.toLowerCase().replace(/_/g, ' ')}
                        </span>
                        <button
                          onClick={(e) => deleteTask(e, task.id)}
                          disabled={deletingTaskId === task.id}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                          title="Delete task"
                        >
                          {deletingTaskId === task.id ? '…' : '✕'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <SessionExpiryWarning />
    </div>
  )
}
