'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StepRun {
  id: string
  stepId: string
  stepName: string
  stepNumber: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
  model?: string
  startedAt?: string
  completedAt?: string
  taskId?: string
  output?: string
  outputValues?: Record<string, string>
  errorMessage?: string
}

interface WorkflowRun {
  id: string
  workflowId: string
  workflowName: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  startedAt: string
  completedAt?: string
  triggeredBy?: string
  stepRuns: StepRun[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function duration(start?: string, end?: string): string {
  if (!start) return '—'
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

function formatTime(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const STEP_STATUS_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  COMPLETED: { icon: '✓', color: 'text-green-400',  bg: 'bg-green-500/15',  border: 'border-green-500/30' },
  FAILED:    { icon: '✗', color: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/30'   },
  RUNNING:   { icon: '⟳', color: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-blue-500/30'  },
  PENDING:   { icon: '○', color: 'text-zinc-600',   bg: 'bg-zinc-800/40',   border: 'border-zinc-700/30'  },
  SKIPPED:   { icon: '—', color: 'text-zinc-600',   bg: 'bg-zinc-800/40',   border: 'border-zinc-700/30'  },
}

const RUN_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  RUNNING:   { label: 'Running',   color: 'text-blue-400',  bg: 'bg-blue-500/15',  border: 'border-blue-500/30'  },
  COMPLETED: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/30' },
  FAILED:    { label: 'Failed',    color: 'text-red-400',   bg: 'bg-red-500/15',   border: 'border-red-500/30'   },
}

// ─── Step Timeline Item ────────────────────────────────────────────────────────

function StepTimelineItem({ stepRun, isLast }: { stepRun: StepRun; isLast: boolean }) {
  const [expanded, setExpanded] = useState(stepRun.status === 'FAILED')
  const cfg = STEP_STATUS_CONFIG[stepRun.status] || STEP_STATUS_CONFIG.PENDING

  return (
    <div className="flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center text-sm font-bold ${cfg.color} ${stepRun.status === 'RUNNING' ? 'animate-spin' : ''}`}>
          {cfg.icon}
        </div>
        {!isLast && <div className="w-px flex-1 bg-zinc-800 mt-1 mb-0 min-h-4" />}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
        <div
          className={`bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden transition-all duration-200 ${
            stepRun.status !== 'PENDING' ? 'cursor-pointer hover:border-zinc-700' : ''
          }`}
          onClick={() => stepRun.status !== 'PENDING' && setExpanded((v) => !v)}
        >
          {/* Step header */}
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-500 shrink-0">
              {stepRun.stepNumber}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-300 truncate">{stepRun.stepName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {stepRun.model && (
                  <span className="text-[11px] text-zinc-600">{stepRun.model}</span>
                )}
                {stepRun.startedAt && (
                  <span className="text-[11px] text-zinc-700">
                    {formatTime(stepRun.startedAt)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-zinc-500">{duration(stepRun.startedAt, stepRun.completedAt)}</span>
              {stepRun.taskId && (
                <Link
                  href={`/roundtable/${stepRun.taskId}`}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Arivarangam →
                </Link>
              )}
              {stepRun.status !== 'PENDING' && (
                <span className="text-zinc-600 text-xs">{expanded ? '▲' : '▼'}</span>
              )}
            </div>
          </div>

          {/* Expanded content */}
          {expanded && (
            <div className="border-t border-zinc-800 px-4 py-3">
              {stepRun.status === 'FAILED' && stepRun.errorMessage && (
                <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-xs text-red-400 font-medium mb-0.5">Error</p>
                  <p className="text-xs text-red-300/80">{stepRun.errorMessage}</p>
                </div>
              )}

              {stepRun.output && (
                <div className="mb-3">
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Output Preview</p>
                  <p className="text-xs text-zinc-400 line-clamp-4 leading-relaxed">{stepRun.output}</p>
                </div>
              )}

              {stepRun.outputValues && Object.keys(stepRun.outputValues).length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Extracted Values</p>
                  <div className="space-y-1.5">
                    {Object.entries(stepRun.outputValues).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-2">
                        <code className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded font-mono shrink-0">{key}</code>
                        <p className="text-[11px] text-zinc-500 line-clamp-2">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkflowRunPage({ params }: { params: { id: string; runId: string } }) {
  const router                      = useRouter()
  const [run, setRun]               = useState<WorkflowRun | null>(null)
  const [loading, setLoading]       = useState(true)
  const [rerunning, setRerunning]   = useState(false)

  const load = useCallback(async () => {
    const res = await apiFetch<{ run: WorkflowRun }>(
      `/api/v1/workflows/${params.id}/runs/${params.runId}`,
    )
    if (res.success && res.data?.run) {
      setRun(res.data.run)
    } else {
      router.push(`/workflows/${params.id}`)
    }
    setLoading(false)
  }, [params.id, params.runId, router])

  useEffect(() => { load() }, [load])

  // Auto-refresh while running
  useEffect(() => {
    if (!run || run.status !== 'RUNNING') return
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [run, load])

  async function handleRerun() {
    setRerunning(true)
    const res = await apiFetch<{ run: { id: string } }>(
      `/api/v1/workflows/${params.id}/run`,
      { method: 'POST' },
    )
    setRerunning(false)
    if (res.success && res.data?.run) {
      router.push(`/workflows/${params.id}/runs/${res.data.run.id}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (!run) return null

  const cfg              = RUN_STATUS_CONFIG[run.status] || RUN_STATUS_CONFIG.RUNNING
  const completedSteps   = run.stepRuns.filter((s) => s.status === 'COMPLETED').length
  const totalSteps       = run.stepRuns.length
  const canRerun         = run.status === 'COMPLETED' || run.status === 'FAILED'

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-10 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/workflows/${params.id}`} className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm shrink-0">
            ← {run.workflowName}
          </Link>
          <div className="h-4 w-px bg-zinc-800 shrink-0" />
          <span className="text-sm text-zinc-400">Run Details</span>
        </div>
        {canRerun && (
          <button
            onClick={handleRerun}
            disabled={rerunning}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all duration-200 active:scale-95"
          >
            {rerunning ? '⟳ Starting…' : '↺ Re-run Workflow'}
          </button>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">

        {/* Run status card */}
        <div className={`${cfg.bg} border ${cfg.border} rounded-2xl px-6 py-5 mb-8`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {run.status === 'RUNNING' && (
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                )}
                <span className={`text-lg font-bold ${cfg.color}`}>{cfg.label}</span>
              </div>
              <p className="text-sm text-zinc-500">
                {run.workflowName}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                Started {new Date(run.startedAt).toLocaleString()}
                {run.completedAt && ` · ${duration(run.startedAt, run.completedAt)}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-zinc-200">
                {completedSteps}<span className="text-zinc-600 text-lg">/{totalSteps}</span>
              </p>
              <p className="text-xs text-zinc-600">steps done</p>
            </div>
          </div>

          {/* Progress bar */}
          {totalSteps > 0 && (
            <div className="mt-4">
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    run.status === 'FAILED' ? 'bg-red-500' :
                    run.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Step Timeline */}
        <h2 className="text-sm font-semibold text-zinc-300 mb-6">Step Timeline</h2>

        {run.stepRuns.length === 0 ? (
          <div className="text-center py-12 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <p className="text-zinc-600 text-sm">No steps to show.</p>
          </div>
        ) : (
          <div>
            {run.stepRuns.map((stepRun, index) => (
              <StepTimelineItem
                key={stepRun.id}
                stepRun={stepRun}
                isLast={index === run.stepRuns.length - 1}
              />
            ))}
          </div>
        )}

        {/* Re-run CTA at bottom */}
        {canRerun && (
          <div className="mt-6 text-center">
            <button
              onClick={handleRerun}
              disabled={rerunning}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95"
            >
              {rerunning ? 'Starting…' : '↺ Re-run Workflow'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
