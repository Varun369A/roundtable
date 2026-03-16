'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import Link from 'next/link'

interface Member {
  id: string
  userId: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  acceptedAt: string
  user: {
    id: string
    name: string
    email: string
    avatarUrl?: string
    tier: string
  }
}

interface InviteResult {
  email: string
  role: string
  inviteUrl: string
  expiresAt: string
}

export default function WorkspaceMembersPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState('Your Workspace')
  const [userRole, setUserRole] = useState<string>('MEMBER')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN' | 'VIEWER'>('MEMBER')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    apiFetch('/api/v1/workspaces/my')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data.length > 0) {
          const ws = data.data[0]
          setWorkspaceId(ws.id)
          setWorkspaceName(ws.name)
          setUserRole(ws.role)
          setMembers(ws.members || [])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleInvite = async () => {
    if (!workspaceId || !inviteEmail) return
    setInviting(true)
    setError('')
    setInviteResult(null)
    try {
      const res = await apiFetch(`/api/v1/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (data.success) {
        setInviteResult(data.data)
        setInviteEmail('')
      } else {
        setError(data.error?.message || 'Failed to send invite')
      }
    } catch {
      setError('Network error')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!workspaceId) return
    const res = await apiFetch(`/api/v1/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      setMembers((m) => m.filter((member) => member.userId !== userId))
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    if (!workspaceId) return
    const res = await apiFetch(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
    const data = await res.json()
    if (data.success) {
      setMembers((m) => m.map((member) => member.userId === userId ? { ...member, role: role as Member['role'] } : member))
    }
  }

  const copyInviteLink = () => {
    if (!inviteResult) return
    navigator.clipboard.writeText(inviteResult.inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canManage = userRole === 'OWNER' || userRole === 'ADMIN'
  const ROLE_COLORS: Record<string, string> = {
    OWNER:  'text-amber-400 bg-amber-400/10',
    ADMIN:  'text-indigo-400 bg-indigo-400/10',
    MEMBER: 'text-emerald-400 bg-emerald-400/10',
    VIEWER: 'text-zinc-400 bg-zinc-400/10',
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/workspace/settings" className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors">← Settings</Link>
          <div>
            <h1 className="text-xl font-bold">Team Members</h1>
            <p className="text-xs text-zinc-500">{workspaceName}</p>
          </div>
        </div>

        {/* Invite section */}
        {canManage && (
          <div className="bg-white/5 rounded-2xl border border-white/8 p-6 mb-6">
            <h2 className="text-sm font-semibold text-white mb-4">Invite a Member</h2>
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="VIEWER">Viewer</option>
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-xl font-medium transition-colors"
              >
                {inviting ? 'Sending…' : 'Invite'}
              </button>
            </div>

            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

            {inviteResult && (
              <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  Invite created for {inviteResult.email}
                </p>
                <p className="text-xs text-zinc-500 mb-3">
                  Share this link — expires {new Date(inviteResult.expiresAt).toLocaleDateString()}
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs bg-black/30 rounded-lg px-3 py-2 text-zinc-300 overflow-hidden text-ellipsis whitespace-nowrap">
                    {inviteResult.inviteUrl}
                  </code>
                  <button
                    onClick={copyInviteLink}
                    className="flex-shrink-0 px-3 py-2 bg-white/10 hover:bg-white/15 text-white text-xs rounded-lg transition-colors"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {/* Role descriptions */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { role: 'VIEWER', desc: 'Can view workspace tasks' },
                { role: 'MEMBER', desc: 'Can create and run tasks' },
                { role: 'ADMIN', desc: 'Can manage members and settings' },
              ].map(({ role, desc }) => (
                <div key={role} className="text-xs text-zinc-600 bg-white/3 rounded-lg p-2">
                  <span className={`font-semibold ${ROLE_COLORS[role]?.split(' ')[0]}`}>{role}</span>
                  <br />{desc}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members list */}
        <div className="bg-white/5 rounded-2xl border border-white/8 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">{members.length} Members</h2>
          </div>
          <div className="divide-y divide-white/5">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {member.user.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{member.user.name}</p>
                    <p className="text-xs text-zinc-500">{member.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {canManage && member.role !== 'OWNER' ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[member.role]}`}>
                      {member.role}
                    </span>
                  )}
                  {canManage && member.role !== 'OWNER' && (
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
                      className="text-zinc-700 hover:text-red-400 text-xs transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy note */}
        <div className="mt-6 rounded-xl bg-zinc-900/50 border border-white/5 p-4">
          <p className="text-xs text-zinc-500 leading-relaxed">
            <span className="text-zinc-400 font-medium">Privacy:</span> Members can only see tasks that are set to <em>workspace visibility</em>.
            Private tasks remain visible only to their creator — even admins cannot see them.
          </p>
        </div>
      </div>
    </div>
  )
}
