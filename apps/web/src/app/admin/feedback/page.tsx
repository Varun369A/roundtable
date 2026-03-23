'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import Link from 'next/link'

interface FeedbackSummary {
  total: number
  lastWeek: number
  avgRating: number | null
  byType: Record<string, number>
  ratingDistribution: { rating: number; count: number }[]
}

interface FeedbackItem {
  id: string
  type: string
  message: string
  rating: number | null
  page: string | null
  userId: string | null
  createdAt: string
}

const TYPE_COLORS: Record<string, string> = {
  bug: 'text-red-600 bg-red-50',
  feature_request: 'text-indigo-600 bg-indigo-50',
  praise: 'text-emerald-600 bg-emerald-50',
  general: 'text-slate-500 bg-slate-100',
}

export default function FeedbackAdminPage() {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null)
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [filter, setFilter] = useState<string>('all')

  const loadData = useCallback(async () => {
    const [sumData, itemsData] = await Promise.all([
      apiFetch('/api/v1/feedback/summary'),
      apiFetch(`/api/v1/feedback?type=${filter}&limit=100`),
    ])
    if (sumData.success) setSummary(sumData.data as any)
    if (itemsData.success) setItems((itemsData.data as any).items)
  }, [filter])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-slate-400 hover:text-slate-600 text-sm transition-colors">← Admin</Link>
          <h1 className="text-xl font-bold">User Feedback</h1>
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Total Submissions</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Last 7 Days</p>
              <p className="text-2xl font-bold">{summary.lastWeek}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Avg Rating</p>
              <p className="text-2xl font-bold">{summary.avgRating ?? '—'}<span className="text-sm text-slate-400">/5</span></p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-2">By Type</p>
              {Object.entries(summary.byType).map(([type, count]) => (
                <div key={type} className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-500 capitalize">{type.replace('_', ' ')}</span>
                  <span className="text-slate-900 font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4">
          {['all', 'bug', 'feature_request', 'praise', 'general'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {f === 'all' ? 'All' : f.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Feedback list */}
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[item.type] || ''}`}>
                  {item.type.replace('_', ' ')}
                </span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {item.rating && (
                    <span className="text-amber-400 text-xs">{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span>
                  )}
                  <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{item.message}</p>
              {item.page && (
                <p className="text-xs text-slate-300 mt-2">Page: {item.page}</p>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-12 text-slate-400">No feedback yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}
