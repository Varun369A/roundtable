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
  PENDING:     'text-yellow-400 bg-yellow-400/10',
  ROUTING:     'text-blue-400 bg-blue-400/10',
  IN_PROGRESS: 'text-brand-400 bg-brand-400/10',
  COMPLETED:   'text-green-400 bg-green-400/10',
  FAILED:      'text-red-400 bg-red-400/10',
  CANCELLED:   'text-zinc-500 bg-zinc-500/10',
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
        <span className="text-sm text-zinc-500">{total.toLocaleString()} total</span>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s
                ? 'bg-brand-600 text-white'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 border-b border-zinc-800">
            <tr>
              {['Task', 'Status', 'User', 'Cost', 'Subtasks', 'Created', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-zinc-800 rounded animate-pulse" /></td></tr>
              ))
            ) : tasks.map((task) => (
              <tr key={task.id} className="hover:bg-zinc-900/50">
                <td className="px-4 py-3 max-w-xs">
                  <p className="font-medium truncate text-sm">{task.title}</p>
                  <p className="text-xs text-zinc-600 font-mono">{task.id.slice(0, 8)}…</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[task.status] || ''}`}>
                    {task.status.toLowerCase().replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">{task.user.email}</td>
                <td className="px-4 py-3 font-mono text-xs">${Number(task.totalCostUsd).toFixed(4)}</td>
                <td className="px-4 py-3 font-mono text-xs">{task._count.subtasks}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {new Date(task.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/roundtable/${task.id}`}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
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
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded-lg disabled:opacity-40">← Prev</button>
          <span className="px-3 py-1.5 text-sm text-zinc-500">Page {page} of {Math.ceil(total / 30)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 30)} className="px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded-lg disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  )
}
