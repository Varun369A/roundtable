'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  link?: string
  readAt: string | null
  createdAt: string
}

const TYPE_ICONS: Record<string, string> = {
  task_completed:  '✅',
  task_failed:     '❌',
  workspace_invite:'📨',
  weekly_digest:   '📊',
  system_alert:    '⚠️',
  model_fallback:  '🔄',
  healing_applied: '🔧',
}

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Load notifications
  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/api/v1/notifications?limit=20')
      if (data.success) {
        const notifs = (data.data as any)?.notifications ?? []
        setNotifications(notifs)
        setUnreadCount(notifs.filter((n: Notification) => !n.readAt).length)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // SSE subscription for live notifications
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) return

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const es = new EventSource(`${apiBase}/api/v1/notifications/stream?token=${token}`)

    es.addEventListener('notification', (e) => {
      try {
        const notif: Notification = JSON.parse(e.data)
        setNotifications((prev) => [notif, ...prev].slice(0, 20))
        setUnreadCount((c) => c + 1)
      } catch {}
    })

    es.addEventListener('connected', (e) => {
      try {
        const data = JSON.parse(e.data)
        setUnreadCount(data.unreadCount || 0)
      } catch {}
    })

    es.onerror = () => {
      // SSE will auto-reconnect; silence error noise
    }

    eventSourceRef.current = es
    return () => es.close()
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    setOpen((o) => !o)
    if (!open) loadNotifications()
  }

  const handleClick = async (notif: Notification) => {
    if (!notif.readAt) {
      await apiFetch(`/api/v1/notifications/${notif.id}/read`, { method: 'PATCH' })
      setNotifications((prev) =>
        prev.map((n) => n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n)
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    if (notif.link) {
      router.push(notif.link)
      setOpen(false)
    }
  }

  const markAllRead = async () => {
    await apiFetch('/api/v1/notifications/read-all', { method: 'POST' })
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })))
    setUnreadCount(0)
  }

  const timeAgo = (dateStr: string) => {
    const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (secs < 60) return 'just now'
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
    return `${Math.floor(secs / 86400)}d ago`
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/8 transition-colors"
        aria-label="Notifications"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-[#1a1a1f] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <p className="text-sm font-semibold text-white">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-zinc-600 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-white/4 transition-colors flex gap-3 ${
                    !n.readAt ? 'bg-indigo-500/5' : ''
                  }`}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '📌'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold truncate ${!n.readAt ? 'text-white' : 'text-zinc-400'}`}>
                        {n.title}
                      </p>
                      {!n.readAt && (
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-zinc-700 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
