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
  owner:        'bg-indigo-50 text-indigo-600 border border-indigo-200',
  collaborator: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  viewer:       'bg-slate-100 text-slate-500 border border-slate-200',
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
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-700 hover:border-slate-300'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${session ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
        {session
          ? `${participants.length || 1} online`
          : isOwner ? 'Invite' : 'Session'}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 overflow-hidden">

          {/* Panel header */}
          <div className="px-4 py-3 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-700">Multiplayer Session</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Invite collaborators to watch live</p>
          </div>

          {loading ? (
            <div className="px-4 py-6 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
            </div>
          ) : !session ? (
            /* No session yet */
            <div className="px-4 py-5 text-center">
              <p className="text-[11px] text-slate-400 mb-4">
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
                <p className="text-[11px] text-slate-400">Only the owner can start a session.</p>
              )}
            </div>
          ) : (
            /* Session active */
            <>
              {/* Share link */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Share Link</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-[11px] text-slate-500 truncate font-mono">{shareUrl}</p>
                  </div>
                  <button
                    onClick={copyShareLink}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                      copied
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Share →'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-300 mt-1.5 font-mono">
                  Code: <span className="text-slate-500">{session.accessCode}</span>
                </p>
              </div>

              {/* Participants */}
              <div className="px-4 py-3">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2.5">
                  Participants ({participants.length})
                </p>

                {participants.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-2">No one else has joined yet.</p>
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
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full flex items-center justify-center">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            </span>
                          )}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{p.name}</p>
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
