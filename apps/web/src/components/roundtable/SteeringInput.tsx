'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface SteeringInputProps {
  taskId: string
  isVisible: boolean
  onSteered?: (message: string) => void
  /** Controlled initial text — set by external sources like voice input */
  initialText?: string
  /** Called when the internal text changes so parent can sync */
  onTextChange?: (text: string) => void
}

const MAX_CHARS = 500

export function SteeringInput({ taskId, isVisible, onSteered, initialText, onTextChange }: SteeringInputProps) {
  const [message, setMessage] = useState(initialText || '')
  const [sending, setSending] = useState(false)
  const [successFlash, setSuccessFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>()

  // Sync when parent provides new initialText (e.g. from voice transcription)
  useEffect(() => {
    if (initialText !== undefined && initialText !== message) {
      setMessage(initialText.slice(0, MAX_CHARS))
      inputRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText])

  const charsLeft = MAX_CHARS - message.length
  const canSend = isVisible && message.trim().length > 0 && !sending

  async function handleSend() {
    const text = message.trim()
    if (!text || !isVisible || sending) return

    setSending(true)
    setError(null)

    try {
      const res = await apiFetch(`/api/v1/tasks/${taskId}/steer`, {
        method: 'POST',
        body: JSON.stringify({ message: text, priority: 0 }),
      })

      if (!res.success) {
        // Check for 429-style error
        const code = res.error?.code || ''
        if (code === 'TOO_MANY_REQUESTS' || code === '429') {
          setError('Too many steering messages. Wait for some to be applied.')
        } else {
          setError(res.error?.message || 'Failed to send steering message.')
        }
        return
      }

      setMessage('')
      onTextChange?.('')
      onSteered?.(text)

      // Flash success
      setSuccessFlash(true)
      clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setSuccessFlash(false), 3000)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey && canSend) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="sticky bottom-0 z-20 w-full border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
      {/* Success flash */}
      {successFlash && (
        <div className="px-4 pt-2">
          <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
            Steering applied to next AI step ✓
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 pt-2">
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
            {error}
          </p>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => {
              setError(null)
              const val = e.target.value.slice(0, MAX_CHARS)
              setMessage(val)
              onTextChange?.(val)
            }}
            onKeyDown={handleKeyDown}
            disabled={!isVisible || sending}
            placeholder={
              isVisible
                ? "Redirect Sabha's next step… (e.g. 'Focus more on B2B use cases')"
                : 'Task must be running to steer'
            }
            className={`w-full px-4 py-2.5 pr-14 rounded-xl text-sm outline-none transition-colors ${
              isVisible
                ? 'bg-zinc-900 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-white placeholder-zinc-600'
                : 'bg-zinc-900/50 border border-zinc-800 text-zinc-600 placeholder-zinc-700 cursor-not-allowed'
            }`}
          />
          {/* Char counter */}
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums pointer-events-none ${
              charsLeft < 50 ? 'text-amber-400' : 'text-zinc-600'
            }`}
          >
            {charsLeft}
          </span>
        </div>

        {/* Send button */}
        <div className="relative group">
          <button
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send steering message"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              canSend
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Steer
              </>
            )}
          </button>

          {/* Tooltip for disabled state */}
          {!isVisible && (
            <div className="absolute bottom-full mb-2 right-0 hidden group-hover:block">
              <div className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
                Task must be running to steer
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
