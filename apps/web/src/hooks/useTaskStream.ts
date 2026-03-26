'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

export type StreamEventType =
  | 'connected'
  | 'routing_decided'
  | 'subtask_started'
  | 'subtask_streaming'
  | 'subtask_token'
  | 'subtask_completed'
  | 'subtask_failed'
  | 'task_completed'
  | 'task_failed'
  | 'task_cancelled'
  | 'auto_fix_started'
  | 'discussion_round_started'
  | 'synthesis_started'
  | 'synthesis_complete'
  | 'clarification_needed'
  | 'steering_received'
  | 'steering_applied'
  | 'session_created'
  // 3-Engine pipeline events
  | 'engine_started'
  | 'task:progress'

export interface TeamMember {
  subtaskId:      string
  title:          string
  model:          string
  category:       string
  executionOrder: number
}

export interface StreamEvent {
  event: StreamEventType
  taskId?: string
  subtaskId?: string
  subtaskIds?: string[]
  title?: string
  model?: string
  status?: string
  originalGoal?: string
  chunk?: string
  team?: TeamMember[]
  intentCategories?: string[]
  role?: 'INITIAL' | 'REVIEW' | 'SYNTHESIS'
  roundNumber?: number
  reviewsSubtaskId?: string
  round?: number
  output?: {
    type: 'text' | 'image' | 'audio' | 'video' | 'json'
    content?: string
    fileUrl?: string
  }
  error?: string
  hasCodeWorkspace?: boolean
  preview?: {
    type: 'code' | 'image' | 'document' | 'article' | 'research' | 'learning' | 'text'
    html: string
  }
  errors?: string[]
  originalSubtaskId?: string
  questions?: any[]
  message?: string
  sessionId?: string
  // 3-Engine pipeline fields
  step?: string
  progress?: number
  pipeline?: string[]
  qualityGrade?: string
  overallScore?: number
  summary?: string
  fileCount?: number
}

interface UseTaskStreamOptions {
  taskId: string
  onEvent: (event: StreamEvent) => void
  enabled?: boolean
}

export function useTaskStream({ taskId, onEvent, enabled = true }: UseTaskStreamOptions) {
  const [connected, setConnected] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const esRef                     = useRef<EventSource | null>(null)
  const reconnectTimer            = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef              = useRef(false)
  const onEventRef                = useRef(onEvent)
  onEventRef.current              = onEvent

  const ALL_EVENTS: StreamEventType[] = [
    'connected', 'routing_decided',
    'subtask_started', 'subtask_streaming', 'subtask_token',
    'subtask_completed', 'subtask_failed',
    'task_completed', 'task_failed', 'task_cancelled',
    'auto_fix_started', 'discussion_round_started',
    'synthesis_started', 'synthesis_complete',
    'clarification_needed', 'steering_received', 'steering_applied', 'session_created',
    'engine_started', 'task:progress',
  ]

  const connect = useCallback(() => {
    if (unmountedRef.current || !enabled || !taskId) return

    // Clean up existing connection
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    const token = localStorage.getItem('accessToken')
    if (!token) return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const url    = `${apiUrl}/api/v1/stream/task/${taskId}?token=${encodeURIComponent(token)}`
    const es     = new EventSource(url, { withCredentials: false })
    esRef.current = es

    for (const eventType of ALL_EVENTS) {
      es.addEventListener(eventType, (e: MessageEvent) => {
        if (unmountedRef.current) return
        try {
          const data = JSON.parse(e.data) as StreamEvent
          onEventRef.current({ ...data, event: eventType })
        } catch { /* ignore malformed */ }
      })
    }

    es.onopen = () => {
      if (unmountedRef.current) return
      setConnected(true)
      setError(null)
    }

    es.onerror = () => {
      if (unmountedRef.current) return
      setConnected(false)
      es.close()
      esRef.current = null
      // Exponential back-off reconnect: 2s → 4s → 8s (max)
      const delay = Math.min(8000, 2000)
      reconnectTimer.current = setTimeout(() => {
        if (!unmountedRef.current) connect()
      }, delay)
    }
  }, [taskId, enabled])

  useEffect(() => {
    unmountedRef.current = false
    connect()
    return () => {
      unmountedRef.current = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      esRef.current?.close()
      esRef.current = null
      setConnected(false)
    }
  }, [connect])

  return { connected, error }
}
