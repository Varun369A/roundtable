'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

interface Repo {
  id: string
  name: string
  category: string
  visibility: string
  _count?: { items: number }
}

interface RepoItem {
  id: string
  title: string
  category: string
  content: string
  version: number
  sourceTaskId?: string
}

interface Commit {
  id: string
  message: string
  itemsAdded: number
  itemsModified: number
  itemsRemoved: number
  createdAt: string
}

interface NewItemForm {
  title: string
  category: string
  content: string
}

export default function RepoDetailPage() {
  return (
    <TermsGuard>
      <RepoDetail />
    </TermsGuard>
  )
}

function RepoDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [repo, setRepo] = useState<Repo | null>(null)
  const [items, setItems] = useState<RepoItem[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [selectedItem, setSelectedItem] = useState<RepoItem | null>(null)
  const [tab, setTab] = useState<'items' | 'commits'>('items')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState<NewItemForm>({ title: '', category: 'CODE', content: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadAll()
  }, [id])

  async function loadAll() {
    const [repoRes, itemsRes, commitsRes] = await Promise.all([
      apiFetch(`/api/v1/repos/${id}`),
      apiFetch(`/api/v1/repos/${id}/items`),
      apiFetch(`/api/v1/repos/${id}/commits`),
    ])
    if (repoRes?.success && repoRes.data) setRepo(repoRes.data as Repo)
    if (itemsRes?.success && itemsRes.data) setItems(itemsRes.data as RepoItem[])
    if (commitsRes?.success && commitsRes.data) setCommits(commitsRes.data as Commit[])
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const res = await apiFetch(`/api/v1/repos/${id}/items`, {
      method: 'POST',
      body: JSON.stringify(newItem),
    })
    if (res?.success && res.data) {
      setItems(prev => [res.data as RepoItem, ...prev])
      setShowAddItem(false)
      setNewItem({ title: '', category: 'CODE', content: '' })
    }
    setAdding(false)
  }

  const filteredItems = items.filter(item =>
    (!categoryFilter || item.category === categoryFilter) &&
    (!searchFilter || item.title.toLowerCase().includes(searchFilter.toLowerCase()))
  )

  if (!repo) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/repos')} className="text-gray-400 hover:text-white">←</button>
            <div>
              <h1 className="text-white font-bold">{repo.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[repo.category]}`}>
                  {repo.category}
                </span>
                <span className="text-gray-500 text-xs">{repo.visibility}</span>
                <span className="text-gray-500 text-xs">{repo._count?.items ?? 0} items</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowAddItem(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
          >
            Add Item
          </button>
        </div>
      </div>

      {/* Add item modal */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl p-6">
            <h2 className="text-white font-bold mb-4">Add Item</h2>
            <form onSubmit={addItem} className="space-y-4">
              <input
                required
                value={newItem.title}
                onChange={e => setNewItem(f => ({ ...f, title: e.target.value }))}
                placeholder="Title"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
              <select
                value={newItem.category}
                onChange={e => setNewItem(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 text-sm"
              >
                {['CODE', 'CONTENT', 'DESIGN', 'STRATEGY', 'RESEARCH', 'MIXED'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <textarea
                required
                value={newItem.content}
                onChange={e => setNewItem(f => ({ ...f, content: e.target.value }))}
                placeholder="Content..."
                rows={8}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm font-mono resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto flex h-[calc(100vh-80px)]">
        {/* Left panel */}
        <div className="w-80 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <div className="flex gap-2 mb-3">
              {(['items', 'commits'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    tab === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            {tab === 'items' && (
              <>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none text-xs mb-2"
                />
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none text-xs"
                >
                  <option value="">All categories</option>
                  {['CODE', 'CONTENT', 'DESIGN', 'STRATEGY', 'RESEARCH', 'MIXED'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {tab === 'items' && filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`w-full p-3 text-left border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                  selectedItem?.id === item.id ? 'bg-gray-800' : ''
                }`}
              >
                <p className="text-white text-sm font-medium truncate">{item.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[item.category]}`}>
                    {item.category}
                  </span>
                  <span className="text-gray-600 text-xs">v{item.version}</span>
                </div>
              </button>
            ))}
            {tab === 'commits' && commits.map(commit => (
              <div key={commit.id} className="p-3 border-b border-gray-800">
                <p className="text-white text-sm truncate">{commit.message}</p>
                <div className="flex items-center gap-3 mt-1 text-gray-500 text-xs">
                  <span>+{commit.itemsAdded}</span>
                  <span>~{commit.itemsModified}</span>
                  <span>-{commit.itemsRemoved}</span>
                  <span>{new Date(commit.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedItem ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-xl font-bold">{selectedItem.title}</h2>
                <span className={`text-xs px-2 py-1 rounded-full ${CATEGORY_COLORS[selectedItem.category]}`}>
                  {selectedItem.category}
                </span>
              </div>
              <pre className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-gray-300 text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                {selectedItem.content}
              </pre>
              {selectedItem.sourceTaskId && (
                <p className="text-gray-500 text-xs mt-3">From Roundtable: {selectedItem.sourceTaskId}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select an item to view its content
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
