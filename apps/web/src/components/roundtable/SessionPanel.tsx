'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { apiFetch } from '@/lib/api'

interface SessionPanelProps {
  taskId: string
  taskStatus: string
  isOwner: boolean
}

interface Participant {
  id: string
  userId: string
  name: string
  email: string
  role: 'owner' | 'collaborator' | 'viewer'
  online: boolean
  joinedAt: string
}

interface Session {
  id: string
  accessCode: string
}

const ROLE_BADGE: Record<string, string> = {
  owner:        'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
  collaborator: 'bg-green-500/15 text-green-400 border border-green-500/30',
  viewer:       'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const AVATAR_COLORS = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-pink-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-sky-600',
]

function avatarColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function SessionPanel({ taskId, taskStatus, isOwner }: SessionPanelProps) {
  const [session, setSession]           = useState<Session | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [creating, setCreating]         = useState(false)
  const [copied, setCopied]             = useState(false)
  const [open, setOpen]                 = useState(false)
  const [loading, setLoading]           = useState(true)
  const intervalRef                     = useRef<NodeJS.Timeout | null>(null)
  const panelRef                        = useRef<HTMLDivElement>(null)

  const shareUrl = session
    ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/roundtable/${taskId}?code=${session.accessCode}`
    : ''

  const fetchParticipants = useCallback(async (sessionId: string) => {
    const res = await apiFetch<{ participants: Participant[] }>(
      `/api/v1/sessions/${sessionId}/participants`,
    )
    if (res.success && res.data) setParticipants(res.data.participants)
  }, [])

  // Load existing session on mount
  useEffect(() => {
    async function loadSession() {
      setLoading(true)
      const res = await apiFetch<{ session: Session | null }>(`/api/v1/tasks/${taskId}/session`)
      if (res.success && res.data?.session) {
        setSession(res.data.session)
        await fetchParticipants(res.data.session.id)
      }
      setLoading(false)
    }
    loadSession()
  }, [taskId, fetchParticipants])

  // Poll participants every 30s when session exists
  useEffect(() => {
    if (!session) return
    intervalRef.current = setInterval(() => fetchParticipants(session.id), 30_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [session, fetchParticipants])

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function createSession() {
    setCreating(true)
    const res = await apiFetch<{ session: Session }>(
      `/api/v1/tasks/${taskId}/session`,
      { method: 'POST' },
    )
    if (res.success && res.data?.session) {
      setSession(res.data.session)
      await fetchParticipants(res.data.session.id)
    }
    setCreating(false)
  }

  async function copyShareLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // Fallback for environments without clipboard API
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all duration-200 ${
          session
            ? 'bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/20'
            : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-zinc-200 hover:border-zinc-600'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${session ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`} />
        {session
          ? `${participants.length || 1} online`
          : isOwner ? 'Invite' : 'Session'}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl z-30 overflow-hidden">

          {/* Panel header */}
          <div className="px-4 py-3 border-b border-zinc-800">
            <p className="text-xs font-semibold text-zinc-300">Multiplayer Session</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Invite collaborators to watch live</p>
          </div>

          {loading ? (
            <div className="px-4 py-6 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
            </div>
          ) : !session ? (
            /* No session yet */
            <div className="px-4 py-5 text-center">
              <p className="text-[11px] text-zinc-500 mb-4">
                Start a session to share this roundtable with teammates in real time.
              </p>
              {isOwner ? (
                <button
                  onClick={createSession}
                  disabled={creating}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-xs font-semibold text-white transition-all duration-200 active:scale-95"
                >
                  {creating ? 'Creating…' : 'Start Session'}
                </button>
              ) : (
                <p className="text-[11px] text-zinc-600">Only the owner can start a session.</p>
              )}
            </div>
          ) : (
            /* Session active */
            <>
              {/* Share link */}
              <div className="px-4 py-3 border-b border-zinc-800/50">
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Share Link</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 px-2.5 py-1.5 bg-zinc-800 rounded-lg border border-zinc-700/50">
                    <p className="text-[11px] text-zinc-400 truncate font-mono">{shareUrl}</p>
                  </div>
                  <button
                    onClick={copyShareLink}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                      copied
                        ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Share →'}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-700 mt-1.5 font-mono">
                  Code: <span className="text-zinc-500">{session.accessCode}</span>
                </p>
              </div>

              {/* Participants */}
              <div className="px-4 py-3">
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2.5">
                  Participants ({participants.length})
                </p>

                {participants.length === 0 ? (
                  <p className="text-[11px] text-zinc-600 text-center py-2">No one else has joined yet.</p>
                ) : (
                  <div className="space-y-2">
                    {participants.map((p) => (
                      <div key={p.id} className="flex items-center gap-2.5">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div
                            className={`w-7 h-7 rounded-full ${avatarColor(p.userId)} flex items-center justify-center text-[10px] font-bold text-white`}
                          >
                            {getInitials(p.name)}
                          </div>
                          {p.online && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-zinc-900 rounded-full flex items-center justify-center">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                            </span>
                          )}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-300 truncate">{p.name}</p>
                        </div>

                        {/* Role badge */}
                        <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${ROLE_BADGE[p.role] || ROLE_BADGE.viewer}`}>
                          {p.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
