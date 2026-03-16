'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import Link from 'next/link'

interface BetaStats {
  codes: { total: number; used: number; available: number }
  users: {
    betaUsers: number
    signupsToday: number
    signupsThisWeek: number
    activationRate: number
    d1RetentionApprox: number
  }
}

interface BetaInvite {
  id: string
  code: string
  email: string | null
  note: string | null
  usedById: string | null
  usedAt: string | null
  createdAt: string
  expiresAt: string | null
}

export default function BetaAdminPage() {
  const [stats, setStats] = useState<BetaStats | null>(null)
  const [invites, setInvites] = useState<BetaInvite[]>([])
  const [filter, setFilter] = useState<'all' | 'true' | 'false'>('all')
  const [generating, setGenerating] = useState(false)
  const [genCount, setGenCount] = useState(10)
  const [genNote, setGenNote] = useState('')
  const [sendEmail, setSendEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    const res = await apiFetch('/api/v1/beta/stats')
    const data = await res.json()
    if (data.success) setStats(data.data)
  }, [])

  const loadInvites = useCallback(async () => {
    const res = await apiFetch(`/api/v1/beta/list?used=${filter}&limit=200`)
    const data = await res.json()
    if (data.success) setInvites(data.data.invites)
  }, [filter])

  useEffect(() => { loadStats(); loadInvites() }, [loadStats, loadInvites])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await apiFetch('/api/v1/beta/generate', {
        method: 'POST',
        body: JSON.stringify({ count: genCount, note: genNote || undefined }),
      })
      await loadStats()
      await loadInvites()
      setGenNote('')
    } finally {
      setGenerating(false)
    }
  }

  const handleSendEmail = async () => {
    if (!sendEmail) return
    setSending(true)
    try {
      await apiFetch('/api/v1/beta/send-email', {
        method: 'POST',
        body: JSON.stringify({ email: sendEmail }),
      })
      setSendEmail('')
      await loadStats()
    } finally {
      setSending(false)
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors">← Admin</Link>
          <div>
            <h1 className="text-xl font-bold">Beta Launch Dashboard</h1>
            <p className="text-xs text-zinc-500">100-user private beta management</p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            {[
              { label: 'Beta Users', value: stats.users.betaUsers, sub: 'total' },
              { label: 'Signups Today', value: stats.users.signupsToday, sub: '+today' },
              { label: 'This Week', value: stats.users.signupsThisWeek, sub: '+7d' },
              { label: 'Activation', value: `${stats.users.activationRate}%`, sub: 'created task' },
              { label: 'D1 Retention', value: `${stats.users.d1RetentionApprox}%`, sub: 'approx' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-white/5 rounded-2xl border border-white/8 p-4">
                <p className="text-xs text-zinc-500 mb-1">{label}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-zinc-600">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Code stats + actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Invite code stats */}
          {stats && (
            <div className="bg-white/5 rounded-2xl border border-white/8 p-6">
              <h2 className="text-sm font-semibold text-white mb-4">Invite Codes</h2>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Total generated', value: stats.codes.total },
                  { label: 'Used', value: stats.codes.used, color: 'text-emerald-400' },
                  { label: 'Available', value: stats.codes.available, color: 'text-indigo-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-zinc-500">{label}</span>
                    <span className={`font-semibold ${color || 'text-white'}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate codes */}
          <div className="bg-white/5 rounded-2xl border border-white/8 p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Generate Codes</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  min={1}
                  max={200}
                  className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Internal note (optional)"
                  value={genNote}
                  onChange={(e) => setGenNote(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-xl font-medium transition-colors"
              >
                {generating ? 'Generating…' : `Generate ${genCount} Code${genCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>

        {/* Send invite email */}
        <div className="bg-white/5 rounded-2xl border border-white/8 p-6 mb-8">
          <h2 className="text-sm font-semibold text-white mb-4">Send Beta Invite Email</h2>
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="friend@example.com"
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none"
            />
            <button
              onClick={handleSendEmail}
              disabled={sending || !sendEmail}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm rounded-xl font-medium transition-colors"
            >
              {sending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </div>

        {/* Invite code list */}
        <div className="bg-white/5 rounded-2xl border border-white/8 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{invites.length} Codes</h2>
            <div className="flex gap-1">
              {(['all', 'false', 'true'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                    filter === f ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'false' ? 'Unused' : 'Used'}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => copyCode(invite.code)}
                    className="font-mono text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {copied === invite.code ? '✓ Copied' : invite.code}
                  </button>
                  {invite.email && <span className="text-xs text-zinc-600">→ {invite.email}</span>}
                  {invite.note && <span className="text-xs text-zinc-700 italic">{invite.note}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    invite.usedById ? 'bg-emerald-400/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {invite.usedById ? 'Used' : 'Available'}
                  </span>
                  <span className="text-xs text-zinc-700">
                    {new Date(invite.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {invites.length === 0 && (
              <div className="px-6 py-8 text-center text-zinc-600 text-sm">No codes yet — generate some above.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
