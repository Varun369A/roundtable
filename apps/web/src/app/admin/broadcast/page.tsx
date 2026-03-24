'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'

interface Broadcast {
  id: string
  title: string
  message: string
  targetTier: string | null
  recipientCount: number
  sentBy: string
  createdAt: string
}

const TIER_OPTIONS = [
  { value: 'ALL',        label: 'All Users',        color: 'bg-slate-100 text-slate-700' },
  { value: 'FREE',       label: 'Free Tier',        color: 'bg-slate-100 text-slate-600' },
  { value: 'BUILDER',   label: 'Builder',           color: 'bg-blue-100 text-blue-700' },
  { value: 'STUDIO',    label: 'Studio',            color: 'bg-indigo-100 text-indigo-700' },
  { value: 'ENTERPRISE',label: 'Enterprise',        color: 'bg-emerald-100 text-emerald-700' },
]

export default function BroadcastPage() {
  const [form, setForm]           = useState({ title: '', message: '', targetTier: 'ALL', link: '' })
  const [sending, setSending]     = useState(false)
  const [result, setResult]       = useState<{ sent: number } | null>(null)
  const [error, setError]         = useState('')
  const [history, setHistory]     = useState<Broadcast[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    apiFetch('/api/v1/admin/broadcast').then((res) => {
      if (res.success) setHistory((res.data as any).broadcasts ?? [])
    }).finally(() => setLoadingHistory(false))
  }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!confirm(`Send this broadcast to ${form.targetTier === 'ALL' ? 'all users' : form.targetTier + ' tier'}?`)) return

    setSending(true)
    setError('')
    setResult(null)

    try {
      const res = await apiFetch('/api/v1/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          title:      form.title,
          message:    form.message,
          targetTier: form.targetTier,
          link:       form.link || undefined,
        }),
      })

      if (!res.success) {
        setError((res as any).error?.message || 'Failed to send broadcast')
        return
      }

      setResult({ sent: (res.data as any).sent })
      setForm({ title: '', message: '', targetTier: 'ALL', link: '' })

      // Refresh history
      const histRes = await apiFetch('/api/v1/admin/broadcast')
      if (histRes.success) setHistory((histRes.data as any).broadcasts ?? [])
    } catch {
      setError('Failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const charCount = form.message.length

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Broadcast</h1>
        <p className="text-slate-500 text-sm mt-1">Send a notification to all users or a specific tier.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Compose */}
        <div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Compose Message</h2>

            <form onSubmit={handleSend} className="space-y-4">
              {/* Target */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Target Audience</label>
                <div className="flex flex-wrap gap-2">
                  {TIER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, targetTier: opt.value })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        form.targetTier === opt.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Notification Title</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                  placeholder="Platform update available"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Message</label>
                <textarea
                  required
                  maxLength={2000}
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-none"
                  placeholder="We've rolled out new features…"
                />
                <p className="text-right text-[11px] text-slate-400 mt-1">{charCount}/2000</p>
              </div>

              {/* Optional link */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Link (optional)</label>
                <input
                  type="text"
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                  placeholder="/dashboard or https://…"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
              )}
              {result && (
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                  Sent to {result.sent.toLocaleString()} users successfully.
                </p>
              )}

              <button
                type="submit"
                disabled={sending || !form.title || !form.message}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {sending ? 'Sending…' : `Send to ${form.targetTier === 'ALL' ? 'All Users' : form.targetTier}`}
              </button>
            </form>
          </div>
        </div>

        {/* History */}
        <div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Recent Broadcasts</h2>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No broadcasts yet</p>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {history.map((b) => (
                  <div key={b.id} className="border border-slate-100 rounded-xl p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-800 leading-tight">{b.title}</p>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                        {b.targetTier ?? 'ALL'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{b.message}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>{b.recipientCount.toLocaleString()} recipients</span>
                      <span>·</span>
                      <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
