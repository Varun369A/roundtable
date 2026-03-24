'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

export type StreamEventType =
  | 'connected'
  | 'routing_decided'
  | 'subtask_started'
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
  subtaskIds?: string[]       // for discussion_round_started
  title?: string
  model?: string
  status?: string
  originalGoal?: string
  // routing_decided fields
  team?: TeamMember[]
  intentCategories?: string[]
  // Discussion Engine fields
  role?: 'INITIAL' | 'REVIEW' | 'SYNTHESIS'
  roundNumber?: number
  reviewsSubtaskId?: string
  round?: number              // for discussion_round_started
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
  errors?: string[]           // for auto_fix_started
  originalSubtaskId?: string  // for auto_fix_started
  questions?: any[]           // for clarification_needed
  message?: string            // for steering_received / steering_applied
  sessionId?: string          // for session_created
}

interface UseTaskStreamOptions {
  taskId: string
  onEvent: (event: StreamEvent) => void
  enabled?: boolean
}

export function useTaskStream({ taskId, onEvent, enabled = true }: UseTaskStreamOptions) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const connect = useCallback(() => {
    if (!enabled || !taskId) return

    const token = localStorage.getItem('accessToken')
    if (!token) return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    // Pass token as query param — the browser EventSource API cannot set custom headers
    const url = `${apiUrl}/api/v1/stream/task/${taskId}?token=${encodeURIComponent(token)}`

    const es = new EventSource(url, { withCredentials: false })
    esRef.current = es

    const eventTypes: StreamEventType[] = [
      'connected',
      'routing_decided',
      'subtask_started',
      'subtask_completed',
      'subtask_failed',
      'task_completed',
      'task_failed',
      'task_cancelled',
      'auto_fix_started',
      'discussion_round_started',
      'synthesis_started',
      'synthesis_complete',
      'clarification_needed',
      'steering_received',
      'steering_applied',
      'session_created',
    ]

    for (const eventType of eventTypes) {
      es.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as StreamEvent
          onEventRef.current({ ...data, event: eventType })
        } catch {
          // Silently ignore malformed SSE payloads
        }
      })
    }

    es.onopen = () => {
      setConnected(true)
      setError(null)
    }

    es.onerror = () => {
      setConnected(false)
      // Auto-reconnect after 3 seconds if the connection was closed
      setTimeout(() => {
        if (esRef.current?.readyState === EventSource.CLOSED) {
          connect()
        }
      }, 3000)
    }

    return () => {
      es.close()
      esRef.current = null
      setConnected(false)
    }
  }, [taskId, enabled])

  useEffect(() => {
    const cleanup = connect()
    return () => {
      cleanup?.()
      esRef.current?.close()
    }
  }, [connect])

  return { connected, error }
}
