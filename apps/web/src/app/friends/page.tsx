'use client'
import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { TermsGuard } from '@/components/TermsGuard'

interface Friend {
  id: string
  userId: string
  displayName: string
  avatarUrl: string | null
  isVerified: boolean
  friendshipId: string
}

interface FriendRequest {
  id: string
  message?: string
  createdAt: string
}

export default function FriendsPage() {
  return (
    <TermsGuard>
      <FriendsContent />
    </TermsGuard>
  )
}

function FriendsContent() {
  const [tab, setTab] = useState<'friends' | 'incoming' | 'outgoing'>('friends')
  const [friends, setFriends] = useState<Friend[]>([])
  const [incoming, setIncoming] = useState<FriendRequest[]>([])
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [friendsRes, requestsRes] = await Promise.all([
      apiFetch('/api/v1/social/friends'),
      apiFetch('/api/v1/social/friends/requests'),
    ])
    if (friendsRes?.success && friendsRes.data) setFriends(friendsRes.data as Friend[])
    if (requestsRes?.success && requestsRes.data) {
      const d = requestsRes.data as { incoming?: FriendRequest[]; outgoing?: FriendRequest[] }
      setIncoming(d.incoming ?? [])
      setOutgoing(d.outgoing ?? [])
    }
  }

  async function respondToRequest(id: string, action: 'ACCEPT' | 'REJECT') {
    await apiFetch(`/api/v1/social/friends/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    })
    loadData()
  }

  async function unfriend(friendshipId: string) {
    if (!confirm('Remove this friend?')) return
    await apiFetch(`/api/v1/social/friends/${friendshipId}`, { method: 'DELETE' })
    loadData()
  }

  const filteredFriends = friends.filter(f =>
    f.displayName?.toLowerCase().includes(search.toLowerCase())
  )

  const tabs = [
    { key: 'friends', label: `Friends (${friends.length})` },
    { key: 'incoming', label: `Requests (${incoming.length})` },
    { key: 'outgoing', label: `Sent (${outgoing.length})` },
  ]

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Friends</h1>

        <div className="flex gap-2 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as 'friends' | 'incoming' | 'outgoing')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'friends' && (
          <>
            <input
              type="text"
              placeholder="Search friends..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full mb-4 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="space-y-3">
              {filteredFriends.map(f => (
                <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center overflow-hidden">
                      {f.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.avatarUrl} alt={f.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold">{f.displayName[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-white font-medium">{f.displayName}</p>
                      {f.isVerified && <span className="text-indigo-400 text-xs">Verified</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => unfriend(f.friendshipId)}
                    className="text-gray-500 hover:text-red-400 text-sm transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {filteredFriends.length === 0 && (
                <p className="text-gray-500 text-center py-8">No friends found</p>
              )}
            </div>
          </>
        )}

        {tab === 'incoming' && (
          <div className="space-y-3">
            {incoming.map(req => (
              <div key={req.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Friend request</p>
                  {req.message && <p className="text-gray-400 text-sm mt-1">&ldquo;{req.message}&rdquo;</p>}
                  <p className="text-gray-500 text-xs mt-1">{new Date(req.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondToRequest(req.id, 'ACCEPT')}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respondToRequest(req.id, 'REJECT')}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
            {incoming.length === 0 && <p className="text-gray-500 text-center py-8">No incoming requests</p>}
          </div>
        )}

        {tab === 'outgoing' && (
          <div className="space-y-3">
            {outgoing.map(req => (
              <div key={req.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Pending request</p>
                  <p className="text-gray-500 text-xs mt-1">{new Date(req.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded-full">Pending</span>
              </div>
            ))}
            {outgoing.length === 0 && <p className="text-gray-500 text-center py-8">No outgoing requests</p>}
          </div>
        )}
      </div>
    </div>
  )
}
