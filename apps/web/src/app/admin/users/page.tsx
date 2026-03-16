'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface AdminUser {
  id: string
  email: string
  name: string
  tier: string
  status: string
  createdAt: string
  lastActiveAt: string
  _count: { tasks: number }
  usageStats?: { totalCostUsd: number; totalTasksCompleted: number }
}

const TIER_BADGE: Record<string, string> = {
  FREE:       'bg-zinc-700 text-zinc-300',
  STARTER:    'bg-blue-600/20 text-blue-400',
  PRO:        'bg-purple-600/20 text-purple-400',
  POWER:      'bg-yellow-600/20 text-yellow-400',
  ENTERPRISE: 'bg-green-600/20 text-green-400',
}

export default function AdminUsersPage() {
  const [users, setUsers]       = useState<AdminUser[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      limit: '25',
      ...(search ? { search } : {}),
    })
    const res = await apiFetch<{ users: AdminUser[] }>(`/api/v1/admin/users?${params}`)
    if (res.success && res.data) {
      setUsers(res.data.users)
      setTotal((res as any).meta?.total || 0)
    }
    setLoading(false)
  }, [page, search])

  useEffect(() => { load() }, [load])

  async function updateUser(userId: string, patch: Record<string, unknown>) {
    setUpdating(userId)
    const res = await apiFetch(`/api/v1/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    if (res.success) await load()
    setUpdating(null)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <span className="text-sm text-zinc-500">{total.toLocaleString()} total</span>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by email or name…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        className="w-full max-w-md px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm mb-6 focus:border-brand-500 focus:outline-none transition-colors"
      />

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 border-b border-zinc-800">
            <tr>
              {['User', 'Plan', 'Tasks', 'API cost', 'Last active', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 bg-zinc-800 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : users.map((user) => (
              <tr key={user.id} className="hover:bg-zinc-900/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-zinc-500">{user.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${TIER_BADGE[user.tier] || TIER_BADGE.FREE}`}>
                    {user.tier}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {user._count.tasks}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  ${Number(user.usageStats?.totalCostUsd || 0).toFixed(4)}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {new Date(user.lastActiveAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${user.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <select
                      value={user.tier}
                      onChange={(e) => updateUser(user.id, { tier: e.target.value })}
                      disabled={updating === user.id}
                      className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 disabled:opacity-50"
                    >
                      {['FREE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => updateUser(user.id, {
                        status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
                      })}
                      disabled={updating === user.id}
                      className={`text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 ${
                        user.status === 'ACTIVE'
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                      }`}
                    >
                      {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded-lg disabled:opacity-40 hover:border-zinc-600 transition-colors"
          >
            ← Prev
          </button>
          <span className="px-3 py-1.5 text-sm text-zinc-500">
            Page {page} of {Math.ceil(total / 25)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 25)}
            className="px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded-lg disabled:opacity-40 hover:border-zinc-600 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
