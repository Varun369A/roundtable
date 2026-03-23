'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'

export default function JoinWorkspacePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  const joinWorkspace = useCallback(async () => {
    if (!token) {
      setStatus('error')
      setMessage('No invite token provided. Please check your invite link.')
      return
    }

    try {
      const data = await apiFetch('/api/v1/workspaces/join', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })

      if (data.success) {
        setStatus('success')
        setWorkspaceId((data.data as any).workspaceId)
        setTimeout(() => router.push('/dashboard'), 2000)
      } else {
        setStatus('error')
        setMessage(data.error?.message || 'Failed to join workspace')
      }
    } catch {
      setStatus('error')
      setMessage('Network error — please try again')
    }
  }, [token, router])

  useEffect(() => {
    // Check if user is logged in
    const accessToken = localStorage.getItem('accessToken')
    if (!accessToken) {
      const returnUrl = encodeURIComponent(`/workspace/join?token=${token}`)
      router.push(`/login?returnUrl=${returnUrl}`)
      return
    }
    joinWorkspace()
  }, [joinWorkspace, token, router])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-slate-900 font-semibold mb-1">Joining workspace…</h2>
            <p className="text-slate-500 text-sm">Verifying your invite token</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-slate-900 font-bold text-xl mb-2">You're in!</h2>
            <p className="text-slate-600 text-sm mb-4">Welcome to the workspace. Redirecting to dashboard…</p>
            <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto" />
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-slate-900 font-bold text-xl mb-2">Unable to join</h2>
            <p className="text-slate-600 text-sm mb-6">{message}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm transition-colors"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
