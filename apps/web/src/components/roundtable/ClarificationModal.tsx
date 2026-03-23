'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface ClarificationQuestion {
  id: string
  question: string
  orderIndex: number
  answer?: string
}

interface ClarificationModalProps {
  taskId: string
  questions: ClarificationQuestion[]
  onComplete: () => void
  triggerRef?: React.RefObject<HTMLElement>
}

const MODAL_TITLE_ID = 'clarification-modal-title'

export function ClarificationModal({ taskId, questions, onComplete, triggerRef }: ClarificationModalProps) {
  const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const q of sorted) init[q.id] = q.answer || ''
    return init
  })
  const [submitting, setSubmitting] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modalRef    = useRef<HTMLDivElement>(null)
  const skipBtnRef  = useRef<HTMLButtonElement>(null)

  const current = sorted[currentIndex]
  const total = sorted.length
  const isLast = currentIndex === total - 1
  const currentAnswer = answers[current?.id] || ''

  // Auto-focus textarea when step changes
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [currentIndex])

  // Focus trap: keep Tab/Shift+Tab inside the modal
  const handleKeyDownTrap = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const modal = modalRef.current
    if (!modal) return

    const focusable = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
  }, [])

  function handleAnswerChange(value: string) {
    if (!current) return
    setAnswers((prev) => ({ ...prev, [current.id]: value }))
  }

  function handleNext() {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  function returnFocusToTrigger() {
    triggerRef?.current?.focus()
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const payload = sorted.map((q) => ({
        id: q.id,
        answer: answers[q.id] || '',
      }))
      const res = await apiFetch(`/api/v1/tasks/${taskId}/clarifications/answer`, {
        method: 'POST',
        body: JSON.stringify({ answers: payload }),
      })
      if (!res.success) {
        setError(res.error?.message || 'Failed to submit answers. Please try again.')
        return
      }
      returnFocusToTrigger()
      onComplete()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSkipAll() {
    setSkipping(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/v1/tasks/${taskId}/clarifications/skip`, {
        method: 'POST',
      })
      if (!res.success) {
        setError(res.error?.message || 'Failed to skip. Please try again.')
        return
      }
      returnFocusToTrigger()
      onComplete()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSkipping(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isLast) {
        handleSubmit()
      } else {
        handleNext()
      }
    }
  }

  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDownTrap}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50"
        aria-hidden="true"
        onClick={() => { returnFocusToTrigger(); onComplete() }}
      />

      {/* Card */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={MODAL_TITLE_ID}
        className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
      >

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={MODAL_TITLE_ID} className="text-lg font-semibold text-slate-900">Before we begin…</h2>
              <p className="text-sm text-slate-500 mt-1">
                Arivarangam needs a few details to deliver better results
              </p>
            </div>
            {/* Progress pill */}
            <span className="shrink-0 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full whitespace-nowrap">
              Question {currentIndex + 1} of {total}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Question area */}
        <div className="px-6 py-5">
          {/* Animate via key */}
          <div key={current.id} className="animate-in fade-in duration-200">
            <label className="block text-sm font-medium text-slate-800 mb-3 leading-relaxed">
              {current.question}
            </label>
            <textarea
              ref={textareaRef}
              value={currentAnswer}
              onChange={(e) => handleAnswerChange(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="Type your answer… (Enter to continue, Shift+Enter for new line)"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 rounded-xl text-sm text-slate-900 placeholder-slate-400 resize-none outline-none transition-colors"
            />
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          {/* Skip all */}
          <button
            ref={skipBtnRef}
            onClick={handleSkipAll}
            disabled={submitting || skipping}
            aria-label="Skip all questions and start the roundtable immediately"
            className="text-sm text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {skipping ? 'Skipping…' : 'Skip all & start →'}
          </button>

          {/* Continue / Submit */}
          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={submitting || skipping || !currentAnswer.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-colors"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                'Start Roundtable →'
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={submitting || skipping || !currentAnswer.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-colors"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
