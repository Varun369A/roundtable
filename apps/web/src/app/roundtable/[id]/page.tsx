'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTaskStream, StreamEvent } from '@/hooks/useTaskStream'
import { MessageBubble, TypingIndicator } from '@/components/roundtable'
import type { Message } from '@/components/roundtable'
import { apiFetch } from '@/lib/api'

interface TaskInfo {
  id: string
  title: string
  originalGoal: string
  status: string
}

interface ActiveSubtask {
  subtaskId: string
  title: string
  model: string
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:     { label: 'Queued',    color: 'text-yellow-400' },
  ROUTING:     { label: 'Routing…',  color: 'text-blue-400'   },
  IN_PROGRESS: { label: 'Live',      color: 'text-brand-400'  },
  COMPLETED:   { label: 'Complete',  color: 'text-green-400'  },
  FAILED:      { label: 'Failed',    color: 'text-red-400'    },
  CANCELLED:   { label: 'Cancelled', color: 'text-zinc-500'   },
}

export default function RoundtablePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [task, setTask]                     = useState<TaskInfo | null>(null)
  const [messages, setMessages]             = useState<Message[]>([])
  const [activeSubtasks, setActiveSubtasks] = useState<ActiveSubtask[]>([])
  const [taskStatus, setTaskStatus]         = useState<string>('PENDING')
  const [hasCodeWorkspace, setHasCodeWorkspace] = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)

  // Auto-scroll to bottom whenever messages or typing indicators change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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
      const result = await apiFetch<{ task: TaskInfo }>(`/api/v1/tasks/${params.id}`)
      if (!result.success || !result.data) {
        router.push('/dashboard')
        return
      }

      const t = result.data.task
      setTask(t)
      setTaskStatus(t.status)

      if (t.status === 'PENDING' && !hasStarted.current) {
        hasStarted.current = true
        await apiFetch(`/api/v1/tasks/${params.id}/start`, { method: 'POST' })
        setTaskStatus('ROUTING')
        addSystemMessage('Analysing your goal and assembling the team…')
      }
    }
    init()
  }, [params.id, router])

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
              subtaskId: event.subtaskId!,
              title:     event.title || '',
              model:     event.model!,
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
            id:        event.subtaskId || `msg-${Date.now()}`,
            type:      'ai',
            model:     event.model,
            title:     event.title,
            output:    event.output as Message['output'],
            timestamp: new Date(),
          },
        ])
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

      case 'task_completed':
        setTaskStatus('COMPLETED')
        setActiveSubtasks([])
        if (event.hasCodeWorkspace) setHasCodeWorkspace(true)
        addSystemMessage('All done — your deliverables are ready.')
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
    }
  }, [])

  const { connected } = useTaskStream({
    taskId:  params.id,
    onEvent: handleStreamEvent,
    enabled: !!task,
  })

  const statusCfg = STATUS_LABEL[taskStatus] || STATUS_LABEL.PENDING
  const isLive    = ['ROUTING', 'IN_PROGRESS'].includes(taskStatus)

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm shrink-0"
          >
            ← Dashboard
          </Link>

          <div className="h-4 w-px bg-zinc-800" />

          <p className="flex-1 text-sm font-medium truncate text-zinc-300">
            {task?.originalGoal || '…'}
          </p>

          <div className="flex items-center gap-2 shrink-0">
            {isLive && (
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse-slow" />
            )}
            <span className={`text-xs font-semibold ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
        </div>
      </header>

      {/* ── Message Feed ────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-5">

        {/* Empty state — waiting for first event */}
        {messages.length === 0 && activeSubtasks.length === 0 && (
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
            <p className="text-zinc-500 text-sm max-w-xs">
              Parsing your goal and selecting the best AIs for each step…
            </p>
          </div>
        )}

        {/* Completed / in-flight messages */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Live typing indicators */}
        {activeSubtasks.map((s) => (
          <TypingIndicator key={s.subtaskId} model={s.model} title={s.title} />
        ))}

        {/* Completion summary card */}
        {taskStatus === 'COMPLETED' && (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 text-center mt-4">
            <p className="text-green-400 font-semibold text-lg mb-1">Roundtable complete</p>
            <p className="text-zinc-500 text-sm">
              {messages.filter((m) => m.type === 'ai' && !m.isError).length} tasks completed across{' '}
              {new Set(messages.filter((m) => m.model).map((m) => m.model)).size} AIs
            </p>
            {hasCodeWorkspace && (
              <Link
                href={`/workspace/${params.id}`}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
              >
                💻 Open Workspace
              </Link>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* ── Reconnecting banner ──────────────────────────────────────────────── */}
      {!connected && isLive && (
        <div className="fixed bottom-0 inset-x-0 bg-yellow-500/10 border-t border-yellow-500/20 py-2 text-center text-xs text-yellow-400">
          Reconnecting to live feed…
        </div>
      )}
    </div>
  )
}
