'use client'

import { useEffect, useState, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import FileTree from '@/components/workspace/FileTree'
import CodeViewer from '@/components/workspace/CodeViewer'
import { EnvVarsPanel } from '@/components/workspace/EnvVarsPanel'
import { EnvSetupHelper } from '@/components/workspace/EnvSetupHelper'
import { EditChatPanel } from '@/components/workspace/EditChatPanel'
import { EditPlanCard } from '@/components/workspace/EditPlanCard'
import { DiffViewer } from '@/components/workspace/DiffViewer'
import { SuggestionsPanel } from '@/components/workspace/SuggestionsPanel'
import { ErrorScanPanel } from '@/components/workspace/ErrorScanPanel'
import { RestClientPanel } from '@/components/workspace/RestClientPanel'
import { WorkspaceRightPanel } from '@/components/workspace/WorkspaceRightPanel'

interface CodeFile {
  path:     string
  content:  string
  language: string
}

interface CodeProject {
  id:       string
  taskId:   string
  name:     string
  files:    CodeFile[]
  status:   'ASSEMBLING' | 'READY' | 'FAILED' | 'COMPLETE' | 'DRAFT'
  repoUrl:  string | null
  pushedAt: string | null
}

interface GitHubConnection {
  login:     string
  avatarUrl: string | null
}

interface EditPlan {
  sessionId:   string
  explanation: string
  files:       Array<{ path: string; description: string }>
}

interface AppliedFile {
  path:       string
  fileIndex:  number
  totalFiles: number
}

type Tab = 'code' | 'env' | 'edit' | 'suggestions' | 'errors' | 'rest'

const TAB_META: Record<Tab, { icon: string; label: string }> = {
  code:        { icon: '📁', label: 'Files' },
  env:         { icon: '🔑', label: 'Env & Setup' },
  edit:        { icon: '✏️', label: 'Edit' },
  suggestions: { icon: '💡', label: 'Suggestions' },
  errors:      { icon: '🔍', label: 'Errors' },
  rest:        { icon: '⚡', label: 'REST' },
}

export default function WorkspacePage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params)
  const router = useRouter()

  const [project,     setProject]     = useState<CodeProject | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState<CodeFile | null>(null)
  const [ghConn,      setGhConn]      = useState<GitHubConnection | null>(null)
  const [pushing,     setPushing]     = useState(false)
  const [pushError,   setPushError]   = useState('')
  const [repoInput,   setRepoInput]   = useState('')
  const [showPush,    setShowPush]    = useState(false)
  const [assembling,  setAssembling]  = useState(false)
  const [activeTab,   setActiveTab]   = useState<Tab>('code')
  const [envTab,      setEnvTab]      = useState<'vars' | 'setup'>('setup')

  // Edit mode state
  const [editEnabled,   setEditEnabled]   = useState(false)
  const [pendingPlan,   setPendingPlan]   = useState<EditPlan | null>(null)
  const [isApplying,    setIsApplying]    = useState(false)
  const [appliedFiles,  setAppliedFiles]  = useState<AppliedFile[]>([])
  const [applyTotal,    setApplyTotal]    = useState(0)
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [editPrefill,   setEditPrefill]   = useState('')

  const sseRef = useRef<EventSource | null>(null)

  const load = useCallback(async () => {
    const [projRes, ghRes] = await Promise.all([
      apiFetch<{ project: CodeProject | null }>(`/api/v1/code-projects/${taskId}`),
      apiFetch<{ connection: GitHubConnection | null }>('/api/v1/github/connection'),
    ])
    if (!projRes.success) { router.push('/dashboard'); return }
    if (projRes.data?.project) {
      setProject(projRes.data.project)
      if (projRes.data.project.files.length > 0 && !selected) {
        setSelected(projRes.data.project.files[0])
      }
      const s = projRes.data.project.status
      if (s === 'COMPLETE' || s === 'DRAFT' || s === 'READY') setEditEnabled(true)
    }
    if (ghRes.success) setGhConn(ghRes.data?.connection ?? null)
    setLoading(false)
  }, [taskId, router, selected])

  useEffect(() => { load() }, [load])

  // Poll while assembling
  useEffect(() => {
    if (project?.status !== 'ASSEMBLING') return
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [project?.status, load])

  // SSE for edit events
  useEffect(() => {
    if (!editEnabled) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (!token) return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const es = new EventSource(`${apiUrl}/api/v1/stream/task/${taskId}?token=${token}`)
    sseRef.current = es

    es.addEventListener('edit_mode_enabled', () => setEditEnabled(true))
    es.addEventListener('edit_plan_ready', (e) => {
      const data = JSON.parse(e.data)
      setPendingPlan({ sessionId: data.sessionId, explanation: data.explanation, files: data.files ?? [] })
      setActiveTab('edit')
    })
    es.addEventListener('edit_applying', (e) => {
      const data = JSON.parse(e.data)
      setIsApplying(true)
      setAppliedFiles([])
      setApplyTotal(data.totalFiles ?? 0)
      setPendingPlan(null)
    })
    es.addEventListener('edit_file_completed', (e) => {
      const data = JSON.parse(e.data)
      setAppliedFiles(prev => [...prev, { path: data.filePath, fileIndex: data.fileIndex, totalFiles: data.totalFiles }])
    })
    es.addEventListener('edit_completed', () => {
      setIsApplying(false)
      setActiveSession(null)
      load()
    })
    es.addEventListener('edit_failed', () => {
      setIsApplying(false)
      setActiveSession(null)
    })

    return () => { es.close(); sseRef.current = null }
  }, [editEnabled, taskId, load])

  function switchToEditWithPrompt(prompt: string) {
    setEditPrefill(prompt)
    setActiveTab('edit')
  }

  async function triggerAssemble() {
    setAssembling(true)
    const res = await apiFetch(`/api/v1/code-projects/${taskId}/assemble`, { method: 'POST' })
    if (res.success) setProject(p => p ? { ...p, status: 'ASSEMBLING' } : null)
    setAssembling(false)
  }

  async function downloadZip() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    const a = document.createElement('a')
    a.href = `/api/v1/code-projects/${taskId}/download`
    if (token) a.href += `?token=${token}`
    a.download = `${project?.name ?? 'project'}.zip`
    a.click()
  }

  async function pushToGitHub() {
    setPushError('')
    setPushing(true)
    const res = await apiFetch<{ repoUrl: string; repoName: string }>(
      `/api/v1/code-projects/${taskId}/push`,
      { method: 'POST', body: JSON.stringify({ repoName: repoInput || undefined, isPrivate: false }) }
    )
    setPushing(false)
    if (res.success && res.data) {
      setProject(p => p ? { ...p, repoUrl: res.data!.repoUrl, pushedAt: new Date().toISOString() } : null)
      setShowPush(false)
    } else {
      setPushError(res.error?.message ?? 'Push failed')
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex gap-2">
          {[0, 150, 300].map(d => (
            <div key={d} className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 text-center px-4">
        <p className="text-4xl">💻</p>
        <div>
          <h1 className="text-xl font-semibold text-white mb-2">No workspace yet</h1>
          <p className="text-slate-400 text-sm max-w-sm">The code workspace is assembled automatically when a development task completes.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={triggerAssemble} disabled={assembling}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
            {assembling ? 'Assembling…' : 'Assemble Workspace'}
          </button>
          <Link href={`/roundtable/${taskId}`} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm transition-colors hover:border-slate-500">
            Back to task
          </Link>
        </div>
      </div>
    )
  }

  if (project.status === 'ASSEMBLING') {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex gap-2">
          {[0, 150, 300].map(d => (
            <div key={d} className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <p className="text-slate-400 text-sm">Assembling your code workspace…</p>
      </div>
    )
  }

  if (project.status === 'FAILED') {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 text-center px-4">
        <p className="text-4xl">⚠️</p>
        <div>
          <h1 className="text-xl font-semibold text-white mb-2">Assembly failed</h1>
          <p className="text-slate-400 text-sm max-w-sm">The workspace couldn't be assembled from the task output.</p>
        </div>
        <button onClick={triggerAssemble} disabled={assembling}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
          {assembling ? 'Retrying…' : 'Retry Assembly'}
        </button>
      </div>
    )
  }

  const hasApi = project.files.some(f =>
    f.path.includes('/routes/') || f.path.includes('/api/') || f.path.includes('server.ts')
  )

  const visibleTabs: Tab[] = [
    'code',
    'env',
    ...(editEnabled ? ['edit' as Tab] : []),
    'suggestions',
    'errors',
    ...(hasApi ? ['rest' as Tab] : []),
  ]

  // ── IDE Layout ────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="h-11 flex items-center gap-3 px-3 border-b border-slate-800 shrink-0 bg-slate-900">
        <Link href={`/roundtable/${taskId}`}
          className="text-slate-500 hover:text-slate-300 text-xs transition-colors shrink-0 flex items-center gap-1">
          ← Task
        </Link>
        <div className="h-4 w-px bg-slate-700" />
        <span className="text-xs font-semibold text-slate-300 truncate max-w-[200px]">💻 {project.name}</span>
        <span className="text-[10px] text-slate-600 shrink-0">{project.files.length} files</span>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={downloadZip}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-medium transition-colors">
            ⬇ ZIP
          </button>

          {/* GitHub */}
          {project.repoUrl ? (
            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 text-[11px] font-medium transition-colors border border-emerald-800/50">
              ✓ GitHub
            </a>
          ) : ghConn ? (
            <button onClick={() => setShowPush(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-medium transition-colors">
              Push to GitHub
            </button>
          ) : (
            <a href="/api/v1/github/auth/start"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-medium transition-colors">
              Connect GitHub
            </a>
          )}
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">

        {/* ── Icon sidebar ───────────────────────────────────────────────────── */}
        <div className="w-12 border-r border-slate-800 bg-slate-900 flex flex-col items-center pt-2 gap-0.5 shrink-0">
          {visibleTabs.map(tab => {
            const meta = TAB_META[tab]
            const isActive = activeTab === tab
            const hasBadge = tab === 'edit' && pendingPlan

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                title={meta.label}
                className={`relative w-9 h-9 flex flex-col items-center justify-center rounded-lg text-base transition-all group ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'text-slate-600 hover:bg-slate-800 hover:text-slate-400'
                }`}
              >
                <span className="text-sm leading-none">{meta.icon}</span>
                <span className={`text-[8px] font-medium mt-0.5 ${isActive ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-500'}`}>
                  {meta.label.split(' ')[0]}
                </span>
                {hasBadge && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400" />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Left panel (content) ─────────────────────────────────────────── */}
        <div className={`border-r border-slate-800 flex flex-col min-h-0 bg-slate-900 overflow-hidden ${
          activeTab === 'code' ? 'w-56' : 'w-80'
        }`}>

          {/* Panel header */}
          <div className="h-8 flex items-center px-3 border-b border-slate-800 shrink-0">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              {TAB_META[activeTab].label}
            </span>
            {activeTab === 'edit' && pendingPlan && (
              <span className="ml-2 text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                Plan ready
              </span>
            )}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-y-auto">

            {/* Files — file tree */}
            {activeTab === 'code' && (
              <FileTree
                files={project.files}
                selected={selected}
                onSelect={(f) => setSelected(f)}
              />
            )}

            {/* Env — vars + setup helper */}
            {activeTab === 'env' && (
              <div className="flex flex-col h-full">
                {/* Sub-tabs */}
                <div className="flex border-b border-slate-800 shrink-0">
                  {(['setup', 'vars'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setEnvTab(t)}
                      className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
                        envTab === t
                          ? 'text-indigo-400 border-b-2 border-indigo-500'
                          : 'text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      {t === 'setup' ? '🔧 Setup Guide' : '📋 Variables'}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {envTab === 'setup'
                    ? <EnvSetupHelper taskId={taskId} files={project.files} />
                    : <EnvVarsPanel taskId={taskId} />
                  }
                </div>
              </div>
            )}

            {/* Edit */}
            {activeTab === 'edit' && editEnabled && (
              <div className="flex flex-col h-full min-h-0">
                {pendingPlan && (
                  <div className="shrink-0">
                    <EditPlanCard
                      plan={pendingPlan}
                      taskId={taskId}
                      appliedFiles={appliedFiles}
                      applyTotal={applyTotal}
                      isApplying={isApplying}
                      onApproved={() => setPendingPlan(null)}
                    />
                  </div>
                )}
                {isApplying && appliedFiles.length > 0 && (
                  <div className="shrink-0">
                    <DiffViewer files={appliedFiles} />
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  <EditChatPanel
                    taskId={taskId}
                    isApplying={isApplying}
                    onSessionCreated={sid => setActiveSession(sid)}
                    prefillMessage={editPrefill}
                    onPrefillConsumed={() => setEditPrefill('')}
                  />
                </div>
              </div>
            )}

            {/* Suggestions */}
            {activeTab === 'suggestions' && (
              <SuggestionsPanel
                taskId={taskId}
                onEditRequest={switchToEditWithPrompt}
              />
            )}

            {/* Errors */}
            {activeTab === 'errors' && (
              <ErrorScanPanel
                taskId={taskId}
                onEditRequest={switchToEditWithPrompt}
              />
            )}

            {/* REST client */}
            {activeTab === 'rest' && (
              <RestClientPanel files={project.files} />
            )}

          </div>
        </div>

        {/* ── Center — code viewer (only for Files tab) ────────────────────── */}
        {activeTab === 'code' && (
          <div className="flex-1 min-w-0 min-h-0 border-r border-slate-800 bg-slate-950 overflow-hidden">
            {selected ? (
              <CodeViewer file={selected} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                Select a file to view
              </div>
            )}
          </div>
        )}

        {/* ── Right panel — always visible: preview + terminal ─────────────── */}
        <div className={activeTab === 'code' ? 'w-[40%] shrink-0' : 'flex-1 min-w-0'}>
          <WorkspaceRightPanel
            files={project.files}
            projectName={project.name}
          />
        </div>

      </div>

      {/* ── GitHub push modal ─────────────────────────────────────────────── */}
      {showPush && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-white mb-1">Push to GitHub</h2>
            <p className="text-sm text-slate-400 mb-4">Pushing as <strong className="text-slate-300">{ghConn?.login}</strong></p>
            <input
              value={repoInput}
              onChange={e => setRepoInput(e.target.value)}
              placeholder={`${project.name.toLowerCase().replace(/\s+/g, '-')}-app`}
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500 mb-3"
            />
            {pushError && <p className="text-red-400 text-xs mb-3">{pushError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowPush(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm hover:border-slate-500 transition-colors">
                Cancel
              </button>
              <button onClick={pushToGitHub} disabled={pushing}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {pushing ? 'Pushing…' : 'Push'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
