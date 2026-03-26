'use client'

import { useEffect, useRef, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTaskStream } from '@/hooks/useTaskStream'
import { ClarificationModal } from '@/components/roundtable/ClarificationModal'
import { PlanApprovalModal } from '@/components/roundtable/PlanApprovalModal'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskInfo {
  id: string
  title: string
  originalGoal: string
  status: string
}

interface EngineStage {
  id: string
  name: string
  description: string
  steps: string[]
  icon: string
}

interface LogEntry {
  time: number
  step: string
  message: string
  progress: number
}

// ─── Engine Pipeline Definition ───────────────────────────────────────────────

const ENGINES: EngineStage[] = [
  {
    id: 'understanding',
    name: 'Understanding Engine',
    description: 'Parsing intent, memory & context',
    steps: ['understanding'],
    icon: '◎',
  },
  {
    id: 'build',
    name: 'Build Engine',
    description: 'Architecture → Code generation → Quality',
    steps: ['architecture', 'generating', 'quality', 'rebuild'],
    icon: '⬡',
  },
  {
    id: 'intelligence',
    name: 'Intelligence Engine',
    description: 'Delivery packaging, error analysis & learning',
    steps: ['delivery', 'error', 'learning'],
    icon: '✦',
  },
]

const STEP_TO_ENGINE: Record<string, string> = {
  understanding: 'understanding',
  architecture: 'build',
  generating: 'build',
  quality: 'build',
  rebuild: 'build',
  delivery: 'intelligence',
  error: 'intelligence',
  learning: 'intelligence',
}

function stepToEngine(step: string): string {
  return STEP_TO_ENGINE[step] ?? (step.includes('understanding') ? 'understanding' : step.includes('quality') || step.includes('generat') || step.includes('archit') ? 'build' : 'intelligence')
}

type EngineState = 'idle' | 'running' | 'done'

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  B: 'text-blue-600 bg-blue-50 border-blue-200',
  C: 'text-amber-600 bg-amber-50 border-amber-200',
  D: 'text-orange-600 bg-orange-50 border-orange-200',
  F: 'text-red-600 bg-red-50 border-red-200',
}

// ─── Pipeline Visual ──────────────────────────────────────────────────────────

