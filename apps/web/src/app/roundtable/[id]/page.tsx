'use client'

import { useEffect, useRef, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTaskStream, StreamEvent } from '@/hooks/useTaskStream'
import { MessageBubble, TypingIndicator } from '@/components/roundtable'
import { PreviewPane, type PreviewUpdate } from '@/components/roundtable/PreviewPane'
import { ClarificationModal } from '@/components/roundtable/ClarificationModal'
import { SteeringInput } from '@/components/roundtable/SteeringInput'
import { SessionPanel } from '@/components/roundtable/SessionPanel'
import { ReactionBar } from '@/components/roundtable/ReactionBar'
import { VerificationBadge } from '@/components/roundtable/VerificationBadge'
import { VoiceInputButton } from '@/components/roundtable/VoiceInputButton'
import type { Message } from '@/components/roundtable'
import { apiFetch } from '@/lib/api'
import RequestReviewModal from '@/components/marketplace/RequestReviewModal'

interface TaskInfo {
  id: string
  title: string
  originalGoal: string
  status: string
  template?: { category: string }
}

interface VerificationData {
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'PARTIAL' | 'FAILED'
  confidenceScore: number
  factualScore: number
  completenessScore: number
  citationsFound: number
  issues: Array<{ type: string; severity: string; description: string; suggestion?: string }>
  citations: Array<{ text: string; source: string; url?: string; confidence: number }>
}

interface ActionData {
  id: string
  subtaskId: string
  type: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED'
}

interface ActiveSubtask {
  subtaskId: string
  title: string
  model: string
  role?: 'INITIAL' | 'REVIEW' | 'SYNTHESIS'
  roundNumber?: number
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:               { label: 'Queued',      color: 'text-amber-600' },
  ROUTING:               { label: 'Routing…',    color: 'text-blue-600'   },
  IN_PROGRESS:           { label: 'Live',        color: 'text-indigo-600'  },
  COMPLETED:             { label: 'Complete',    color: 'text-emerald-600'  },
  FAILED:                { label: 'Failed',      color: 'text-red-600'    },
  CANCELLED:             { label: 'Cancelled',   color: 'text-slate-500'   },
  WAITING_CLARIFICATION: { label: 'Needs input', color: 'text-amber-600' },
}

