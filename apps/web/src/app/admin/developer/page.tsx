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
  PENDING:   'text-yellow-600 bg-yellow-50',
  TESTING:   'text-blue-600 bg-blue-50',
  CONFIRMED: 'text-emerald-600 bg-emerald-50',
  APPLIED:   'text-purple-600 bg-purple-50',
  REJECTED:  'text-red-600 bg-red-50',
}

const SEV_STYLES: Record<string, string> = {
  critical: 'text-red-600 bg-red-50 border-red-200',
  high:     'text-orange-600 bg-orange-50 border-orange-200',
  medium:   'text-yellow-600 bg-yellow-50 border-yellow-200',
  low:      'text-slate-500 bg-slate-50 border-slate-200',
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
      const data = await apiFetch('/api/v1/admin/sandbox/issues')
      if (data.success) setIssues((data.data as any).issues)
    } finally {
      setLoadingIssues(false)
    }
  }, [])

  const loadSessions = useCallback(async () => {
    const data = await apiFetch('/api/v1/admin/sandbox/sessions')
    if (data.success) setSessions((data.data as any).sessions)
  }, [])

  useEffect(() => { loadIssues(); loadSessions() }, [loadIssues, loadSessions])

  const createSession = async (issueFocus?: string) => {
    setCreatingSession(true)
    try {
      const data = await apiFetch('/api/v1/admin/sandbox/sessions', {
        method: 'POST',
        body: JSON.stringify({ focus: issueFocus || focus }),
      })
      if (data.success) {
        await loadSessions()
        setSelectedSession((data.data as any).session)
        setActiveTab('sandbox')
      }
    } finally {
      setCreatingSession(false)
    }
  }

  const runTest = async (sessionId: string) => {
    setRunningTest(true)
    try {
      const data = await apiFetch(`/api/v1/admin/sandbox/sessions/${sessionId}/run`, { method: 'POST' })
      if (data.success) {
        const updated = (data.data as any).session
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
      const data = await apiFetch(`/api/v1/admin/sandbox/sessions/${sessionId}/apply`, { method: 'POST' })
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-slate-400 hover:text-slate-600 text-sm transition-colors">← Admin</Link>
            <div>
              <h1 className="text-xl font-bold">Developer Sandbox</h1>
              <p className="text-xs text-slate-500">AI-powered issue detection → isolated fix testing → safe deployment</p>
            </div>
          </div>
          <Link
            href="/admin/nova"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            <span>🤖</span> Ask NOVA
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
          {(['issues', 'sandbox'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
              <p className="text-sm text-slate-500">AI-detected platform issues from the last 24h</p>
              <button
                onClick={loadIssues}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                ↻ Refresh
              </button>
            </div>

            {loadingIssues ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
              </div>
            ) : issues.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-slate-900 font-medium">No issues detected</p>
                <p className="text-slate-500 text-sm mt-1">The platform looks healthy right now.</p>
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
                          <span className="text-xs text-slate-400">{issue.affectedComponent}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-1">{issue.title}</h3>
                        <p className="text-xs text-slate-500 mb-2">{issue.description}</p>
                        <p className="text-xs text-slate-500">
                          <span className="text-slate-700 font-medium">Suggested fix:</span> {issue.suggestedFix}
                        </p>
                      </div>
                      <button
                        onClick={() => createSession(issue.title + ': ' + issue.suggestedFix)}
                        disabled={creatingSession}
                        className="flex-shrink-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl transition-colors disabled:opacity-50"
                      >
                        {creatingSession ? 'Creating…' : '→ Test Fix'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Manual sandbox creation */}
            <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Create Custom Sandbox Session</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Describe the issue or area to investigate…"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-300"
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
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Sessions</h2>
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No sessions yet.<br />Create one from the Issues tab.
                </div>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedSession?.id === session.id
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-xs font-medium text-slate-900 truncate">{session.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[session.status]}`}>
                        {session.status}
                      </span>
                      <span className="text-[10px] text-slate-400">
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
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Select a session to view details
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Status bar */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 mb-1">{selectedSession.title}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[selectedSession.status]}`}>
                          {selectedSession.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {selectedSession.status !== 'APPLIED' && selectedSession.status !== 'REJECTED' && (
                          <button
                            onClick={() => runTest(selectedSession.id)}
                            disabled={runningTest}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl transition-colors disabled:opacity-50"
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
                      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                        <span>Confirmation progress</span>
                        <span>{selectedSession.successCount}/3 successful runs required</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">AI Diagnosis</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{selectedSession.diagnosis}</p>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-400 mb-1">Proposed fix type</p>
                      <code className="text-xs bg-slate-100 text-indigo-600 px-2 py-1 rounded-lg">
                        {selectedSession.proposedFix.type} → {selectedSession.proposedFix.target}
                      </code>
                    </div>
                  </div>

                  {/* Test runs */}
                  {selectedSession.runs.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="px-5 py-3 border-b border-slate-100">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Test Runs</h3>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {selectedSession.runs.map((run) => (
                          <div key={run.id} className="flex items-center gap-4 px-5 py-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              run.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                            }`}>
                              {run.passed ? '✓' : '✗'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-600">
                                Run #{run.runNumber} · {run.durationMs}ms
                              </p>
                              {run.errorMsg && (
                                <p className="text-xs text-red-500 truncate">{run.errorMsg}</p>
                              )}
                            </div>
                            <span className="text-xs text-slate-300 flex-shrink-0">
                              {new Date(run.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Safety notice */}
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                    <p className="text-xs font-medium text-emerald-700 mb-1">🔒 Safe by design</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
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
