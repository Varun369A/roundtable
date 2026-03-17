'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import FileTree from '@/components/workspace/FileTree'
import CodeViewer from '@/components/workspace/CodeViewer'
import { EnvVarsPanel } from '@/components/workspace/EnvVarsPanel'

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
  status:   'ASSEMBLING' | 'READY' | 'FAILED'
  repoUrl:  string | null
  pushedAt: string | null
}

interface GitHubConnection {
  login:     string
  avatarUrl: string | null
}

export default function WorkspacePage({ params }: { params: { taskId: string } }) {
  const router  = useRouter()
  const taskId  = params.taskId

  const [project,    setProject]    = useState<CodeProject | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<CodeFile | null>(null)
  const [ghConn,     setGhConn]     = useState<GitHubConnection | null>(null)
  const [pushing,    setPushing]    = useState(false)
  const [pushError,  setPushError]  = useState('')
  const [repoInput,  setRepoInput]  = useState('')
  const [showPush,   setShowPush]   = useState(false)
  const [assembling, setAssembling] = useState(false)
  const [activeTab,  setActiveTab]  = useState<'code' | 'env'>('code')

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
    }
    if (ghRes.success) setGhConn(ghRes.data?.connection ?? null)
    setLoading(false)
  }, [taskId, router, selected])

  useEffect(() => {
    load()
  }, [load])

  // Poll while assembling
  useEffect(() => {
    if (project?.status !== 'ASSEMBLING') return
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [project?.status, load])

  async function triggerAssemble() {
    setAssembling(true)
    const res = await apiFetch(`/api/v1/code-projects/${taskId}/assemble`, { method: 'POST' })
    if (res.success) {
      setProject((p) => p ? { ...p, status: 'ASSEMBLING' } : null)
    }
    setAssembling(false)
  }

  async function downloadZip() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    const a = document.createElement('a')
    a.href = `/api/v1/code-projects/${taskId}/download`
    // Pass token via query param for download links
    if (token) a.href += `?token=${token}`
    a.download = `${project?.name ?? 'project'}.zip`
    a.click()
  }

  async function pushToGitHub() {
    setPushError('')
    setPushing(true)
    const res = await apiFetch<{ repoUrl: string; repoName: string }>(
      `/api/v1/code-projects/${taskId}/push`,
      {
        method: 'POST',
        body:   JSON.stringify({ repoName: repoInput || undefined, isPrivate: false }),
      }
    )
    setPushing(false)
    if (res.success && res.data) {
      setProject((p) => p ? { ...p, repoUrl: res.data!.repoUrl, pushedAt: new Date().toISOString() } : null)
      setShowPush(false)
    } else {
      setPushError(res.error?.message ?? 'Push failed')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex gap-2">
          {[0, 150, 300].map((d) => (
            <div key={d} className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  // No project yet
  if (!project) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-6 text-center px-4">
        <p className="text-4xl">💻</p>
        <div>
          <h1 className="text-xl font-semibold text-white mb-2">No workspace yet</h1>
          <p className="text-zinc-500 text-sm max-w-sm">
            The code workspace is assembled automatically when a development task completes. You can also trigger it manually.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={triggerAssemble}
            disabled={assembling}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {assembling ? 'Assembling…' : 'Assemble Workspace'}
          </button>
          <Link href={`/roundtable/${taskId}`} className="px-4 py-2 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-400 text-sm transition-colors">
            Back to task
          </Link>
        </div>
      </div>
    )
  }

  // Assembling
  if (project.status === 'ASSEMBLING') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex gap-2">
          {[0, 150, 300].map((d) => (
            <div key={d} className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <p className="text-zinc-400 text-sm">Assembling your code workspace…</p>
        <p className="text-zinc-600 text-xs">AI output is being parsed into a file structure</p>
      </div>
    )
  }

  // Failed
  if (project.status === 'FAILED') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-6 text-center px-4">
        <p className="text-4xl">⚠️</p>
        <div>
          <h1 className="text-xl font-semibold text-white mb-2">Assembly failed</h1>
          <p className="text-zinc-500 text-sm max-w-sm">
            The workspace couldn't be assembled from the task output. This usually means the AI didn't output structured file content.
          </p>
        </div>
        <button
          onClick={triggerAssemble}
          disabled={assembling}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {assembling ? 'Retrying…' : 'Retry Assembly'}
        </button>
      </div>
    )
  }

  // READY — show the workspace
  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-zinc-800 shrink-0 bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link href={`/roundtable/${taskId}`} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← Task
          </Link>
          <div className="h-4 w-px bg-zinc-800" />
          <span className="text-sm font-medium text-zinc-200 truncate max-w-xs">
            💻 {project.name}
          </span>
          <span className="text-[10px] text-zinc-600">
            {project.files.length} file{project.files.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Download ZIP */}
          <button
            onClick={downloadZip}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
          >
            ⬇ Download ZIP
          </button>

          {/* GitHub push / connect */}
          {project.repoUrl ? (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-400 text-xs font-medium transition-colors border border-emerald-700/40"
            >
              ✓ View on GitHub
            </a>
          ) : ghConn ? (
            <button
              onClick={() => setShowPush(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
            >
              Push to GitHub
            </button>
          ) : (
            <a
              href={`/api/v1/github/auth/start`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
            >
              Connect GitHub
            </a>
          )}
        </div>
      </header>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="flex border-b border-zinc-800 shrink-0 bg-zinc-900/30">
        {(['code', 'env'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? 'text-white border-indigo-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {tab === 'code' ? '💻 Files' : '🔑 Env Variables'}
          </button>
        ))}
      </div>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      {activeTab === 'code' ? (
        <div className="flex flex-1 min-h-0">
          {/* File tree sidebar */}
          <aside className="w-56 border-r border-zinc-800 bg-zinc-900/40 shrink-0 overflow-hidden">
            <FileTree
              files={project.files}
              selected={selected?.path ?? null}
              onSelect={setSelected}
            />
          </aside>

          {/* Code viewer */}
          <main className="flex-1 min-w-0 bg-zinc-950">
            <CodeViewer file={selected} />
          </main>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <EnvVarsPanel projectId={project.id} />
        </div>
      )}

      {/* ── Push to GitHub modal ──────────────────────────────────────────── */}
      {showPush && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-1">Push to GitHub</h2>
            <p className="text-sm text-zinc-500 mb-5">
              Creates a new public repository and pushes all {project.files.length} files.
              {ghConn && <span className="text-zinc-400"> Pushing as <strong>{ghConn.login}</strong>.</span>}
            </p>

            <label className="block text-xs text-zinc-500 mb-1.5">Repository name</label>
            <input
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder={project.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 focus:border-indigo-500 focus:outline-none text-sm text-white placeholder-zinc-600 mb-4 transition-colors"
            />

            {pushError && (
              <p className="text-red-400 text-xs mb-3">{pushError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={pushToGitHub}
                disabled={pushing}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {pushing ? 'Pushing…' : 'Push'}
              </button>
              <button
                onClick={() => { setShowPush(false); setPushError('') }}
                className="px-4 py-2 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-400 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
