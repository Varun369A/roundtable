'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'

interface ReactionBarProps {
  taskId: string
  subtaskId: string
  sessionId?: string
  reactions?: Array<{ reaction: string; count: number }>
}

const EMOJIS = ['👍', '🔥', '✨', '❓', '💡', '👎'] as const

export function ReactionBar({ taskId, subtaskId, reactions: initialReactions = [] }: ReactionBarProps) {
  const [reactions, setReactions] = useState<Array<{ reaction: string; count: number }>>(initialReactions)
  const [animating, setAnimating] = useState<string | null>(null)

  function getCount(emoji: string): number {
    return reactions.find((r) => r.reaction === emoji)?.count ?? 0
  }

  async function handleReaction(emoji: string) {
    // Optimistic update
    setReactions((prev) => {
      const existing = prev.find((r) => r.reaction === emoji)
      if (existing) {
        return prev.map((r) =>
          r.reaction === emoji ? { ...r, count: r.count + 1 } : r,
        )
      }
      return [...prev, { reaction: emoji, count: 1 }]
    })

    // Bounce animation
    setAnimating(emoji)
    setTimeout(() => setAnimating(null), 300)

    await apiFetch(`/api/v1/tasks/${taskId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ subtaskId, reaction: emoji }),
    })
  }

  return (
    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
      {EMOJIS.map((emoji) => {
        const count = getCount(emoji)
        const isAnimating = animating === emoji
        return (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-xs transition-all duration-150 hover:bg-slate-100 active:bg-slate-200 ${
              count > 0
                ? 'bg-slate-100 border border-slate-200'
                : 'border border-transparent hover:border-slate-200'
            } ${isAnimating ? 'scale-125' : 'scale-100'}`}
            title={emoji}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {count > 0 && (
              <span className="text-[10px] font-medium text-slate-500 leading-none">{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
