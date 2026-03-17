'use client'

import { AIAvatar, getModelConfig } from './AIAvatar'
import { OutputViewer } from './OutputViewer'

export interface Message {
  id: string
  type: 'system' | 'ai'
  model?: string
  title?: string
  output?: {
    type: 'text' | 'image' | 'audio' | 'video' | 'json'
    content?: string
    fileUrl?: string
  }
  isError?: boolean
  timestamp: Date
  // Discussion Engine
  role?: 'INITIAL' | 'REVIEW' | 'SYNTHESIS'
  roundNumber?: number
}

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.type === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-zinc-600 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800">
          {message.title}
        </span>
      </div>
    )
  }

  const config = getModelConfig(message.model || '')

  return (
    <div className="flex items-start gap-3 animate-slide-up">
      <AIAvatar model={message.model || ''} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold" style={{ color: config.color }}>
            {config.label}
          </span>
          {message.title && (
            <span className="text-xs text-zinc-600 truncate">{message.title}</span>
          )}
          <span className="text-xs text-zinc-700 ml-auto shrink-0">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {message.isError ? (
          <div className="text-xs text-red-400 px-3 py-2 rounded-xl bg-red-400/5 border border-red-400/20">
            Failed to complete this step. Continuing with remaining tasks.
          </div>
        ) : message.output ? (
          <OutputViewer
            type={message.output.type}
            content={message.output.content}
            fileUrl={message.output.fileUrl}
          />
        ) : null}
      </div>
    </div>
  )
}
