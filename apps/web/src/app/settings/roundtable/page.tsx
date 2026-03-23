'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface RoutingRow {
  category: string
  defaultModel: string
  userModel: string | null
  effectiveModel: string
}

const CATEGORY_META: Record<string, { label: string; icon: string; description: string }> = {
  research:      { label: 'Research',      icon: '🔬', description: 'Web search, fact-finding, citations' },
  code:          { label: 'Code',          icon: '💻', description: 'Programming, debugging, architecture' },
  copywriting:   { label: 'Copywriting',   icon: '✍️',  description: 'Blog posts, ads, social content' },
  strategy:      { label: 'Strategy',      icon: '🧭', description: 'Business plans, positioning, roadmaps' },
  images:        { label: 'Images',        icon: '🎨', description: 'Image generation and visuals' },
  data_analysis: { label: 'Data Analysis', icon: '📊', description: 'Charts, insights, data interpretation' },
  translation:   { label: 'Translation',   icon: '🌐', description: 'Multi-language output' },
  audio:         { label: 'Audio',         icon: '🎙️', description: 'Voiceover, TTS, audio scripts' },
  video:         { label: 'Video',         icon: '🎬', description: 'Video concepts and scripts' },
  presentation:  { label: 'Presentation',  icon: '📽️', description: 'Slide decks and presentations' },
  general:       { label: 'General',       icon: '💬', description: 'All-purpose tasks' },
}

const ALL_MODELS = [
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', icon: '🟠' },
  { value: 'claude-3-opus',     label: 'Claude 3 Opus',     icon: '🟠' },
  { value: 'gpt-4o',            label: 'GPT-4o',            icon: '🟢' },
  { value: 'gpt-4-turbo',       label: 'GPT-4 Turbo',       icon: '🟢' },
  { value: 'gemini-pro',        label: 'Gemini Pro',         icon: '🔵' },
  { value: 'perplexity-sonar',  label: 'Perplexity Sonar',  icon: '🔮' },
  { value: 'midjourney-v6',     label: 'Midjourney v6',     icon: '🎨' },
  { value: 'dalle-3',           label: 'DALL-E 3',          icon: '🟢' },
  { value: 'stability-xl',      label: 'Stability XL',      icon: '🎨' },
  { value: 'elevenlabs',        label: 'ElevenLabs',        icon: '🎙️' },
  { value: 'runway-gen3',       label: 'Runway Gen3',       icon: '🎬' },
  { value: 'gamma',             label: 'Gamma',             icon: '📽️' },
  { value: 'sarvam-1',          label: 'Sarvam-1',          icon: '🇮🇳' },
  { value: 'groq',              label: 'Groq',              icon: '⚡' },
  { value: 'cohere',            label: 'Cohere',            icon: '🌊' },
  { value: 'sabha-ai',          label: 'Arivarangam',          icon: '🧠' },
]

export default function RoundtableCustomizePage() {
  const [rows, setRows]           = useState<RoutingRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [dragIdx, setDragIdx]     = useState<number | null>(null)
  const [dragOver, setDragOver]   = useState<number | null>(null)

  async function load() {
    const res = await apiFetch<{ data: { routing: RoutingRow[] } }>('/api/v1/routing-preferences')
    if (res.success && res.data) setRows((res.data as any).data.routing)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function updateModel(idx: number, model: string) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, userModel: model === '__default__' ? null : model, effectiveModel: model === '__default__' ? r.defaultModel : model } : r))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    const preferences = rows
      .filter((r) => r.userModel !== null)
      .map((r) => ({ category: r.category, model: r.userModel! }))
    await apiFetch('/api/v1/routing-preferences', { method: 'PUT', body: JSON.stringify({ preferences }) })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function resetAll() {
    await apiFetch('/api/v1/routing-preferences', { method: 'DELETE' })
    await load()
  }

  // Drag & drop handlers
  const onDragStart = (idx: number) => setDragIdx(idx)
  const onDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOver(idx) }
  const onDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDragOver(null); return }
    const newRows = [...rows]
    const [moved] = newRows.splice(dragIdx, 1)
    newRows.splice(targetIdx, 0, moved)
    setRows(newRows)
    setDragIdx(null)
    setDragOver(null)
    setSaved(false)
  }

  if (loading) return <div className="p-8 text-zinc-500 text-sm">Loading roundtable settings…</div>

  const hasCustomizations = rows.some((r) => r.userModel !== null)

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">My Roundtable</h1>
          <p className="text-zinc-400 text-sm">
            Customize which AI handles each category. Drag rows to reorder priority.
          </p>
        </div>
        <div className="flex gap-2 mt-1">
          {hasCustomizations && (
            <button
              onClick={resetAll}
              className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
            >
              Reset all
            </button>
          )}
          <button
            onClick={save}
            disabled={saving}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
              saved ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Custom AI</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-600" /> Arivarangam default</span>
        <span className="flex items-center gap-1">⠿ Drag to reorder</span>
      </div>

      {/* Routing table */}
      <div className="space-y-2">
        {rows.map((row, idx) => {
          const meta = CATEGORY_META[row.category] || { label: row.category, icon: '💬', description: '' }
          const isCustomized = row.userModel !== null
          const isDragging = dragIdx === idx
          const isDragTarget = dragOver === idx && dragIdx !== null && dragIdx !== idx

          return (
            <div
              key={row.category}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={(e) => onDrop(e, idx)}
              onDragEnd={() => { setDragIdx(null); setDragOver(null) }}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                isDragTarget
                  ? 'border-indigo-500/50 bg-indigo-500/5 scale-[1.01]'
                  : isDragging
                  ? 'border-zinc-600 bg-zinc-900/30 opacity-50'
                  : isCustomized
                  ? 'border-indigo-500/20 bg-indigo-500/5'
                  : 'border-zinc-800 bg-zinc-900/40'
              }`}
            >
              {/* Drag handle */}
              <span className="text-zinc-700 select-none text-sm">⠿</span>

              {/* Category info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span>{meta.icon}</span>
                  <span className="text-sm font-medium text-zinc-200">{meta.label}</span>
                  {isCustomized && <span className="text-xs text-indigo-400">customized</span>}
                </div>
                <p className="text-xs text-zinc-600 mt-0.5 ml-6">{meta.description}</p>
              </div>

              {/* Model selector */}
              <select
                value={row.userModel || '__default__'}
                onChange={(e) => updateModel(idx, e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors min-w-[160px]"
              >
                <option value="__default__">⚡ Default ({row.defaultModel})</option>
                <optgroup label="── Choose AI ──">
                  {ALL_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )
        })}
      </div>

      <div className="mt-6 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800">
        <p className="text-xs text-zinc-600 leading-relaxed">
          Changes apply to all future tasks. Connect your own AI keys in{' '}
          <a href="/settings/ai-connections" className="text-indigo-400 hover:underline">AI Connections</a>{' '}
          to use them for free on your own quota. Arivarangam defaults are always available as fallback.
        </p>
      </div>
    </div>
  )
}