export default function RoundtablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [task, setTask]                     = useState<TaskInfo | null>(null)
  const [messages, setMessages]             = useState<Message[]>([])
  const [activeSubtasks, setActiveSubtasks] = useState<ActiveSubtask[]>([])
  const [taskStatus, setTaskStatus]         = useState<string>('PENDING')
  const [hasCodeWorkspace, setHasCodeWorkspace] = useState(false)
  const [previewUpdates, setPreviewUpdates] = useState<PreviewUpdate[]>([])
  const [showPreview, setShowPreview]       = useState(true)
  const [activeTab, setActiveTab]           = useState<'feed' | 'preview'>('feed')
  const [discussionRound, setDiscussionRound] = useState<1 | 2 | 3>(1)
  const [synthesisComplete, setSynthesisComplete] = useState(false)
  const [clarifications, setClarifications] = useState<any[]>([])
  const [showClarification, setShowClarification] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  // Phase 3: verification and actions
  const [verifications, setVerifications]   = useState<Record<string, VerificationData>>({})
  const [pendingActions, setPendingActions] = useState<Record<string, number>>({}) // subtaskId → count
  const [steeringText, setSteeringText]     = useState('')
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewToast, setReviewToast]       = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)

  // Auto-scroll to bottom only when user is already near the bottom
  const mainRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    const distFromBottom = main.scrollHeight - main.scrollTop - main.clientHeight
    if (distFromBottom < 200) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeSubtasks])

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id:        `sys-${Date.now()}`,
        type:      'system',
        title:     text,
        timestamp: new Date(),
      },
    ])
  }

  // Load task metadata and auto-start if PENDING
  useEffect(() => {
    async function init() {
      const result = await apiFetch<{ task: TaskInfo }>(`/api/v1/tasks/${id}`)
      if (!result.success || !result.data) {
        router.push('/dashboard')
        return
      }

      const t = result.data.task
      setTask(t)
      setTaskStatus(t.status)

      if (t.status === 'PENDING' && !hasStarted.current) {
        hasStarted.current = true
        await apiFetch(`/api/v1/tasks/${id}/start`, { method: 'POST' })
        setTaskStatus('ROUTING')
        addSystemMessage('Analysing your goal and assembling the team…')
      } else if (t.status === 'WAITING_CLARIFICATION') {
        // Task is paused waiting for user input — load and show questions
        const clRes = await apiFetch<{ questions: any[] }>(`/api/v1/tasks/${id}/clarifications`)
        if (clRes.success && clRes.data?.questions?.length) {
          setClarifications(clRes.data.questions)
          setShowClarification(true)
        }
      } else if (t.status === 'ROUTING' || t.status === 'IN_PROGRESS') {
        addSystemMessage('Reconnected — resuming…')
      }
    }
    init()
  }, [id, router])

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    switch (event.event) {
      case 'connected':
        if (event.status) setTaskStatus(event.status)
        break

      case 'subtask_started':
        if (event.subtaskId && event.model) {
          setActiveSubtasks((prev) => [
            ...prev.filter((s) => s.subtaskId !== event.subtaskId),
            {
              subtaskId:   event.subtaskId!,
              title:       event.title || '',
              model:       event.model!,
              role:        event.role,
              roundNumber: event.roundNumber,
            },
          ])
        }
        break

      case 'subtask_completed':
        setActiveSubtasks((prev) =>
          prev.filter((s) => s.subtaskId !== event.subtaskId),
        )
        setMessages((prev) => [
          ...prev,
          {
            id:          event.subtaskId || `msg-${Date.now()}`,
            type:        'ai',
            model:       event.model,
            title:       event.title,
            output:      event.output as Message['output'],
            timestamp:   new Date(),
            // Discussion Engine fields
            role:        event.role,
            roundNumber: event.roundNumber,
          },
        ])
        // Add preview update if available
        if (event.preview) {
          setPreviewUpdates((prev) => [
            ...prev,
            {
              subtaskTitle: event.title || 'Output',
              type:         event.preview!.type,
              html:         event.preview!.html,
              timestamp:    new Date(),
            },
          ])
          // Auto-switch to preview tab on mobile when content arrives
          setActiveTab('preview')
        }
        break

      case 'subtask_failed':
        setActiveSubtasks((prev) =>
          prev.filter((s) => s.subtaskId !== event.subtaskId),
        )
        setMessages((prev) => [
          ...prev,
          {
            id:        event.subtaskId || `err-${Date.now()}`,
            type:      'ai',
            isError:   true,
            title:     'A step encountered an error',
            timestamp: new Date(),
          },
        ])
        break

      case 'auto_fix_started':
        addSystemMessage(`Auto-correcting errors: ${(event.errors || []).slice(0, 2).join(', ')}`)
        break

      case 'discussion_round_started':
        setDiscussionRound(2)
        addSystemMessage('Round 2 — Peer Review: AIs are critiquing and enriching each other\'s work…')
        break

      case 'synthesis_started':
        setDiscussionRound(3)
        addSystemMessage('Round 3 — Synthesis: Integrating all outputs into the final result…')
        break

      case 'synthesis_complete':
        setSynthesisComplete(true)
        break

      case 'task_completed':
        setTaskStatus('COMPLETED')
        setActiveSubtasks([])
        if (event.hasCodeWorkspace) setHasCodeWorkspace(true)
        addSystemMessage('All done — your deliverables are ready.')
        // Fetch verifications and pending actions after task completes
        ;(async () => {
          const [verRes, actRes] = await Promise.all([
            apiFetch<{ verifications: Array<{ subtaskId: string } & VerificationData> }>(
              `/api/v1/tasks/${id}/verifications`,
            ),
            apiFetch<{ actions: ActionData[] }>(`/api/v1/tasks/${id}/actions`),
          ])
          if (verRes.success && verRes.data?.verifications) {
            const map: Record<string, VerificationData> = {}
            for (const v of verRes.data.verifications) {
              map[v.subtaskId] = v
            }
            setVerifications(map)
          }
          if (actRes.success && actRes.data?.actions) {
            const counts: Record<string, number> = {}
            for (const a of actRes.data.actions) {
              if (a.status === 'PENDING') {
                counts[a.subtaskId] = (counts[a.subtaskId] || 0) + 1
              }
            }
            setPendingActions(counts)
          }
        })()
        break

      case 'task_failed':
        setTaskStatus('FAILED')
        setActiveSubtasks([])
        addSystemMessage('Task encountered errors. Partial results are shown above.')
        break

      case 'task_cancelled':
        setTaskStatus('CANCELLED')
        setActiveSubtasks([])
        addSystemMessage('Task was cancelled.')
        break

      case 'clarification_needed':
        setClarifications(event.questions || [])
        setShowClarification(true)
        setTaskStatus('WAITING_CLARIFICATION')
        break

      case 'steering_received':
        addSystemMessage(`Steering queued: "${event.message}"`)
        break

      case 'steering_applied':
        addSystemMessage(`Steering applied to current step ✓`)
        break

      case 'session_created':
        if (event.sessionId) setSessionId(event.sessionId)
        break
    }
  }, [])

  const { connected } = useTaskStream({
    taskId:  id,
    onEvent: handleStreamEvent,
    enabled: !!task,
  })

  const statusCfg = STATUS_LABEL[taskStatus] || STATUS_LABEL.PENDING
  const isLive    = ['ROUTING', 'IN_PROGRESS'].includes(taskStatus)
  const hasPreview = previewUpdates.length > 0

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="max-w-none px-4 h-14 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-slate-500 hover:text-slate-700 transition-colors text-sm shrink-0"
          >
            ← Dashboard
          </Link>

          <div className="h-4 w-px bg-slate-200" />

          <p className="flex-1 text-sm font-medium truncate text-slate-900">
            {task?.originalGoal || '…'}
          </p>

          <div className="flex items-center gap-3 shrink-0">
            {/* Cancel button — only for non-terminal tasks */}
            {!['COMPLETED', 'FAILED', 'CANCELLED'].includes(taskStatus) && (
              <button
                onClick={async () => {
                  if (!confirm('Cancel this task?')) return
                  await apiFetch(`/api/v1/tasks/${id}`, { method: 'DELETE' })
                  router.push('/dashboard')
                }}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Preview toggle (desktop) */}
            {hasPreview && (
              <button
                onClick={() => setShowPreview((v) => !v)}
                className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  showPreview
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                    : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}
              >
                👁 Preview
              </button>
            )}

            {/* Status */}
            <div className="flex items-center gap-2">
              {isLive && (
                <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse-slow" />
              )}
              <span className={`text-xs font-semibold ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>

            {/* Multiplayer session */}
            <SessionPanel
              taskId={id}
              taskStatus={taskStatus}
              isOwner={true}
            />
          </div>
        </div>

        {/* Mobile tabs — only show when we have preview content */}
        {hasPreview && (
          <div className="flex md:hidden border-t border-slate-200">
            {(['feed', 'preview'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-slate-900 border-b-2 border-indigo-500'
                    : 'text-slate-500'
                }`}
              >
                {tab === 'feed' ? '💬 Feed' : '👁 Preview'}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Body (split on desktop, tabs on mobile) ─────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Message Feed */}
        <main
          ref={mainRef}
          className={`flex flex-col overflow-y-auto ${
            hasPreview && showPreview ? 'hidden md:flex md:w-[55%]' : 'flex-1'
          } ${hasPreview && activeTab !== 'feed' ? 'hidden md:flex' : ''}`}
        >
          <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-5">

            {/* Empty state */}
            {messages.length === 0 && activeSubtasks.length === 0 && taskStatus !== 'WAITING_CLARIFICATION' && (
              <div className="flex flex-col items-center justify-center py-36 text-center gap-4">
                <div className="flex gap-2">
                  {[0, 150, 300].map((d) => (
                    <div
                      key={d}
                      className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
                <p className="text-slate-500 text-sm max-w-xs">
                  {taskStatus === 'ROUTING'
                    ? 'Analysing your goal and assembling the AI team…'
                    : 'Preparing your roundtable…'}
                </p>
              </div>
            )}

            {/* Clarification waiting state */}
            {messages.length === 0 && taskStatus === 'WAITING_CLARIFICATION' && !showClarification && (
              <div className="flex flex-col items-center justify-center py-36 text-center gap-4">
                <p className="text-2xl">💬</p>
                <p className="text-slate-700 font-medium text-sm">A few quick questions</p>
                <p className="text-slate-400 text-xs max-w-xs">
                  Answering these will help the AI team deliver better results for your goal.
                </p>
                <button
                  onClick={() => setShowClarification(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Answer questions
                </button>
              </div>
            )}

            {/* Round 1 header (only shows when discussion is multi-round) */}
            {discussionRound > 1 && messages.some((m) => m.roundNumber === 1) && (
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-200 bg-indigo-50">
                  Round 1 — Initial Work
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            )}

            {messages.map((msg, i) => {
              const prev = messages[i - 1]
              const showRound2Banner = msg.roundNumber === 2 && (!prev || prev.roundNumber !== 2)
              const showRound3Banner = msg.roundNumber === 3 && (!prev || prev.roundNumber !== 3)
              return (
                <div key={msg.id}>
                  {showRound2Banner && (
                    <div className="flex items-center gap-3 py-1 my-2">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs font-semibold text-amber-600 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50">
                        Round 2 — Peer Review
                      </span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                  )}
                  {showRound3Banner && (
                    <div className="flex items-center gap-3 py-1 my-2">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs font-semibold text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50">
                        Round 3 — Synthesis
                      </span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                  )}
                  <div className="group relative">
                    <MessageBubble
                      message={{
                        ...msg,
                        title: msg.role === 'REVIEW'
                          ? `Peer Review: ${msg.title}`
                          : msg.role === 'SYNTHESIS'
                          ? `Final Synthesis: ${msg.title}`
                          : msg.title,
                      }}
                    />
                    {/* Phase 3: verification badge + actions badge */}
                    {msg.type === 'ai' && !msg.isError && (
                      <div className="flex items-center gap-1.5 mt-1 ml-11">
                        <VerificationBadge
                          verification={verifications[msg.id]}
                          subtaskId={msg.id}
                        />
                        {pendingActions[msg.id] != null && pendingActions[msg.id] > 0 && (
                          <Link
                            href="/settings/actions"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 transition-colors"
                          >
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                            </svg>
                            {pendingActions[msg.id]} action{pendingActions[msg.id] !== 1 ? 's' : ''} pending
                          </Link>
                        )}
                      </div>
                    )}
                    {sessionId && msg.type === 'ai' && !msg.isError && (
                      <ReactionBar
                        taskId={id}
                        subtaskId={msg.id}
                        sessionId={sessionId}
                      />
                    )}
                  </div>
                </div>
              )
            })}

            {activeSubtasks.map((s) => (
              <TypingIndicator
                key={s.subtaskId}
                model={s.model}
                title={
                  s.role === 'REVIEW' ? `Reviewing: ${s.title}` :
                  s.role === 'SYNTHESIS' ? `Synthesising all outputs…` :
                  s.title
                }
              />
            ))}

            {/* Completion summary card */}
            {taskStatus === 'COMPLETED' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center mt-4">
                <p className="text-emerald-700 font-semibold text-lg mb-1">
                  {synthesisComplete ? '🏆 Roundtable Complete — Synthesised' : 'Roundtable complete'}
                </p>
                <p className="text-slate-500 text-sm">
                  {synthesisComplete
                    ? `${discussionRound} rounds of AI collaboration — ${messages.filter((m) => m.type === 'ai' && !m.isError).length} outputs across ${new Set(messages.filter((m) => m.model).map((m) => m.model)).size} AIs`
                    : `${messages.filter((m) => m.type === 'ai' && !m.isError).length} tasks completed across ${new Set(messages.filter((m) => m.model).map((m) => m.model)).size} AIs`
                  }
                </p>
                {synthesisComplete && (
                  <p className="text-xs text-slate-400 mt-1">
                    Initial work → Peer review → Final synthesis
                  </p>
                )}
                <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                  {hasCodeWorkspace && (
                    <Link
                      href={`/workspace/${id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                    >
                      💻 Open Workspace
                    </Link>
                  )}
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm font-medium transition-colors"
                  >
                    🎓 Request Expert Review
                  </button>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </main>

        {/* Live Preview Pane (desktop: right side | mobile: second tab) */}
        {hasPreview && (
          <div
            className={`${
              showPreview ? 'md:flex md:w-[45%]' : 'hidden'
            } ${activeTab === 'preview' ? 'flex flex-1' : 'hidden md:flex'} flex-col`}
          >
            <PreviewPane
              updates={previewUpdates}
              templateCategory={task?.template?.category || 'general'}
              isGenerating={isLive}
            />
          </div>
        )}
      </div>

      {/* ── Steering input + Voice input ─────────────────────────────────────── */}
      <div className="relative">
        <SteeringInput
          taskId={id}
          isVisible={taskStatus === 'IN_PROGRESS'}
          initialText={steeringText}
          onTextChange={setSteeringText}
        />
        {/* Phase 3: Voice input button — shown to the left of the send button */}
        {taskStatus === 'IN_PROGRESS' && (
          <div className="absolute bottom-0 right-[5.5rem] h-[3.25rem] flex items-center pr-1">
            <VoiceInputButton
              onTranscription={(text) => setSteeringText(text)}
              disabled={taskStatus !== 'IN_PROGRESS'}
            />
          </div>
        )}
      </div>

      {/* ── Reconnecting banner ──────────────────────────────────────────────── */}
      {!connected && isLive && (
        <div className="fixed bottom-0 inset-x-0 bg-yellow-500/10 border-t border-yellow-500/20 py-2 text-center text-xs text-yellow-400">
          Reconnecting to live feed…
        </div>
      )}

      {/* ── Clarification modal ──────────────────────────────────────────────── */}
      {showClarification && clarifications.length > 0 && (
        <ClarificationModal
          taskId={id}
          questions={clarifications}
          onComplete={() => {
            setShowClarification(false)
            setTaskStatus('ROUTING')
            addSystemMessage('Answers saved — assembling your AI team…')
          }}
        />
      )}

      {/* ── Expert review modal ──────────────────────────────────────────────── */}
      {showReviewModal && task && (
        <RequestReviewModal
          taskId={id}
          taskTitle={task.originalGoal}
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            setShowReviewModal(false)
            setReviewToast(true)
            setTimeout(() => setReviewToast(false), 5000)
          }}
        />
      )}

      {/* ── Expert review toast ──────────────────────────────────────────────── */}
      {reviewToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 shadow-2xl flex items-center gap-2 animate-fade-in">
          <span className="text-amber-400">🎓</span>
          Expert review requested! You'll be notified when it's ready.
          <button onClick={() => setReviewToast(false)} className="ml-2 text-slate-500 hover:text-slate-900 transition-colors">&times;</button>
        </div>
      )}
    </div>
  )
}
