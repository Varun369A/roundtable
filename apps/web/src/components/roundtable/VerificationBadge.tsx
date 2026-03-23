'use client'

import { useState, useRef, useEffect } from 'react'

interface VerificationData {
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'PARTIAL' | 'FAILED'
  confidenceScore: number
  factualScore: number
  completenessScore: number
  citationsFound: number
  issues: Array<{ type: string; severity: string; description: string; suggestion?: string }>
  citations: Array<{ text: string; source: string; url?: string; confidence: number }>
}

interface VerificationBadgeProps {
  verification?: VerificationData
  subtaskId: string
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-semibold text-slate-800">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}

const SEVERITY_CONFIG = {
  high:   { label: 'High',   color: 'text-red-600',   bg: 'bg-red-50 border-red-200' },
  medium: { label: 'Medium', color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200' },
  low:    { label: 'Low',    color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200' },
}

export function VerificationBadge({ verification, subtaskId }: VerificationBadgeProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef  = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current  && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!verification) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-400 border border-slate-200">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Pending
      </span>
    )
  }

  const { status, confidenceScore, factualScore, completenessScore, citationsFound, issues, citations } = verification

  let badgeContent: React.ReactNode
  let badgeClass: string

  switch (status) {
    case 'PASSED':
      badgeClass = 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
      badgeContent = (
        <>
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          {Math.round(confidenceScore)}%
        </>
      )
      break
    case 'PARTIAL':
      badgeClass = 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
      badgeContent = (
        <>
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {Math.round(confidenceScore)}%
        </>
      )
      break
    case 'FAILED':
      badgeClass = 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
      badgeContent = (
        <>
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {Math.round(confidenceScore)}%
        </>
      )
      break
    case 'RUNNING':
      badgeClass = 'bg-blue-50 border-blue-200 text-blue-600'
      badgeContent = (
        <>
          <span className="w-2.5 h-2.5 border border-blue-400 border-t-transparent rounded-full animate-spin" />
          Verifying…
        </>
      )
      break
    default: // PENDING
      badgeClass = 'bg-slate-100 border-slate-200 text-slate-400'
      badgeContent = (
        <>
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Pending
        </>
      )
  }

  const isInteractive = status !== 'RUNNING' && status !== 'PENDING'

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={() => isInteractive && setOpen((v) => !v)}
        aria-label="View verification details"
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${badgeClass} ${isInteractive ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {badgeContent}
      </button>

      {open && isInteractive && (
        <div
          ref={popoverRef}
          className="absolute top-full mt-1.5 right-0 z-50 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 p-4 space-y-4 text-sm"
          role="dialog"
          aria-label="Verification details"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Quality Verification</span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Score bars */}
          <div className="space-y-2.5">
            <ScoreBar
              label="Factual accuracy"
              value={factualScore}
              color={factualScore >= 80 ? 'bg-green-500' : factualScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}
            />
            <ScoreBar
              label="Completeness"
              value={completenessScore}
              color={completenessScore >= 80 ? 'bg-green-500' : completenessScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}
            />
            <ScoreBar
              label="Overall confidence"
              value={confidenceScore}
              color={confidenceScore >= 80 ? 'bg-indigo-500' : confidenceScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}
            />
          </div>

          {/* Issues */}
          {issues.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Issues ({issues.length})
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {issues.map((issue, idx) => {
                  const sev = SEVERITY_CONFIG[(issue.severity?.toLowerCase() as keyof typeof SEVERITY_CONFIG)] || SEVERITY_CONFIG.low
                  return (
                    <div key={idx} className={`px-2.5 py-2 rounded-lg border text-xs ${sev.bg}`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] font-semibold uppercase ${sev.color}`}>{sev.label}</span>
                        <span className="text-slate-400 truncate">{issue.type}</span>
                      </div>
                      <p className="text-slate-700 leading-snug">{issue.description}</p>
                      {issue.suggestion && (
                        <p className="text-slate-400 mt-0.5 leading-snug italic">{issue.suggestion}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Citations */}
          {citations.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Citations ({citationsFound})
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {citations.map((cite, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] text-slate-700 leading-snug line-clamp-2 flex-1">{cite.text}</p>
                      <span className="text-[10px] text-slate-400 font-semibold shrink-0 tabular-nums">
                        {Math.round(cite.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {cite.url ? (
                        <a
                          href={cite.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-indigo-600 hover:text-indigo-500 truncate transition-colors"
                        >
                          {cite.source} ↗
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 truncate">{cite.source}</span>
                      )}
                      <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${Math.round(cite.confidence * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="text-[10px] text-slate-300">
            Subtask ID: <span className="font-mono">{subtaskId.slice(0, 8)}…</span>
          </p>
        </div>
      )}
    </div>
  )
}
