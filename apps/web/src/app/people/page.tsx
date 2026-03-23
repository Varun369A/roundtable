'use client'
import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { TermsGuard } from '@/components/TermsGuard'

interface UserCard {
  id: string
  displayName: string
  avatarUrl: string | null
  isVerified: boolean
  friendsCount: number
  isFriend: boolean
  requestSent: boolean
}

export default function PeoplePage() {
  return (
    <TermsGuard>
      <PeopleContent />
    </TermsGuard>
  )
}

function PeopleContent() {
  const [users, setUsers] = useState<UserCard[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const fetchUsers = useCallback(async (searchTerm: string, pageNum: number, reset = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ search: searchTerm, page: String(pageNum), limit: '20' })
      const res = await apiFetch(`/api/v1/social/users?${params}`)
      if (res?.success && res.data) {
        const data = res.data as UserCard[]
        setUsers(prev => reset ? data : [...prev, ...data])
        setHasMore(data.length === 20)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    fetchUsers(search, 1, true)
  }, [search, fetchUsers])

  async function sendRequest(profileId: string) {
    await apiFetch('/api/v1/social/friends/request', {
      method: 'POST',
      body: JSON.stringify({ targetProfileId: profileId }),
    })
    setUsers(prev => prev.map(u => u.id === profileId ? { ...u, requestSent: true } : u))
  }

  function loadMore() {
    const next = page + 1
    setPage(next)
    fetchUsers(search, next)
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Discover People</h1>

        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full mb-6 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map(user => (
            <div key={user.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">{user.displayName[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-white font-medium truncate">{user.displayName}</span>
                  {user.isVerified && <span className="text-indigo-400 text-xs">✓</span>}
                </div>
                <span className="text-gray-500 text-xs">{user.friendsCount} friends</span>
              </div>
              <div className="flex-shrink-0">
                {user.isFriend ? (
                  <span className="text-xs px-2 py-1 bg-green-900 text-green-400 rounded-full">Friends</span>
                ) : user.requestSent ? (
                  <span className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded-full">Sent</span>
                ) : (
                  <button
                    onClick={() => sendRequest(user.id)}
                    className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          </div>
        )}

        {!loading && hasMore && users.length > 0 && (
          <button
            onClick={loadMore}
            className="w-full mt-6 py-3 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  )
}
