'use client'

import { AIAvatar, getModelConfig } from './AIAvatar'
import { OutputViewer } from './OutputViewer'

export interface TeamMember {
  subtaskId:      string
  title:          string
  model:          string
  category:       string
  executionOrder: number
}

export interface Message {
  id: string
  type: 'system' | 'ai' | 'routing_card'
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
  // routing_card
  team?: TeamMember[]
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

  if (message.type === 'routing_card') {
    const team = message.team ?? []
    return (
      <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 to-slate-50 p-4 animate-slide-up">
        {/* Header — Arivarangam AI branding */}
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ backgroundColor: '#1E1B4B', color: '#818CF8', border: '1.5px solid #818CF840' }}
          >
            ✦
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900">Arivarangam AI</span>
            <span className="text-xs text-slate-500 ml-1.5">assembled your team</span>
          </div>
          <time className="text-xs text-slate-400 ml-auto shrink-0">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
        </div>

        {/* Team list */}
        <div className="space-y-2 pl-10">
          {team.sort((a, b) => a.executionOrder - b.executionOrder).map((member) => {
            const cfg = getModelConfig(member.model)
            return (
              <div key={member.subtaskId} className="flex items-center gap-2">
                <AIAvatar model={member.model} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span className="text-xs text-slate-500 ml-1.5 truncate">
                    {member.title}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0 capitalize">
                  {member.category.replace(/_/g, ' ')}
                </span>
              </div>
            )
          })}
        </div>

        {team.length > 1 && (
          <p className="text-[11px] text-indigo-400 mt-3 pl-10">
            {team.length} AIs working in parallel — results will appear below as each completes
          </p>
        )}
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
