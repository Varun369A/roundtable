'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface Suggestion {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: 'security' | 'performance' | 'feature' | 'best-practice' | 'testing'
  filePath?: string
  editPrompt?: string
}

interface SuggestionsPanelProps {
  taskId: string
  onEditRequest: (prompt: string) => void  // switch to Edit tab with pre-filled prompt
}

const PRIORITY_COLOR: Record<string, string> = {
  high:   'text-red-600 bg-red-50 border-red-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low:    'text-slate-500 bg-slate-100 border-slate-200',
}

const CATEGORY_ICON: Record<string, string> = {
  security:      '🔒',
  performance:   '⚡',
  feature:       '✨',
  'best-practice': '📐',
  testing:       '🧪',
}

export function SuggestionsPanel({ taskId, onEditRequest }: SuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ suggestions: Suggestion[] }>(`/api/v1/code-projects/${taskId}/suggestions`)
      .then((res) => {
        if (res.success) setSuggestions(res.data?.suggestions ?? [])
      })
      .finally(() => setLoading(false))
  }, [taskId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="flex gap-2">
          {[0, 150, 300].map((d) => (
            <div key={d} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center px-4">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-sm font-medium text-slate-700">No issues found</p>
        <p className="text-xs text-slate-400 mt-1">AI analysis found no critical improvements to suggest</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-100">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          {suggestions.length} AI Suggestion{suggestions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {suggestions.map((s) => (
        <div key={s.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0 mt-0.5">{CATEGORY_ICON[s.category] ?? '💡'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border uppercase ${PRIORITY_COLOR[s.priority]}`}>
                  {s.priority}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{s.description}</p>
              {s.filePath && (
                <p className="text-[11px] font-mono text-slate-400 mt-1 truncate">{s.filePath}</p>
              )}
              {s.editPrompt && (
                <button
                  onClick={() => onEditRequest(s.editPrompt!)}
                  className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 font-medium transition-colors"
                >
                  ✏️ Auto-fix with AI
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
