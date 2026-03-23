'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { TermsGuard } from '@/components/TermsGuard'

interface Conversation {
  id: string
  name?: string
  type: 'DIRECT' | 'GROUP'
  avatarUrl?: string
  createdById?: string
  members?: { userId: string }[]
  messages?: { content?: string; createdAt: string; deletedAt?: string }[]
}

interface Friend {
  id: string
  userId: string
  displayName: string
}

export default function MessagesPage() {
  return (
    <TermsGuard>
      <MessagesContent />
    </TermsGuard>
  )
}

function MessagesContent() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadConversations()
    loadFriends()
  }, [])

  async function loadConversations() {
    try {
      const res = await apiFetch('/api/v1/conversations')
      if (res?.success && res.data) setConversations(res.data as Conversation[])
    } finally {
      setLoading(false)
    }
  }

  async function loadFriends() {
    const res = await apiFetch('/api/v1/social/friends')
    if (res?.success && res.data) setFriends(res.data as Friend[])
  }

  async function createDM(friendUserId: string) {
    setCreating(true)
    const res = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      body: JSON.stringify({ type: 'DIRECT', memberUserIds: [friendUserId] }),
    })
    if (res?.success && res.data) {
      const d = res.data as { id: string }
      router.push(`/messages/${d.id}`)
    }
    setCreating(false)
    setShowNew(false)
  }

  async function createGroup() {
    if (!newGroupName.trim() || selectedIds.length < 1) return
    setCreating(true)
    const res = await apiFetch('/api/v1/conversations', {
      method: 'POST',
      body: JSON.stringify({ type: 'GROUP', name: newGroupName, memberUserIds: selectedIds }),
    })
    if (res?.success && res.data) {
      const d = res.data as { id: string }
      router.push(`/messages/${d.id}`)
    }
    setCreating(false)
    setShowNew(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Messages</h1>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            New Message
          </button>
        </div>

        {showNew && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6">
              <h2 className="text-white font-bold mb-4">New Conversation</h2>

              <div className="mb-4">
                <input
                  placeholder="Group name (optional, for groups)"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 mb-3"
                />
                <p className="text-gray-400 text-xs mb-2">Select people to message:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {friends.map(f => (
                    <label key={f.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(f.userId)}
                        onChange={e =>
                          setSelectedIds(prev =>
                            e.target.checked ? [...prev, f.userId] : prev.filter(id => id !== f.userId)
                          )
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-white text-sm">{f.displayName}</span>
                    </label>
                  ))}
                  {friends.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">No friends yet. Add friends first.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowNew(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                {selectedIds.length === 1 && !newGroupName ? (
                  <button
                    onClick={() => createDM(selectedIds[0])}
                    disabled={creating}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Start DM'}
                  </button>
                ) : (
                  <button
                    onClick={createGroup}
                    disabled={creating || !newGroupName.trim() || selectedIds.length < 1}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Group'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {conversations.map(conv => {
            const lastMsg = conv.messages?.[0]
            return (
              <button
                key={conv.id}
                onClick={() => router.push(`/messages/${conv.id}`)}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3 hover:border-gray-600 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-700 flex items-center justify-center flex-shrink-0">
                  {conv.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={conv.avatarUrl} alt={conv.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-white font-bold">
                      {conv.name?.[0]?.toUpperCase() ?? (conv.type === 'GROUP' ? 'G' : 'D')}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-medium truncate">
                      {conv.name ?? (conv.type === 'DIRECT' ? 'Direct Message' : 'Group')}
                    </p>
                    {lastMsg && (
                      <span className="text-gray-500 text-xs flex-shrink-0 ml-2">
                        {new Date(lastMsg.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm truncate">
                    {lastMsg
                      ? lastMsg.deletedAt
                        ? 'This message was deleted'
                        : lastMsg.content?.slice(0, 50)
                      : 'No messages yet'}
                  </p>
                </div>
              </button>
            )
          })}
          {conversations.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No conversations yet</p>
              <button
                onClick={() => setShowNew(true)}
                className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm"
              >
                Start a conversation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
