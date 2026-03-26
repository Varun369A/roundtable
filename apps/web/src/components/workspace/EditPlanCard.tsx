'use client'

import { apiFetch } from '@/lib/api'

interface PlannedFile {
  path: string
  description: string
}

interface EditPlanCardProps {
  taskId: string
  sessionId: string
  explanation: string
  files: PlannedFile[]
  onApproved: () => void
  onRejected: () => void
}

export function EditPlanCard({ taskId, sessionId, explanation, files, onApproved, onRejected }: EditPlanCardProps) {
  async function approve() {
    const res = await apiFetch(
      `/api/v1/code-projects/${taskId}/edits/${sessionId}/approve`,
      { method: 'POST' },
    )
    if (res.success) onApproved()
  }

  async function reject() {
    const res = await apiFetch(
      `/api/v1/code-projects/${taskId}/edits/${sessionId}/reject`,
      { method: 'POST' },
    )
    if (res.success) onRejected()
  }

  return (
    <div className="mx-4 my-3 border border-indigo-200 rounded-2xl bg-indigo-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-indigo-200 bg-indigo-100/60">
        <div className="flex items-center gap-2">
          <span className="text-indigo-600 text-sm">📋</span>
          <span className="text-sm font-semibold text-indigo-900">Edit Plan Ready</span>
        </div>
        <p className="text-sm text-indigo-800 mt-1">{explanation}</p>
      </div>

      {files.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs text-indigo-600 font-medium uppercase tracking-wide">
            {files.length} file{files.length !== 1 ? 's' : ''} to modify
          </p>
          {files.map((f) => (
            <div key={f.path} className="flex gap-2.5 items-start">
              <span className="text-indigo-400 text-xs mt-0.5 shrink-0">→</span>
              <div className="min-w-0">
                <p className="text-xs font-mono text-slate-700 truncate">{f.path}</p>
                <p className="text-xs text-slate-500">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && (
        <div className="px-4 py-3">
          <p className="text-sm text-slate-500">No files need to be changed.</p>
        </div>
      )}

      <div className="px-4 py-3 border-t border-indigo-200 flex gap-2">
        <button
          onClick={approve}
          className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          Apply Changes
        </button>
        <button
          onClick={reject}
          className="px-4 py-2 rounded-xl border border-indigo-200 hover:border-indigo-300 text-indigo-600 text-sm transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
