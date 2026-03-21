'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: string[]
  timestamp: Date
}

const SUGGESTIONS = [
  'What\'s the platform health right now?',
  'Which AI model has the highest failure rate?',
  'Show me signups and activation this week',
  'What are users complaining about most?',
  'Which templates are performing best?',
  'Are there any stuck or stale tasks?',
  'Generate 20 beta codes for outreach',
  'What feature flags are currently enabled?',
]

export default function NovaPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm **NOVA**, your Sabha admin assistant. I have live access to all platform data — analytics, users, tasks, models, flags, and more.\n\nWhat would you like to know?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)

    try {
      const data = await apiFetch('/api/v1/admin/nova/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          sessionId,
        }),
      })

      if (data.success) {
        const d = data.data as any
        setSessionId(d.sessionId)
        setMessages((m) => [...m, {
          role: 'assistant',
          content: d.message,
          toolsUsed: d.toolsUsed,
          timestamp: new Date(),
        }])
      } else {
        setMessages((m) => [...m, {
          role: 'assistant',
          content: `Error: ${data.error?.message || 'Something went wrong'}`,
          timestamp: new Date(),
        }])
      }
    } catch {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: 'Network error — please try again.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [loading, messages, sessionId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const renderMarkdown = (text: string) => {
    // Minimal markdown: **bold**, `code`, line breaks
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-indigo-300 text-xs font-mono">$1</code>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <div className="h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/8 flex-shrink-0">
        <Link href="/admin" className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors">← Admin</Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm">🤖</div>
          <div>
            <p className="text-sm font-bold">NOVA</p>
            <p className="text-xs text-zinc-500">AI Admin Assistant · Live platform access</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-zinc-500">Connected</span>
        </div>
      </div>

      {/* Suggestions (only shown before any user message) */}
      {messages.filter((m) => m.role === 'user').length === 0 && (
        <div className="px-6 pt-6 flex-shrink-0">
          <p className="text-xs text-zinc-600 mb-3">Suggested questions</p>
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-left text-xs text-zinc-400 bg-white/4 hover:bg-white/8 border border-white/5 rounded-xl px-3 py-2.5 transition-colors hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs flex-shrink-0 mt-1">🤖</div>
            )}
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-first' : ''}`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-white/6 border border-white/8 text-zinc-200 rounded-tl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                ) : (
                  msg.content
                )}
              </div>
              {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {msg.toolsUsed.map((t) => (
                    <span key={t} className="text-[10px] text-zinc-600 bg-white/5 px-2 py-0.5 rounded-full font-mono">
                      ⚡ {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center text-xs flex-shrink-0 mt-1">👤</div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs flex-shrink-0">🤖</div>
            <div className="bg-white/6 border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-2 flex-shrink-0 border-t border-white/5">
        <div className="flex gap-3 items-end bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-white/20 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask NOVA anything about the platform…"
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 resize-none focus:outline-none max-h-32 disabled:opacity-50"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-8 h-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors"
          >
            <span className="text-white text-sm">↑</span>
          </button>
        </div>
        <p className="text-xs text-zinc-700 mt-2 text-center">
          Enter to send · Shift+Enter for new line · Session resets after 2h
        </p>
      </div>
    </div>
  )
}
