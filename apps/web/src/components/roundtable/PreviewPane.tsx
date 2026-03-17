'use client'

import { useState, useEffect } from 'react'

export interface PreviewUpdate {
  subtaskTitle: string
  type: 'code' | 'image' | 'document' | 'article' | 'research' | 'learning' | 'text'
  html: string
  timestamp: Date
}

interface PreviewPaneProps {
  updates: PreviewUpdate[]
  templateCategory: string
  isGenerating: boolean
}

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  code:     { label: 'Code',     icon: '💻', color: 'text-indigo-400' },
  image:    { label: 'Design',   icon: '🎨', color: 'text-pink-400'   },
  document: { label: 'Document', icon: '📄', color: 'text-blue-400'   },
  article:  { label: 'Content',  icon: '✍️',  color: 'text-green-400'  },
  research: { label: 'Research', icon: '🔬', color: 'text-yellow-400' },
  learning: { label: 'Learning', icon: '📚', color: 'text-purple-400' },
  text:     { label: 'Output',   icon: '💬', color: 'text-zinc-400'   },
}

// Styles injected into the sandboxed preview iframe
const PREVIEW_STYLES = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f0f12; color: #e4e4e7;
    margin: 0; padding: 16px;
    font-size: 14px; line-height: 1.6;
  }
  .preview-root { max-width: 100%; }
  .preview-title {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.1em; color: #71717a; margin-bottom: 12px;
  }
  .preview-h1 { font-size: 20px; font-weight: 700; margin: 12px 0 8px; color: #f4f4f5; }
  .preview-h2 { font-size: 17px; font-weight: 600; margin: 10px 0 6px; color: #e4e4e7; }
  .preview-h3 { font-size: 14px; font-weight: 600; margin: 8px 0 4px; color: #d4d4d8; }
  .preview-p  { margin: 0 0 8px; color: #a1a1aa; }
  .preview-code {
    background: #18181b; border: 1px solid #27272a; border-radius: 6px;
    padding: 12px 14px; overflow-x: auto;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 12px; color: #86efac;
    white-space: pre-wrap; word-break: break-all; margin: 8px 0;
  }
  .preview-inline-code {
    background: #27272a; border-radius: 3px; padding: 1px 4px;
    font-family: monospace; font-size: 12px; color: #86efac;
  }
  .preview-ul { padding-left: 20px; margin: 4px 0; }
  li { color: #a1a1aa; margin: 2px 0; }
  .preview-image { max-width: 100%; border-radius: 8px; margin: 8px 0; }
  strong { color: #e4e4e7; }
  em { color: #a1a1aa; font-style: italic; }
`

export function PreviewPane({ updates, templateCategory, isGenerating }: PreviewPaneProps) {
  const [activeIdx, setActiveIdx] = useState(0)

  // Auto-switch to latest on new update
  useEffect(() => {
    if (updates.length > 0) setActiveIdx(updates.length - 1)
  }, [updates.length])

  const activeUpdate = updates[activeIdx]

  const srcDoc = activeUpdate
    ? `<html><head><style>${PREVIEW_STYLES}</style></head><body>${activeUpdate.html}</body></html>`
    : `<html><head><style>${PREVIEW_STYLES}</style></head><body>
        <div style="display:flex;align-items:center;justify-content:center;height:200px;color:#3f3f46;font-size:13px;text-align:center;">
          Preview will appear here as AIs generate output
        </div>
       </body></html>`

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-l border-zinc-800">
      {/* Header */}
      <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Live Preview</span>
          {isGenerating && (
            <span className="flex items-center gap-1 text-xs text-indigo-400">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Generating
            </span>
          )}
        </div>
        {updates.length > 0 && (
          <span className="text-xs text-zinc-600">
            {updates.length} output{updates.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tab bar — one tab per subtask output */}
      {updates.length > 1 && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-zinc-800 overflow-x-auto shrink-0">
          {updates.map((u, i) => {
            const cfg = TYPE_LABELS[u.type] || TYPE_LABELS.text
            return (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                  i === activeIdx
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <span>{cfg.icon}</span>
                <span>{u.subtaskTitle.slice(0, 22)}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Active output label */}
      {activeUpdate && (
        <div className="px-4 py-2 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${(TYPE_LABELS[activeUpdate.type] || TYPE_LABELS.text).color}`}>
              {(TYPE_LABELS[activeUpdate.type] || TYPE_LABELS.text).icon}{' '}
              {(TYPE_LABELS[activeUpdate.type] || TYPE_LABELS.text).label}
            </span>
            <span className="text-zinc-600 text-xs">·</span>
            <span className="text-zinc-500 text-xs truncate">{activeUpdate.subtaskTitle}</span>
          </div>
        </div>
      )}

      {/* Preview iframe — sandboxed, no scripts */}
      <div className="flex-1 overflow-hidden">
        <iframe
          srcDoc={srcDoc}
          sandbox="allow-same-origin"
          className="w-full h-full border-0"
          title="Live Preview"
        />
      </div>
    </div>
  )
}
