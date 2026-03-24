'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface Issue {
  severity: string
  title: string
  description: string
  component: string
}

interface Session {
  id: string
  status: string
  issueTitle: string
  runCount: number
  successfulRuns: number
  createdAt: string
}

export default function SandboxPage() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch('/api/v1/admin/sandbox/issues'),
      apiFetch('/api/v1/admin/sandbox/sessions'),
    ]).then(([issuesRes, sessionsRes]) => {
      if (issuesRes.success) setIssues((issuesRes.data as any)?.issues ?? [])
      if (sessionsRes.success) setSessions((sessionsRes.data as any)?.sessions ?? [])
    }).finally(() => setLoading(false))
  }, [])

  async function analyzeIssue(issue: Issue) {
    setAnalyzing(true)
    const res = await apiFetch('/api/v1/admin/sandbox/sessions', {
      method: 'POST',
      body: JSON.stringify({ issueTitle: issue.title, issueDescription: issue.description, component: issue.component }),
    })
    if (res.success) {
      setSessions((prev) => [(res.data as any).session, ...prev])
    }
    setAnalyzing(false)
  }

  const severityColor = (s: string) =>
    s === 'critical' ? 'bg-red-100 text-red-700' :
    s === 'high'     ? 'bg-orange-100 text-orange-700' :
    s === 'medium'   ? 'bg-yellow-100 text-yellow-700' :
                       'bg-slate-100 text-slate-600'

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Sandbox</h1>
        <p className="text-slate-500 text-sm mt-1">AI-assisted issue detection and safe testing environment.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Detected Issues */}
          <div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">AI-Detected Issues</h2>
              {issues.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">No issues detected</p>
              ) : (
                <div className="space-y-3">
                  {issues.map((issue, i) => (
                    <div key={i} className="border border-slate-100 rounded-xl p-3.5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-800">{issue.title}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${severityColor(issue.severity)}`}>
                          {issue.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{issue.description}</p>
                      <button
                        onClick={() => analyzeIssue(issue)}
                        disabled={analyzing}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
                      >
                        {analyzing ? 'Analyzing…' : 'Run sandbox analysis →'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sessions */}
          <div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Sandbox Sessions</h2>
              {sessions.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">No sessions yet</p>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {sessions.map((s) => (
                    <div key={s.id} className="border border-slate-100 rounded-xl p-3.5">
                      <p className="text-sm font-medium text-slate-800 mb-1">{s.issueTitle}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className={`font-semibold ${s.status === 'READY' ? 'text-emerald-600' : s.status === 'FAILED' ? 'text-red-500' : 'text-slate-500'}`}>
                          {s.status}
                        </span>
                        <span>{s.successfulRuns}/{s.runCount} runs passed</span>
                        <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
