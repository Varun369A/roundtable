'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import Link from 'next/link'

interface Workspace {
  id: string
  name: string
  slug: string
  description?: string
  type: 'PERSONAL' | 'TEAM' | 'ENTERPRISE'
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  settings: {
    allowMemberInvite: boolean
    defaultTaskVisibility: 'private' | 'workspace'
    requireApprovalForPublish: boolean
  }
  memberCount: number
  taskCount: number
}

export default function WorkspaceSettingsPage() {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [active, setActive] = useState<Workspace | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [settings, setSettings] = useState({
    allowMemberInvite: false,
    defaultTaskVisibility: 'private' as 'private' | 'workspace',
    requireApprovalForPublish: false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch<Workspace[]>('/api/v1/workspaces/my')
      .then((data) => {
        if (data.success) {
          setWorkspaces(data.data as Workspace[])
          if ((data.data as Workspace[]).length > 0) {
            const ws = (data.data as Workspace[])[0]
            setActive(ws)
            setName(ws.name)
            setDescription(ws.description || '')
            setSettings({ ...ws.settings })
          }
        }
      })
  }, [])

  const switchWorkspace = (ws: Workspace) => {
    setActive(ws)
    setName(ws.name)
    setDescription(ws.description || '')
    setSettings({ ...ws.settings })
    setSaved(false)
  }

  const handleSave = async () => {
    if (!active) return
    setSaving(true)
    setError('')
    try {
      const data = await apiFetch(`/api/v1/workspaces/${active.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, description, settings }),
      })
      if (data.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        setWorkspaces((ws) => ws.map((w) => w.id === active.id ? { ...w, name, description, settings } : w))
        setActive((w) => w ? { ...w, name, description, settings } : w)
      } else {
        setError(data.error?.message || 'Failed to save')
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleSwitchActive = async (ws: Workspace) => {
    await apiFetch('/api/v1/workspaces/current', {
      method: 'PUT',
      body: JSON.stringify({ workspaceId: ws.id }),
    })
    router.refresh()
  }

  const canEdit = active?.role === 'OWNER' || active?.role === 'ADMIN'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 text-sm transition-colors">← Dashboard</Link>
          <h1 className="text-xl font-bold">Workspace Settings</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workspace list */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Your Workspaces</h2>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => switchWorkspace(ws)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  active?.id === ws.id
                    ? 'bg-indigo-50 border-indigo-200 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{ws.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {ws.type === 'PERSONAL' ? 'Personal' : `${ws.memberCount} members`} · {ws.role}
                    </p>
                  </div>
                  {ws.type === 'PERSONAL' && (
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">Personal</span>
                  )}
                </div>
              </button>
            ))}

            {/* Create new workspace */}
            <Link
              href="/pricing"
              className="block w-full p-3 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-all"
            >
              + New Team Workspace
              <br />
              <span className="text-indigo-600">Power plan required</span>
            </Link>
          </div>

          {/* Settings form */}
          {active && (
            <div className="lg:col-span-2 space-y-6">
              {/* Identity */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Workspace Identity</h3>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                    {active.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{active.name}</p>
                    <p className="text-xs text-slate-500">{active.taskCount} tasks · {active.type}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1.5">Workspace name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!canEdit}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-300 disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1.5">Description (optional)</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:border-slate-300 disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              {/* Privacy settings */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">Privacy & Visibility</h3>
                <p className="text-xs text-slate-500 mb-4">Control how tasks and content are shared within your workspace</p>

                <div className="space-y-4">
                  <label className="flex items-start justify-between gap-4 cursor-pointer">
                    <div>
                      <p className="text-sm text-slate-900">Default task visibility: workspace</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        New tasks are visible to all workspace members by default
                      </p>
                    </div>
                    <div
                      className={`flex-shrink-0 w-10 h-5 rounded-full transition-colors ${
                        settings.defaultTaskVisibility === 'workspace' ? 'bg-indigo-500' : 'bg-slate-300'
                      } ${!canEdit ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      onClick={() => {
                        if (!canEdit) return
                        setSettings((s) => ({
                          ...s,
                          defaultTaskVisibility: s.defaultTaskVisibility === 'workspace' ? 'private' : 'workspace',
                        }))
                      }}
                    >
                      <div className={`w-4 h-4 m-0.5 rounded-full bg-white transition-transform ${
                        settings.defaultTaskVisibility === 'workspace' ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </label>

                  {active.type !== 'PERSONAL' && (
                    <label className="flex items-start justify-between gap-4 cursor-pointer">
                      <div>
                        <p className="text-sm text-slate-900">Allow members to invite others</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Members can invite new people (not just admins)
                        </p>
                      </div>
                      <div
                        className={`flex-shrink-0 w-10 h-5 rounded-full transition-colors ${
                          settings.allowMemberInvite ? 'bg-indigo-500' : 'bg-slate-300'
                        } ${!canEdit ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => {
                          if (!canEdit) return
                          setSettings((s) => ({ ...s, allowMemberInvite: !s.allowMemberInvite }))
                        }}
                      >
                        <div className={`w-4 h-4 m-0.5 rounded-full bg-white transition-transform ${
                          settings.allowMemberInvite ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Privacy guarantee */}
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-xs font-semibold text-emerald-700 mb-1">🔒 Your privacy is guaranteed</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tasks marked <strong className="text-slate-700">private</strong> are only visible to you — no workspace member, admin, or Arivarangam employee can see them.
                  Arivarangam never uses your task content to train AI models.
                </p>
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              {canEdit && (
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => handleSwitchActive(active)}
                    className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm transition-colors"
                  >
                    Set as Active
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