function PipelineEngine({
  engine,
  state,
  currentMessage,
  progress,
}: {
  engine: EngineStage
  state: EngineState
  currentMessage?: string
  progress?: number
}) {
  const isRunning = state === 'running'
  const isDone = state === 'done'

  return (
    <div className={`rounded-2xl border transition-all duration-500 overflow-hidden ${
      isRunning ? 'border-indigo-300 bg-white shadow-lg shadow-indigo-100/60' :
      isDone    ? 'border-emerald-200 bg-emerald-50/30' :
                  'border-slate-200 bg-white opacity-50'
    }`}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold border transition-all ${
              isRunning ? 'bg-indigo-50 border-indigo-200 text-indigo-600' :
              isDone    ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                          'bg-slate-50 border-slate-200 text-slate-400'
            }`}>
              {isDone ? '✓' : engine.icon}
            </div>
            <div>
              <p className={`text-sm font-semibold ${isRunning ? 'text-slate-900' : isDone ? 'text-slate-700' : 'text-slate-400'}`}>
                {engine.name}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{engine.description}</p>
            </div>
          </div>

          {/* Status badge */}
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
            isRunning ? 'bg-indigo-100 text-indigo-600 border-indigo-200' :
            isDone    ? 'bg-emerald-100 text-emerald-600 border-emerald-200' :
                        'bg-slate-100 text-slate-400 border-slate-200'
          }`}>
            {isRunning ? 'RUNNING' : isDone ? 'DONE' : 'WAITING'}
          </span>
        </div>

        {/* Progress bar */}
        {(isRunning || isDone) && (
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isRunning ? 'bg-indigo-500' : 'bg-emerald-500'}`}
              style={{ width: isDone ? '100%' : `${Math.max(10, progress ?? 20)}%` }}
            />
          </div>
        )}

        {/* Current message */}
        {isRunning && currentMessage && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex gap-0.5 shrink-0">
              {[0, 100, 200].map((d) => (
                <div key={d} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            <p className="text-xs text-slate-600 truncate">{currentMessage}</p>
          </div>
        )}

        {isDone && !isRunning && (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <span>✓</span> Complete
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GenerationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = use(params)
  const router = useRouter()

  const [task, setTask] = useState<TaskInfo | null>(null)
  const [engineStates, setEngineStates] = useState<Record<string, EngineState>>({
    understanding: 'idle',
    build: 'idle',
    intelligence: 'idle',
  })
  const [activeEngine, setActiveEngine] = useState<string | null>(null)
  const [currentMessage, setCurrentMessage] = useState('')
  const [overallProgress, setOverallProgress] = useState(0)
  const [log, setLog] = useState<LogEntry[]>([])
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)
  const [failedReason, setFailedReason] = useState('')
  const [qualityGrade, setQualityGrade] = useState<string | null>(null)
  const [qualityScore, setQualityScore] = useState<number | null>(null)
  const [fileCount, setFileCount] = useState<number | null>(null)
  const [clarificationQuestions, setClarificationQuestions] = useState<any[]>([])
  const [showClarification, setShowClarification] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<any | null>(null)
  const [taskStarted, setTaskStarted] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  // Load task info
  useEffect(() => {
    apiFetch(`/api/v1/tasks/${taskId}`).then((data) => {
      if (data.success) {
        setTask(data.data as TaskInfo)
        if (data.data.status === 'COMPLETED') {
          setDone(true)
          setOverallProgress(100)
        } else if (data.data.status === 'FAILED') {
          setFailed(true)
        } else if (data.data.status === 'AWAITING_PLAN_APPROVAL') {
          // Fetch the plan from Redis and show modal
          apiFetch(`/api/v1/tasks/${taskId}/plan`).then((planRes) => {
            if (planRes.success && planRes.data?.plan) {
              setPendingPlan(planRes.data.plan)
            }
          })
        }
      }
    })
  }, [taskId])

  // Start the task
  useEffect(() => {
    if (!task || taskStarted) return
    if (task.status === 'COMPLETED' || task.status === 'FAILED') return
    setTaskStarted(true)
    apiFetch(`/api/v1/tasks/${taskId}/start`, { method: 'POST' }).catch(() => {})
  }, [task, taskId, taskStarted])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const { connected } = useTaskStream({
    taskId,
    enabled: !done && !failed,
    onEvent(ev) {
      if (ev.event === 'engine_started') {
        // Pipeline started
        setActiveEngine('understanding')
        setEngineStates(s => ({ ...s, understanding: 'running' }))
        setCurrentMessage('Analyzing your request…')
        setLog(l => [...l, { time: Date.now(), step: 'start', message: 'Pipeline started', progress: 0 }])
      }

      if (ev.event === 'task:progress') {
        const step = ev.step ?? ''
        const msg = ev.message ?? ''
        const prog = ev.progress ?? 0

        setOverallProgress(prog)
        setCurrentMessage(msg)

        // Update engine states
        const eng = stepToEngine(step)
        setActiveEngine(eng)
        setEngineStates(s => {
          const next = { ...s }
          // Mark previous engines done
          const order = ['understanding', 'build', 'intelligence']
          const engIdx = order.indexOf(eng)
          for (let i = 0; i < engIdx; i++) {
            if (next[order[i]] !== 'done') next[order[i]] = 'done'
          }
          next[eng] = 'running'
          return next
        })

        setLog(l => [...l, { time: Date.now(), step, message: msg, progress: prog }])
      }

      if (ev.event === 'plan_ready') {
        setPendingPlan(ev.plan)
        setActiveEngine(null)
        setCurrentMessage('Waiting for plan approval…')
        setLog(l => [...l, { time: Date.now(), step: 'plan', message: 'Build plan ready — awaiting approval', progress: 20 }])
      }

      if (ev.event === 'clarification_needed') {
        setClarificationQuestions(ev.questions ?? [])
        setShowClarification(true)
        setActiveEngine(null)
        setCurrentMessage('')
      }

      if (ev.event === 'task_completed') {
        setDone(true)
        setOverallProgress(100)
        setQualityGrade(ev.qualityGrade ?? null)
        setQualityScore(ev.overallScore ?? null)
        setFileCount(ev.fileCount ?? null)
        setActiveEngine(null)
        setEngineStates({ understanding: 'done', build: 'done', intelligence: 'done' })
        setLog(l => [...l, { time: Date.now(), step: 'done', message: 'Generation complete', progress: 100 }])
        setTask(t => t ? { ...t, status: 'COMPLETED' } : t)
      }

      if (ev.event === 'task_failed') {
        setFailed(true)
        setFailedReason(ev.error ?? 'An error occurred')
        setActiveEngine(null)
        setLog(l => [...l, { time: Date.now(), step: 'failed', message: ev.error ?? 'Failed', progress: overallProgress }])
      }
    },
  })

  const gradeStyle = qualityGrade ? (GRADE_COLORS[qualityGrade] ?? GRADE_COLORS['C']) : ''

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 transition-colors text-sm">
            ← Dashboard
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <p className="text-sm font-semibold text-slate-800 line-clamp-1">
              {task?.originalGoal?.slice(0, 80) ?? 'Loading…'}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                done    ? 'bg-emerald-100 text-emerald-700' :
                failed  ? 'bg-red-100 text-red-600' :
                          'bg-indigo-100 text-indigo-600'
              }`}>
                {done ? 'COMPLETE' : failed ? 'FAILED' : 'GENERATING'}
              </span>
              <span className="text-[10px] text-slate-400">
                {connected ? '● live' : '○ connecting…'}
              </span>
            </div>
          </div>
        </div>

        {done && (
          <Link
            href={`/workspace/${taskId}`}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <span>View Code</span>
            <span>→</span>
          </Link>
        )}
      </header>

      <div className="flex-1 flex">
        {/* Left — Engine Pipeline */}
        <div className="w-80 shrink-0 bg-white border-r border-slate-200 p-5 flex flex-col gap-4">
          {/* Overall progress */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Pipeline</p>
              <span className="text-xs font-bold text-slate-700">{overallProgress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Arrow connectors between engines */}
          <div className="flex flex-col gap-2">
            {ENGINES.map((engine, i) => (
              <div key={engine.id}>
                <PipelineEngine
                  engine={engine}
                  state={engineStates[engine.id]}
                  currentMessage={activeEngine === engine.id ? currentMessage : undefined}
                  progress={activeEngine === engine.id ? overallProgress : undefined}
                />
                {i < ENGINES.length - 1 && (
                  <div className="flex justify-center my-1">
                    <div className={`w-px h-5 transition-colors ${
                      engineStates[engine.id] === 'done' ? 'bg-emerald-300' : 'bg-slate-200'
                    }`} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Result summary */}
          {done && (
            <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold text-emerald-800 mb-3">Generation Complete</p>
              <div className="flex items-center gap-3">
                {qualityGrade && (
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black border ${gradeStyle}`}>
                    {qualityGrade}
                  </div>
                )}
                <div>
                  {qualityScore !== null && (
                    <p className="text-sm font-bold text-slate-800">{qualityScore}/100</p>
                  )}
                  {fileCount !== null && (
                    <p className="text-xs text-slate-500">{fileCount} file{fileCount !== 1 ? 's' : ''} generated</p>
                  )}
                </div>
              </div>
              <Link
                href={`/workspace/${taskId}`}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Open Code Workspace →
              </Link>
            </div>
          )}

          {failed && (
            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-semibold text-red-700 mb-1">Generation Failed</p>
              <p className="text-xs text-red-600 leading-relaxed">{failedReason}</p>
              <button
                onClick={() => {
                  setFailed(false)
                  setTaskStarted(false)
                  setEngineStates({ understanding: 'idle', build: 'idle', intelligence: 'idle' })
                  setOverallProgress(0)
                  setLog([])
                  apiFetch(`/api/v1/tasks/${taskId}/start`, { method: 'POST' }).catch(() => {})
                }}
                className="mt-3 w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Right — Activity Log */}
        <div className="flex-1 flex flex-col">
          {/* Current status */}
          {!done && !failed && (
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <p className="text-sm text-slate-600">{currentMessage || 'Initialising pipeline…'}</p>
            </div>
          )}

          {/* Log entries */}
          <div
            ref={logRef}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-2"
          >
            {log.length === 0 && !done && !failed && (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <div className="text-3xl mb-3">◎</div>
                <p className="text-sm">Starting the intelligence pipeline…</p>
              </div>
            )}

            {log.map((entry, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 py-2.5 px-3 rounded-xl text-sm transition-all ${
                  entry.step === 'done'   ? 'bg-emerald-50 border border-emerald-100' :
                  entry.step === 'failed' ? 'bg-red-50 border border-red-100' :
                  entry.step === 'start'  ? 'bg-indigo-50 border border-indigo-100' :
                                            'bg-white border border-slate-100'
                }`}
              >
                <span className={`text-[10px] mt-0.5 shrink-0 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  entry.step === 'done'          ? 'bg-emerald-100 text-emerald-600' :
                  entry.step === 'failed'        ? 'bg-red-100 text-red-600' :
                  entry.step === 'start'         ? 'bg-indigo-100 text-indigo-600' :
                  entry.step === 'understanding' ? 'bg-violet-100 text-violet-600' :
                  entry.step === 'architecture'  ? 'bg-blue-100 text-blue-600' :
                  entry.step === 'generating'    ? 'bg-cyan-100 text-cyan-600' :
                  entry.step === 'quality'       ? 'bg-amber-100 text-amber-600' :
                  entry.step === 'rebuild'       ? 'bg-orange-100 text-orange-600' :
                                                   'bg-slate-100 text-slate-500'
                }`}>
                  {entry.step === 'start' ? 'INIT' : entry.step.toUpperCase()}
                </span>
                <span className={`flex-1 leading-relaxed ${
                  entry.step === 'done' ? 'text-emerald-700 font-medium' :
                  entry.step === 'failed' ? 'text-red-600' :
                  'text-slate-700'
                }`}>
                  {entry.message}
                </span>
                {entry.progress > 0 && entry.step !== 'done' && (
                  <span className="text-[10px] text-slate-400 shrink-0">{entry.progress}%</span>
                )}
              </div>
            ))}

            {/* Done state */}
            {done && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 text-center">
                <div className="text-3xl mb-2">✦</div>
                <p className="text-base font-bold text-slate-800 mb-1">Code generation complete</p>
                {qualityGrade && qualityScore && (
                  <p className="text-sm text-slate-500 mb-4">
                    Quality score: <span className="font-bold text-slate-700">{qualityScore}/100</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-lg border text-xs font-bold ${gradeStyle}`}>{qualityGrade}</span>
                  </p>
                )}
                <Link
                  href={`/workspace/${taskId}`}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
                >
                  Open Code Workspace →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clarification modal */}
      {showClarification && (
        <ClarificationModal
          questions={clarificationQuestions}
          taskId={taskId}
          onComplete={() => {
            setShowClarification(false)
            setTaskStarted(false)
          }}
        />
      )}

      {/* Plan Approval modal */}
      {pendingPlan && (
        <PlanApprovalModal
          taskId={taskId}
          plan={pendingPlan}
          onApproved={() => {
            setPendingPlan(null)
            setCurrentMessage('Build approved — generating code…')
            setEngineStates(s => ({ ...s, understanding: 'done', build: 'running' }))
            setActiveEngine('build')
          }}
          onRejected={() => {
            setPendingPlan(null)
            setFailed(true)
            setFailedReason('Build cancelled at plan review.')
          }}
        />
      )}
    </div>
  )
}
