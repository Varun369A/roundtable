'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'

interface Plan {
  goal: string
  complexity: 'low' | 'medium' | 'high'
  domain: string
  detectedTech: string[]
  estimatedFiles: number
  estimatedMinutes: number
}

interface PlanApprovalModalProps {
  taskId: string
  plan: Plan
  onApproved: () => void
  onRejected: () => void
}

const COMPLEXITY_LABEL: Record<string, string> = {
  low: 'Simple',
  medium: 'Medium',
  high: 'Complex',
}

const COMPLEXITY_COLOR: Record<string, string> = {
  low: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  high: 'text-violet-600 bg-violet-50 border-violet-200',
}

export function PlanApprovalModal({ taskId, plan, onApproved, onRejected }: PlanApprovalModalProps) {
  const [modification, setModification] = useState('')
  const [showModify, setShowModify] = useState(false)
  const [loading, setLoading] = useState(false)

  async function approve() {
    setLoading(true)
    await apiFetch(`/api/v1/tasks/${taskId}/plan/approve`, {
      method: 'POST',
      body: JSON.stringify({ modification: modification.trim() || undefined }),
    })
    setLoading(false)
    onApproved()
  }

  async function reject() {
    setLoading(true)
    await apiFetch(`/api/v1/tasks/${taskId}/plan/reject`, { method: 'POST' })
    setLoading(false)
    onRejected()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg">📋</div>
            <div>
              <h2 className="text-white font-bold text-base">Build Plan Ready</h2>
              <p className="text-indigo-200 text-xs mt-0.5">Review before generation starts</p>
            </div>
          </div>
        </div>

        {/* Plan details */}
        <div className="px-6 py-5 space-y-4">
          {/* Goal */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">What we're building</p>
            <p className="text-sm text-slate-800 leading-relaxed">"{plan.goal}"</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1">Complexity</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${COMPLEXITY_COLOR[plan.complexity] ?? COMPLEXITY_COLOR['medium']}`}>
                {COMPLEXITY_LABEL[plan.complexity] ?? 'Medium'}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 mb-1">Estimated</p>
              <p className="text-sm font-semibold text-slate-800">~{plan.estimatedFiles} files, {plan.estimatedMinutes}min</p>
            </div>
          </div>

          {/* Tech stack */}
          {plan.detectedTech.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Detected tech preferences</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.detectedTech.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Modification input */}
          {showModify && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Custom instruction</p>
              <textarea
                value={modification}
                onChange={(e) => setModification(e.target.value)}
                placeholder="e.g. Use React + Express instead of Next.js, skip auth, add WebSocket support…"
                rows={3}
                className="w-full resize-none px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 focus:border-indigo-500 focus:outline-none text-sm text-slate-900 placeholder-slate-400 transition-colors"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex flex-col gap-2">
          <button
            onClick={approve}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Starting build…' : modification ? 'Approve with modifications →' : 'Approve & Build →'}
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setShowModify((v) => !v)}
              className="flex-1 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-medium transition-colors"
            >
              {showModify ? 'Hide modifications' : '✏️ Modify first'}
            </button>
            <button
              onClick={reject}
              disabled={loading}
              className="flex-1 py-2 rounded-xl border border-red-200 hover:border-red-300 text-red-600 text-xs font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
