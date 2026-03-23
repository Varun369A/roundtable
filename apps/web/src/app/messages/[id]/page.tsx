'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { TermsGuard } from '@/components/TermsGuard'

interface Message {
  id: string
  content?: string
  type: 'TEXT' | 'SYSTEM' | string
  senderId: string
  createdAt: string
  editedAt?: string
  deletedAt?: string
}

interface Conversation {
  id: string
  name?: string
  type: 'DIRECT' | 'GROUP' | string
  createdById?: string
  members?: { userId: string }[]
}

export default function MessageThreadPage() {
  return (
    <TermsGuard>
      <MessageThread />
    </TermsGuard>
  )
}

function MessageThread() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [conv, setConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const loadMessages = useCallback(async (cursor?: string) => {
    const params = cursor ? `?cursor=${cursor}&limit=50` : '?limit=50'
    const res = await apiFetch(`/api/v1/conversations/${id}/messages${params}`)
    if (res?.success && res.data) {
      const data = res.data as Message[]
      if (cursor) {
        setMessages(prev => [...data, ...prev])
      } else {
        setMessages(data)
        const r = res as unknown as { nextCursor?: string }
        setNextCursor(r.nextCursor ?? null)
      }
    }
  }, [id])

  useEffect(() => {
    async function init() {
      const convRes = await apiFetch(`/api/v1/conversations/${id}`)
      if (convRes?.success && convRes.data) setConv(convRes.data as Conversation)
      await loadMessages()
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      await apiFetch(`/api/v1/conversations/${id}/read`, { method: 'POST' })
    }
    init()
  }, [id, loadMessages])

  // WebSocket connection for real-time
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (!token) return

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host.replace('3000', '3001')}/ws?token=${token}`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onmessage = (event) => {
        try {
          const ev = JSON.parse(event.data as string) as {
            conversationId: string
            type: string
            payload: Message & { messageId?: string }
          }
          if (ev.conversationId !== id) return

          if (ev.type === 'message.new') {
            setMessages(prev => [...prev, ev.payload])
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          } else if (ev.type === 'message.edit') {
            setMessages(prev => prev.map(m => m.id === ev.payload.id ? ev.payload : m))
          } else if (ev.type === 'message.delete') {
            setMessages(prev =>
              prev.map(m =>
                m.id === ev.payload.messageId
                  ? { ...m, deletedAt: new Date().toISOString(), content: 'This message was deleted' }
                  : m
              )
            )
          }
        } catch {
          // ignore parse errors
        }
      }

      return () => ws.close()
    } catch {
      // ignore connection errors
    }
  }, [id])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    const res = await apiFetch(`/api/v1/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type: 'TEXT' }),
    })
    if (res?.success && res.data) {
      setMessages(prev => [...prev, res.data as Message])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
    setSending(false)
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    const res = await apiFetch(`/api/v1/conversations/${id}/messages?cursor=${nextCursor}&limit=50`)
    if (res?.success && res.data) {
      const data = res.data as Message[]
      setMessages(prev => [...data, ...prev])
      const r = res as unknown as { nextCursor?: string }
      setNextCursor(r.nextCursor ?? null)
    }
    setLoadingMore(false)
  }

  const memberCount = conv?.members?.length ?? 0
  const title = conv?.name ?? (conv?.type === 'DIRECT' ? 'Direct Message' : 'Group')

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <button onClick={() => router.push('/messages')} className="text-gray-400 hover:text-white">←</button>
        <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center">
          <span className="text-white font-bold text-sm">{title[0]?.toUpperCase()}</span>
        </div>
        <div>
          <p className="text-white font-medium">{title}</p>
          {conv?.type === 'GROUP' && <p className="text-gray-500 text-xs">{memberCount} members</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {nextCursor && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full text-center text-gray-500 hover:text-gray-300 text-sm py-2"
          >
            {loadingMore ? 'Loading...' : 'Load earlier messages'}
          </button>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.senderId === conv?.createdById ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[70%] ${msg.deletedAt ? 'opacity-50' : ''}`}>
              <div
                className={`rounded-2xl px-4 py-2 ${
                  msg.type === 'SYSTEM'
                    ? 'bg-transparent text-gray-500 text-xs text-center italic'
                    : msg.senderId === conv?.createdById
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                {msg.type === 'SYSTEM' ? (
                  <p>{msg.content}</p>
                ) : msg.deletedAt ? (
                  <p className="italic text-sm">This message was deleted</p>
                ) : (
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1 px-1">
                <span className="text-gray-600 text-xs">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.editedAt && <span className="text-gray-600 text-xs">(edited)</span>}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={send}
        className="flex gap-3 px-4 py-3 border-t border-gray-800 bg-gray-900 flex-shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Message..."
          maxLength={4000}
          className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-full flex items-center justify-center transition-colors"
        >
          {sending ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  )
}
