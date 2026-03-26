'use client'

import { useState, useRef, useEffect } from 'react'
import { apiFetch } from '@/lib/api'

interface EditMessage {
  role: 'user' | 'assistant'
  content: string
  sessionId?: string
  timestamp: Date
}

interface EditChatPanelProps {
  taskId: string
  isApplying: boolean
  onSessionCreated: (sessionId: string) => void
}

export function EditChatPanel({ taskId, isApplying, onSessionCreated }: EditChatPanelProps) {
  const [messages, setMessages] = useState<EditMessage[]>([
    {
      role: 'assistant',
      content: 'Your project is ready! Tell me what you want to change — I\'ll plan the edits and show you exactly what will be modified before applying.',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const msg = input.trim()
    if (!msg || sending || isApplying) return

    setMessages((prev) => [...prev, { role: 'user', content: msg, timestamp: new Date() }])
    setInput('')
    setSending(true)

    const res = await apiFetch<{ sessionId: string; status: string }>(
      `/api/v1/code-projects/${taskId}/edit`,
      { method: 'POST', body: JSON.stringify({ message: msg }) },
    )

    setSending(false)

    if (res.success && res.data) {
      onSessionCreated(res.data.sessionId)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Analysing your project and planning the changes…',
          sessionId: res.data!.sessionId,
          timestamp: new Date(),
        },
      ])
    } else {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, something went wrong: ${res.error?.message ?? 'Unknown error'}. Please try again.`,
          timestamp: new Date(),
        },
      ])
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message history */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs shrink-0 mt-0.5">
                AI
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {(sending || isApplying) && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs shrink-0 mt-0.5">
              AI
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-2.5">
              <div className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <div
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 p-4 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isApplying ? 'Applying changes…' : 'Describe what to change (e.g. "add dark mode", "fix the login bug")'}
            disabled={sending || isApplying}
            rows={2}
            className="flex-1 resize-none px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 focus:border-indigo-500 focus:outline-none text-sm text-slate-900 placeholder-slate-400 transition-colors disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending || isApplying}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-40 shrink-0"
          >
            Send
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
