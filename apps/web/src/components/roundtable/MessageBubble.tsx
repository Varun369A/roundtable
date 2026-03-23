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
        <span className="text-xs text-slate-500 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
          {message.title}
        </span>
      </div>
    )
  }

  const config = getModelConfig(message.model || '')

  return (
    <article
      role="article"
      aria-label={`${config.label} response${message.title ? `: ${message.title}` : ''}`}
      className="flex items-start gap-3 animate-slide-up"
    >
      <AIAvatar model={message.model || ''} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold" style={{ color: config.color }}>
            {config.label}
          </span>
          {message.title && (
            <span className="text-xs text-slate-500 truncate">{message.title}</span>
          )}
          <time
            dateTime={message.timestamp.toISOString()}
            className="text-xs text-slate-400 ml-auto shrink-0"
          >
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
        </div>

        {message.isError ? (
          <div
            role="alert"
            className="text-xs text-red-600 px-3 py-2 rounded-xl bg-red-50 border border-red-200"
          >
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
    </article>
  )
}
