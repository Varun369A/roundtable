'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface AdminTask {
  id: string
  title: string
  status: string
  totalCostUsd: number
  createdAt: string
  completedAt?: string
  user: { email: string; tier: string }
  _count: { subtasks: number }
}

const STATUS_STYLE: Record<string, string> = {
  PENDING:     'text-amber-700 bg-amber-50 border border-amber-200',
  ROUTING:     'text-blue-700 bg-blue-50 border border-blue-200',
  IN_PROGRESS: 'text-indigo-700 bg-indigo-50 border border-indigo-200',
  COMPLETED:   'text-emerald-700 bg-emerald-50 border border-emerald-200',
  FAILED:      'text-red-700 bg-red-50 border border-red-200',
  CANCELLED:   'text-slate-500 bg-slate-100 border border-slate-200',
}

export default function AdminTasksPage() {
  const [tasks, setTasks]     = useState<AdminTask[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [filter, setFilter]   = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), ...(filter ? { status: filter } : {}) })
    const res = await apiFetch<{ tasks: AdminTask[] }>(`/api/v1/admin/tasks?${params}`)
    if (res.success && res.data) {
      setTasks(res.data.tasks)
      setTotal((res as any).meta?.total || 0)
    }
    setLoading(false)
  }, [page, filter])

  useEffect(() => { load() }, [load])

  async function cancelTask(id: string) {
    await apiFetch(`/api/v1/admin/tasks/${id}/cancel`, { method: 'POST' })
    load()
  }

  const statuses = ['', 'IN_PROGRESS', 'ROUTING', 'COMPLETED', 'FAILED', 'CANCELLED']

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">All Tasks</h1>
        <span className="text-sm text-slate-500">{total.toLocaleString()} total</span>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Task', 'Status', 'User', 'Cost', 'Subtasks', 'Created', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse" /></td></tr>
              ))
            ) : tasks.map((task) => (
              <tr key={task.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 max-w-xs">
                  <p className="font-medium truncate text-sm">{task.title}</p>
                  <p className="text-xs text-slate-400 font-mono">{task.id.slice(0, 8)}…</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[task.status] || ''}`}>
                    {task.status.toLowerCase().replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{task.user.email}</td>
                <td className="px-4 py-3 font-mono text-xs">${Number(task.totalCostUsd).toFixed(4)}</td>
                <td className="px-4 py-3 font-mono text-xs">{task._count.subtasks}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(task.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/roundtable/${task.id}`}
                      className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      View
                    </Link>
                    {['IN_PROGRESS', 'ROUTING', 'PENDING'].includes(task.status) && (
                      <button
                        onClick={() => cancelTask(task.id)}
                        className="text-xs text-red-500 hover:text-red-400 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 30 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40">← Prev</button>
          <span className="px-3 py-1.5 text-sm text-slate-500">Page {page} of {Math.ceil(total / 30)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 30)} className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  )
}
