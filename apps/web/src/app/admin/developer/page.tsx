'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import Link from 'next/link'

interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  affectedComponent: string
  suggestedFix: string
}

interface SandboxRun {
  id: string
  runNumber: number
  passed: boolean
  errorMsg?: string
  durationMs: number
  createdAt: string
}

interface SandboxSession {
  id: string
  title: string
  diagnosis: string
  proposedFix: { type: string; target: string; change: unknown }
  status: 'PENDING' | 'TESTING' | 'CONFIRMED' | 'APPLIED' | 'REJECTED'
  runCount: number
  successCount: number
  createdAt: string
  runs: SandboxRun[]
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:   'text-yellow-400 bg-yellow-400/10',
  TESTING:   'text-blue-400 bg-blue-400/10',
  CONFIRMED: 'text-emerald-400 bg-emerald-400/10',
  APPLIED:   'text-purple-400 bg-purple-400/10',
  REJECTED:  'text-red-400 bg-red-400/10',
}

const SEV_STYLES: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/20',
  high:     'text-orange-400 bg-orange-400/10 border-orange-400/20',
  medium:   'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  low:      'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
}

export default function DeveloperPage() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [sessions, setSessions] = useState<SandboxSession[]>([])
  const [selectedSession, setSelectedSession] = useState<SandboxSession | null>(null)
  const [loadingIssues, setLoadingIssues] = useState(true)
  const [creatingSession, setCreatingSession] = useState(false)
  const [runningTest, setRunningTest] = useState(false)
  const [applyingFix, setApplyingFix] = useState(false)
  const [focus, setFocus] = useState('')
  const [activeTab, setActiveTab] = useState<'issues' | 'sandbox'>('issues')

  const loadIssues = useCallback(async () => {
    setLoadingIssues(true)
    try {
      const res = await apiFetch('/api/v1/admin/sandbox/issues')
      const data = await res.json()
      if (data.success) setIssues(data.data.issues)
    } finally {
      setLoadingIssues(false)
    }
  }, [])

  const loadSessions = useCallback(async () => {
    const res = await apiFetch('/api/v1/admin/sandbox/sessions')
    const data = await res.json()
    if (data.success) setSessions(data.data.sessions)
  }, [])

  useEffect(() => { loadIssues(); loadSessions() }, [loadIssues, loadSessions])

  const createSession = async (issueFocus?: string) => {
    setCreatingSession(true)
    try {
      const res = await apiFetch('/api/v1/admin/sandbox/sessions', {
        method: 'POST',
        body: JSON.stringify({ focus: issueFocus || focus }),
      })
      const data = await res.json()
      if (data.success) {
        await loadSessions()
        setSelectedSession(data.data.session)
        setActiveTab('sandbox')
      }
    } finally {
      setCreatingSession(false)
    }
  }

  const runTest = async (sessionId: string) => {
    setRunningTest(true)
    try {
      const res = await apiFetch(`/api/v1/admin/sandbox/sessions/${sessionId}/run`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        const updated = data.data.session
        setSessions((s) => s.map((sess) => sess.id === sessionId ? updated : sess))
        setSelectedSession(updated)
      }
    } finally {
      setRunningTest(false)
    }
  }

  const applyFix = async (sessionId: string) => {
    if (!confirm('Apply this fix to production? This cannot be undone (but no data will be deleted).')) return
    setApplyingFix(true)
    try {
      const res = await apiFetch(`/api/v1/admin/sandbox/sessions/${sessionId}/apply`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        await loadSessions()
        const updated = sessions.find((s) => s.id === sessionId)
        if (updated) setSelectedSession({ ...updated, status: 'APPLIED' })
      }
    } finally {
      setApplyingFix(false)
    }
  }

  const canApply = (s: SandboxSession) => s.runCount >= 3 && s.successCount >= 3 && s.status !== 'APPLIED'

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors">← Admin</Link>
            <div>
              <h1 className="text-xl font-bold">Developer Sandbox</h1>
              <p className="text-xs text-zinc-500">AI-powered issue detection → isolated fix testing → safe deployment</p>
            </div>
          </div>
          <Link
            href="/admin/nova"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-sm text-indigo-400 hover:bg-indigo-500/15 transition-colors"
          >
            <span>🤖</span> Ask NOVA
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/3 rounded-xl p-1 w-fit">
          {(['issues', 'sandbox'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeTab === tab ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab === 'issues' ? `🔍 Issues ${issues.length > 0 ? `(${issues.length})` : ''}` : `🧪 Sandbox ${sessions.length > 0 ? `(${sessions.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Issues Tab */}
        {activeTab === 'issues' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-zinc-500">AI-detected platform issues from the last 24h</p>
              <button
                onClick={loadIssues}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                ↻ Refresh
              </button>
            </div>

            {loadingIssues ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : issues.length === 0 ? (
              <div className="text-center py-16 bg-white/3 rounded-2xl border border-white/5">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-white font-medium">No issues detected</p>
                <p className="text-zinc-500 text-sm mt-1">The platform looks healthy right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {issues.map((issue, i) => (
                  <div key={i} className={`rounded-2xl border p-5 ${SEV_STYLES[issue.severity]}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${SEV_STYLES[issue.severity]}`}>
                            {issue.severity}
                          </span>
                          <span className="text-xs text-zinc-600">{issue.affectedComponent}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-white mb-1">{issue.title}</h3>
                        <p className="text-xs text-zinc-400 mb-2">{issue.description}</p>
                        <p className="text-xs text-zinc-500">
                          <span className="text-zinc-400 font-medium">Suggested fix:</span> {issue.suggestedFix}
                        </p>
                      </div>
                      <button
                        onClick={() => createSession(issue.title + ': ' + issue.suggestedFix)}
                        disabled={creatingSession}
                        className="flex-shrink-0 px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs rounded-xl transition-colors disabled:opacity-50"
                      >
                        {creatingSession ? 'Creating…' : '→ Test Fix'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Manual sandbox creation */}
            <div className="mt-6 bg-white/3 rounded-2xl border border-white/8 p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Create Custom Sandbox Session</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Describe the issue or area to investigate…"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20"
                />
                <button
                  onClick={() => createSession()}
                  disabled={creatingSession || !focus.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-xl font-medium transition-colors"
                >
                  {creatingSession ? 'Analyzing…' : 'Analyze & Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sandbox Tab */}
        {activeTab === 'sandbox' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Session list */}
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Sessions</h2>
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-sm">
                  No sessions yet.<br />Create one from the Issues tab.
                </div>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedSession?.id === session.id
                        ? 'bg-indigo-500/10 border-indigo-500/30'
                        : 'bg-white/3 border-white/5 hover:bg-white/6'
                    }`}
                  >
                    <p className="text-xs font-medium text-white truncate">{session.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[session.status]}`}>
                        {session.status}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {session.successCount}/{session.runCount} passed
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Session detail */}
            <div className="lg:col-span-2">
              {!selectedSession ? (
                <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                  Select a session to view details
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Status bar */}
                  <div className="bg-white/3 rounded-2xl border border-white/8 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-sm font-bold text-white mb-1">{selectedSession.title}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[selectedSession.status]}`}>
                          {selectedSession.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {selectedSession.status !== 'APPLIED' && selectedSession.status !== 'REJECTED' && (
                          <button
                            onClick={() => runTest(selectedSession.id)}
                            disabled={runningTest}
                            className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs rounded-xl transition-colors disabled:opacity-50"
                          >
                            {runningTest ? '⟳ Running…' : '▶ Run Test'}
                          </button>
                        )}
                        {canApply(selectedSession) && (
                          <button
                            onClick={() => applyFix(selectedSession.id)}
                            disabled={applyingFix}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-xl transition-colors disabled:opacity-50 font-medium"
                          >
                            {applyingFix ? 'Applying…' : '✓ Apply Fix'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                        <span>Confirmation progress</span>
                        <span>{selectedSession.successCount}/3 successful runs required</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            selectedSession.successCount >= 3 ? 'bg-emerald-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.min(100, (selectedSession.successCount / 3) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis */}
                  <div className="bg-white/3 rounded-2xl border border-white/8 p-5">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">AI Diagnosis</h3>
                    <p className="text-sm text-zinc-300 leading-relaxed">{selectedSession.diagnosis}</p>
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <p className="text-xs text-zinc-600 mb-1">Proposed fix type</p>
                      <code className="text-xs bg-white/5 text-indigo-300 px-2 py-1 rounded-lg">
                        {selectedSession.proposedFix.type} → {selectedSession.proposedFix.target}
                      </code>
                    </div>
                  </div>

                  {/* Test runs */}
                  {selectedSession.runs.length > 0 && (
                    <div className="bg-white/3 rounded-2xl border border-white/8 overflow-hidden">
                      <div className="px-5 py-3 border-b border-white/5">
                        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Test Runs</h3>
                      </div>
                      <div className="divide-y divide-white/5">
                        {selectedSession.runs.map((run) => (
                          <div key={run.id} className="flex items-center gap-4 px-5 py-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              run.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {run.passed ? '✓' : '✗'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-zinc-300">
                                Run #{run.runNumber} · {run.durationMs}ms
                              </p>
                              {run.errorMsg && (
                                <p className="text-xs text-red-400 truncate">{run.errorMsg}</p>
                              )}
                            </div>
                            <span className="text-xs text-zinc-700 flex-shrink-0">
                              {new Date(run.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Safety notice */}
                  <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-4">
                    <p className="text-xs font-medium text-emerald-400 mb-1">🔒 Safe by design</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Fixes are applied in isolation and tested 3× before production deployment. No user data, history, files, or storage is ever deleted during this process.
                      Applies only configuration-level changes (templates, flags, prompts).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
