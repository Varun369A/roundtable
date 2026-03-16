'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

export type StreamEventType =
  | 'connected'
  | 'subtask_started'
  | 'subtask_completed'
  | 'subtask_failed'
  | 'task_completed'
  | 'task_failed'
  | 'task_cancelled'

export interface StreamEvent {
  event: StreamEventType
  taskId?: string
  subtaskId?: string
  title?: string
  model?: string
  status?: string
  originalGoal?: string
  output?: {
    type: 'text' | 'image' | 'audio' | 'video' | 'json'
    content?: string
    fileUrl?: string
  }
  error?: string
  hasCodeWorkspace?: boolean
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
      'subtask_started',
      'subtask_completed',
      'subtask_failed',
      'task_completed',
      'task_failed',
      'task_cancelled',
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
