'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { TermsGuard } from '@/components/TermsGuard'

interface Profile {
  id: string
  displayName: string
  avatarUrl: string | null
  isVerified: boolean
  isPrivate: boolean
  bio?: string
  location?: string
  website?: string
  friendsCount?: number
  reposCount?: number
  isFriend?: boolean
  isOwn?: boolean
  message?: string
}

export default function ProfilePage() {
  return (
    <TermsGuard>
      <ProfileContent />
    </TermsGuard>
  )
}

function ProfileContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await apiFetch(`/api/v1/social/users/${id}`)
        if (res?.success && res.data) setProfile(res.data as Profile)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [id])

  async function sendRequest() {
    setRequesting(true)
    await apiFetch('/api/v1/social/friends/request', {
      method: 'POST',
      body: JSON.stringify({ targetProfileId: id }),
    })
    setRequestSent(true)
    setRequesting(false)
  }

  async function report() {
    await apiFetch('/api/v1/reports', {
      method: 'POST',
      body: JSON.stringify({ contentType: 'PROFILE', contentId: id, reason: 'OTHER' }),
    })
    alert('Report submitted')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl font-bold">User not found</p>
          <button onClick={() => router.push('/people')} className="mt-4 text-indigo-400 hover:text-indigo-300">
            Browse people
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">
          ← Back
        </button>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center overflow-hidden">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-2xl">{profile.displayName[0]?.toUpperCase()}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">{profile.displayName}</h1>
                  {profile.isVerified && <span className="text-indigo-400">✓</span>}
                </div>
                {(!profile.isPrivate || profile.isOwn || profile.isFriend) ? (
                  <div className="flex gap-4 mt-1 text-gray-400 text-sm">
                    <span>{profile.friendsCount ?? 0} friends</span>
                    <span>{profile.reposCount ?? 0} repos</span>
                  </div>
                ) : null}
              </div>
            </div>

            {!profile.isOwn && (
              <button onClick={report} className="text-gray-500 hover:text-gray-300 text-sm">
                Report
              </button>
            )}
          </div>

          {profile.message ? (
            <div className="text-center py-8">
              <p className="text-gray-400">{profile.message}</p>
              {!requestSent && !profile.isFriend && (
                <button
                  onClick={sendRequest}
                  disabled={requesting}
                  className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {requesting ? 'Sending...' : 'Send Friend Request'}
                </button>
              )}
              {requestSent && <p className="mt-4 text-green-400">Friend request sent!</p>}
            </div>
          ) : (
            <>
              {profile.bio && <p className="text-gray-300 mb-4">{profile.bio}</p>}
              {profile.location && <p className="text-gray-400 text-sm mb-2">📍 {profile.location}</p>}
              {profile.website && (
                <a
                  href={profile.website}
                  className="text-indigo-400 text-sm hover:underline mb-4 block"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {profile.website}
                </a>
              )}

              {!profile.isOwn && !profile.isFriend && (
                <button
                  onClick={sendRequest}
                  disabled={requesting || requestSent}
                  className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {requestSent ? 'Request sent' : requesting ? 'Sending...' : 'Add Friend'}
                </button>
              )}
              {profile.isFriend && (
                <span className="inline-flex items-center gap-1 mt-4 px-3 py-1 bg-green-900 text-green-400 rounded-full text-sm">
                  ✓ Friends
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
