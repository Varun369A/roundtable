'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { TermsGuard } from '@/components/TermsGuard'

const CATEGORY_COLORS: Record<string, string> = {
  CODE: 'bg-blue-900 text-blue-400',
  CONTENT: 'bg-purple-900 text-purple-400',
  DESIGN: 'bg-pink-900 text-pink-400',
  STRATEGY: 'bg-yellow-900 text-yellow-400',
  RESEARCH: 'bg-green-900 text-green-400',
  MIXED: 'bg-gray-700 text-gray-400',
}

const VISIBILITY_ICONS: Record<string, string> = {
  PRIVATE: '🔒',
  FRIENDS: '👥',
  COLLABORATORS: '🤝',
}

interface Repo {
  id: string
  name: string
  description?: string
  category: string
  visibility: string
  _count?: { items: number }
}

interface CreateForm {
  name: string
  description: string
  category: string
  visibility: string
}

export default function ReposPage() {
  return (
    <TermsGuard>
      <ReposContent />
    </TermsGuard>
  )
}

function ReposContent() {
  const router = useRouter()
  const [tab, setTab] = useState<'mine' | 'discover'>('mine')
  const [myRepos, setMyRepos] = useState<Repo[]>([])
  const [sharedRepos, setSharedRepos] = useState<Repo[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateForm>({ name: '', description: '', category: 'CODE', visibility: 'PRIVATE' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadRepos()
  }, [])

  async function loadRepos() {
    const [mine, shared] = await Promise.all([
      apiFetch('/api/v1/repos'),
      apiFetch('/api/v1/repos/discover'),
    ])
    if (mine?.success && mine.data) setMyRepos(mine.data as Repo[])
    if (shared?.success && shared.data) setSharedRepos(shared.data as Repo[])
  }

  async function createRepo(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await apiFetch('/api/v1/repos', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    if (res?.success && res.data) {
      const d = res.data as { id: string }
      setShowCreate(false)
      setForm({ name: '', description: '', category: 'CODE', visibility: 'PRIVATE' })
      router.push(`/repos/${d.id}`)
    }
    setCreating(false)
  }

  const displayRepos = tab === 'mine' ? myRepos : sharedRepos

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Repositories</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            New Repository
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { key: 'mine', label: `My Repos (${myRepos.length})` },
            { key: 'discover', label: `Shared With Me (${sharedRepos.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as 'mine' | 'discover')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6">
              <h2 className="text-white font-bold mb-4">New Repository</h2>
              <form onSubmit={createRepo} className="space-y-4">
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Repository name"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
                />
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm resize-none"
                />
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-sm"
                >
                  {['CODE', 'CONTENT', 'DESIGN', 'STRATEGY', 'RESEARCH', 'MIXED'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={form.visibility}
                  onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-sm"
                >
                  <option value="PRIVATE">🔒 Private</option>
                  <option value="FRIENDS">👥 Friends</option>
                  <option value="COLLABORATORS">🤝 Collaborators only</option>
                </select>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayRepos.map(repo => (
            <button
              key={repo.id}
              onClick={() => router.push(`/repos/${repo.id}`)}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-left hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-white font-medium truncate flex-1">{repo.name}</h3>
                <span className="text-sm ml-2 flex-shrink-0">{VISIBILITY_ICONS[repo.visibility]}</span>
              </div>
              {repo.description && (
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">{repo.description}</p>
              )}
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[repo.category] ?? ''}`}>
                  {repo.category}
                </span>
                <span className="text-gray-600 text-xs">{repo._count?.items ?? 0} items</span>
              </div>
            </button>
          ))}
          {displayRepos.length === 0 && (
            <div className="col-span-2 text-center py-12 text-gray-500">
              {tab === 'mine' ? 'No repositories yet. Create your first one.' : 'No shared repositories yet.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
