'use client'

import { useState } from 'react'

interface OutputViewerProps {
  type: 'text' | 'image' | 'audio' | 'video' | 'json'
  content?: string
  fileUrl?: string
}

export function OutputViewer({ type, content, fileUrl }: OutputViewerProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = (content?.length || 0) > 600

  if (type === 'image' && fileUrl) {
    return (
      <div className="mt-2">
        <img
          src={fileUrl}
          alt="AI generated image"
          className="rounded-xl max-w-sm w-full border border-zinc-800"
          loading="lazy"
        />
      </div>
    )
  }

  if (type === 'audio' && fileUrl) {
    return (
      <div className="mt-2">
        <audio
          controls
          src={fileUrl}
          className="w-full max-w-md"
          style={{ filter: 'invert(0.85) hue-rotate(180deg)' }}
        />
      </div>
    )
  }

  if (type === 'video' && fileUrl) {
    return (
      <div className="mt-2">
        <video
          controls
          src={fileUrl}
          className="rounded-xl max-w-md w-full border border-zinc-800"
        />
      </div>
    )
  }

  if (type === 'json' && content) {
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = content
    }

    return (
      <div className="mt-2 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto max-h-64 overflow-y-auto">
        <pre>{JSON.stringify(parsed, null, 2)}</pre>
      </div>
    )
  }

  if (content) {
    const display = isLong && !expanded ? content.slice(0, 600) + '…' : content

    return (
      <div className="mt-2">
        <div className="p-3 rounded-xl rounded-tl-sm bg-zinc-900/80 border border-zinc-800 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
          {display}
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? '↑ Show less' : `↓ Show more (${content.length - 600} more chars)`}
          </button>
        )}
      </div>
    )
  }

  return null
}
