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
      .then((data) => {
        if (data.success && (data.data as any).length > 0) {
          const ws = (data.data as any)[0]
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
      const data = await apiFetch(`/api/v1/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      if (data.success) {
        setInviteResult(data.data as any)
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
    const data = await apiFetch(`/api/v1/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' })
    if (data.success) {
      setMembers((m) => m.filter((member) => member.userId !== userId))
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    if (!workspaceId) return
    const data = await apiFetch(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
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
    OWNER:  'text-amber-600 bg-amber-50 border border-amber-200',
    ADMIN:  'text-indigo-600 bg-indigo-50 border border-indigo-200',
    MEMBER: 'text-emerald-600 bg-emerald-50 border border-emerald-200',
    VIEWER: 'text-slate-600 bg-slate-100 border border-slate-200',
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/workspace/settings" className="text-slate-400 hover:text-slate-600 text-sm transition-colors">← Settings</Link>
          <div>
            <h1 className="text-xl font-bold">Team Members</h1>
            <p className="text-xs text-slate-500">{workspaceName}</p>
          </div>
        </div>

        {/* Invite section */}
        {canManage && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Invite a Member</h2>
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-300"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none"
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

            {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

            {inviteResult && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-emerald-700 text-sm font-medium mb-2">
                  Invite created for {inviteResult.email}
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Share this link — expires {new Date(inviteResult.expiresAt).toLocaleDateString()}
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs bg-slate-100 rounded-lg px-3 py-2 text-slate-700 overflow-hidden text-ellipsis whitespace-nowrap">
                    {inviteResult.inviteUrl}
                  </code>
                  <button
                    onClick={copyInviteLink}
                    className="flex-shrink-0 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg transition-colors"
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
                <div key={role} className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 border border-slate-100">
                  <span className={`font-semibold ${ROLE_COLORS[role]?.split(' ')[0]}`}>{role}</span>
                  <br />{desc}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members list */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">{members.length} Members</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {member.user.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-slate-900 font-medium">{member.user.name}</p>
                    <p className="text-xs text-slate-500">{member.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {canManage && member.role !== 'OWNER' ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none"
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
                      className="text-slate-400 hover:text-red-600 text-xs transition-colors"
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
        <div className="mt-6 rounded-xl bg-slate-100 border border-slate-200 p-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="text-slate-700 font-medium">Privacy:</span> Members can only see tasks that are set to <em>workspace visibility</em>.
            Private tasks remain visible only to their creator — even admins cannot see them.
          </p>
        </div>
      </div>
    </div>
  )
}
