'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface AdminUser {
  id: string
  email: string
  name: string
  tier: string
  status: string
  isEmailVerified: boolean
  createdAt: string
  lastActiveAt: string
  _count: { tasks: number }
  usageStats?: { totalCostUsd: number; totalTasksCompleted: number }
}

const TIER_BADGE: Record<string, string> = {
  FREE:       'bg-slate-100 text-slate-600',
  BUILDER:    'bg-blue-50 text-blue-700 border border-blue-200',
  STUDIO:     'bg-purple-50 text-purple-700 border border-purple-200',
  ENTERPRISE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

const TIERS = ['FREE', 'BUILDER', 'STUDIO', 'ENTERPRISE']

interface CreditFormState {
  userId: string
  amount: string
  submitting: boolean
}

interface ConfirmState {
  userId: string
  message: string
}

export default function AdminUsersPage() {
  const [users, setUsers]         = useState<AdminUser[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [updating, setUpdating]   = useState<string | null>(null)
  const [creditForm, setCreditForm] = useState<CreditFormState | null>(null)
  const [confirmMap, setConfirmMap] = useState<Record<string, ConfirmState>>({})

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

  async function forceLogout(userId: string) {
    setUpdating(userId)
    const res = await apiFetch(`/api/v1/admin/users/${userId}/sessions`, {
      method: 'DELETE',
    })
    setUpdating(null)
    if (res.success) {
      setConfirmMap((prev) => ({
        ...prev,
        [userId]: { userId, message: 'Logged out' },
      }))
      setTimeout(() => {
        setConfirmMap((prev) => {
          const next = { ...prev }
          delete next[userId]
          return next
        })
      }, 2500)
    }
  }

  async function submitCredits(userId: string) {
    if (!creditForm) return
    const amount = parseFloat(creditForm.amount)
    if (isNaN(amount)) return
    setCreditForm((f) => f ? { ...f, submitting: true } : null)
    await apiFetch(`/api/v1/admin/users/${userId}/credits`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason: 'Admin adjustment' }),
    })
    setCreditForm(null)
  }

  const totalPages = Math.ceil(total / 25)

  return (
    <div className="p-8 bg-white min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <span className="text-sm text-slate-500">{total.toLocaleString()} total</span>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by email or name…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        className="w-full max-w-md px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 mb-6 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-colors placeholder:text-slate-400"
      />

      {/* Table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['User', 'Plan', 'Tasks', 'API cost', 'Last active', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">

                {/* User */}
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </td>

                {/* Plan */}
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${TIER_BADGE[user.tier] || TIER_BADGE.FREE}`}>
                    {user.tier}
                  </span>
                </td>

                {/* Tasks */}
                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                  {user._count.tasks}
                </td>

                {/* API cost */}
                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                  ${Number(user.usageStats?.totalCostUsd || 0).toFixed(4)}
                </td>

                {/* Last active */}
                <td className="px-4 py-3 text-xs text-slate-500">
                  {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString() : '—'}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${user.status === 'ACTIVE' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {user.status}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5 items-center">

                    {/* Tier select */}
                    <select
                      value={user.tier}
                      onChange={(e) => updateUser(user.id, { tier: e.target.value })}
                      disabled={updating === user.id}
                      className="text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 disabled:opacity-50 focus:border-indigo-400 focus:outline-none"
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>

                    {/* Suspend / Activate */}
                    <button
                      onClick={() => updateUser(user.id, {
                        status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                      })}
                      disabled={updating === user.id}
                      className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
                        user.status === 'ACTIVE'
                          ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                          : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>

                    {/* Verify email — only show when unverified */}
                    {!user.isEmailVerified && (
                      <button
                        onClick={() => updateUser(user.id, { isEmailVerified: true })}
                        disabled={updating === user.id}
                        className="text-xs px-2 py-1 rounded border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        Verify
                      </button>
                    )}

                    {/* Force logout */}
                    {confirmMap[user.id] ? (
                      <span className="text-xs text-emerald-600 font-medium px-1">
                        {confirmMap[user.id].message}
                      </span>
                    ) : (
                      <button
                        onClick={() => forceLogout(user.id)}
                        disabled={updating === user.id}
                        className="text-xs px-2 py-1 rounded border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
                      >
                        Force logout
                      </button>
                    )}

                    {/* Credits */}
                    {creditForm?.userId === user.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="±amount"
                          value={creditForm.amount}
                          onChange={(e) =>
                            setCreditForm((f) => f ? { ...f, amount: e.target.value } : null)
                          }
                          className="w-20 text-xs px-2 py-1 border border-slate-300 rounded bg-white text-slate-900 focus:border-indigo-400 focus:outline-none"
                        />
                        <button
                          onClick={() => submitCredits(user.id)}
                          disabled={creditForm.submitting}
                          className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                          {creditForm.submitting ? '…' : 'Apply'}
                        </button>
                        <button
                          onClick={() => setCreditForm(null)}
                          className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setCreditForm({ userId: user.id, amount: '', submitting: false })
                        }
                        className="text-xs px-2 py-1 rounded border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 transition-colors"
                      >
                        Credits
                      </button>
                    )}

                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40 hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            ← Prev
          </button>
          <span className="px-3 py-1.5 text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40 hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
