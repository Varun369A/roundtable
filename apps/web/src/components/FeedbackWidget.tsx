'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { apiFetch } from '@/lib/api'

type FeedbackType = 'bug' | 'feature_request' | 'general' | 'praise'

const TYPES: { id: FeedbackType; label: string; emoji: string }[] = [
  { id: 'bug', label: 'Report a bug', emoji: '🐛' },
  { id: 'feature_request', label: 'Request a feature', emoji: '💡' },
  { id: 'praise', label: 'Share praise', emoji: '💚' },
  { id: 'general', label: 'General feedback', emoji: '💬' },
]

export default function FeedbackWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('general')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSubmit = async () => {
    if (!message.trim()) return
    setSubmitting(true)
    try {
      await apiFetch('/api/v1/feedback', {
        method: 'POST',
        body: JSON.stringify({ type, message, rating: rating || undefined, page: pathname }),
      })
      setSubmitted(true)
      setTimeout(() => {
        setOpen(false)
        setSubmitted(false)
        setMessage('')
        setRating(null)
        setType('general')
      }, 2000)
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50">
      {/* Popup */}
      {open && (
        <div className="mb-3 w-80 bg-[#1a1a1f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Send Feedback</p>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-600 hover:text-zinc-400 text-lg leading-none"
            >
              ×
            </button>
          </div>

          {submitted ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">🙏</div>
              <p className="text-white font-medium">Thanks for your feedback!</p>
              <p className="text-zinc-500 text-sm mt-1">It helps us improve Sabha.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Type selector */}
              <div className="grid grid-cols-2 gap-1.5">
                {TYPES.map(({ id, label, emoji }) => (
                  <button
                    key={id}
                    onClick={() => setType(id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${
                      type === id
                        ? 'bg-indigo-500/20 border border-indigo-500/40 text-white'
                        : 'bg-white/3 border border-white/5 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Message */}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind…"
                rows={3}
                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-white/20"
              />

              {/* Rating (optional) */}
              <div>
                <p className="text-xs text-zinc-600 mb-1.5">Overall rating (optional)</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRating(rating === r ? null : r)}
                      className={`w-8 h-8 rounded-lg text-sm transition-all ${
                        rating !== null && r <= rating
                          ? 'bg-amber-400/20 text-amber-400'
                          : 'bg-white/5 text-zinc-600 hover:bg-white/10 hover:text-zinc-400'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !message.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-xl font-medium transition-colors"
              >
                {submitting ? 'Sending…' : 'Send Feedback'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium transition-all ${
          open
            ? 'bg-indigo-600 text-white'
            : 'bg-[#1a1a1f] border border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
        }`}
      >
        <span>💬</span>
        <span>Feedback</span>
      </button>
    </div>
  )
}
