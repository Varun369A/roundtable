'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemoryEntry {
  key: string
  value: string
  category: string
  source: 'USER' | 'INFERRED' | 'ONBOARDING'
  confidence?: number
}

interface InferredFact {
  id: string
  fact: string
  confidence: number
  createdAt: string
}

type Category = 'Business' | 'Audience' | 'Preferences' | 'Technical' | 'Brand' | 'Personal'
const CATEGORIES: Category[] = ['Business', 'Audience', 'Preferences', 'Technical', 'Brand', 'Personal']

function toTitleCase(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function sourceBadge(source: MemoryEntry['source']) {
  const map: Record<string, { label: string; classes: string }> = {
    USER:        { label: 'User set',   classes: 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20' },
    INFERRED:    { label: 'Inferred',   classes: 'text-amber-400 bg-amber-500/10 border border-amber-500/20'   },
    ONBOARDING:  { label: 'Onboarding', classes: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' },
  }
  const cfg = map[source] || map.USER
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}

function confidenceColor(c: number) {
  if (c >= 0.8) return 'bg-emerald-500'
  if (c >= 0.5) return 'bg-amber-500'
  return 'bg-red-500'
}

// ─── Onboarding Panel ─────────────────────────────────────────────────────────

function OnboardingPanel({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    businessName: '',
    businessType: '',
    primaryAudience: '',
    writingTone: '',
    mainUseCase: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch('/api/v1/memory/onboarding', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      if (!res.success) {
        setError(res.error?.message || 'Failed to save. Please try again.')
        return
      }
      onSaved()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const fields: { key: keyof typeof form; label: string; placeholder: string }[] = [
    { key: 'businessName',    label: 'Business Name',     placeholder: 'e.g. Chai Brews Co.' },
    { key: 'businessType',    label: 'Business Type',     placeholder: 'e.g. D2C beverage brand' },
    { key: 'primaryAudience', label: 'Primary Audience',  placeholder: 'e.g. College students aged 18-25' },
    { key: 'writingTone',     label: 'Writing Tone',      placeholder: 'e.g. Casual and friendly' },
    { key: 'mainUseCase',     label: 'Main Use Case',     placeholder: 'e.g. Marketing copy and campaign ideas' },
  ]

  return (
    <div className="bg-zinc-900 border border-indigo-500/20 rounded-2xl p-6 mb-8">
      <div className="flex items-start gap-3 mb-5">
        <span className="text-2xl">🚀</span>
        <div>
          <h3 className="text-sm font-semibold text-white">Quick setup — train Sabha in 30 seconds</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Provide a few details about your business so Sabha can personalise every output from day one.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">{f.label}</label>
              <input
                type="text"
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-lg text-sm text-white placeholder-zinc-600 outline-none transition-colors"
              />
            </div>
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors"
        >
          {saving ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            'Train Sabha →'
          )}
        </button>
      </form>
    </div>
  )
}

// ─── Memory Entry Row ─────────────────────────────────────────────────────────

function MemoryEntryRow({ entry, onDelete, onUpdate }: {
  entry: MemoryEntry
  onDelete: (key: string) => void
  onUpdate: (key: string, value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(entry.value)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    if (editValue === entry.value) { setEditing(false); return }
    setSaving(true)
    try {
      const res = await apiFetch(`/api/v1/memory/${encodeURIComponent(entry.key)}`, {
        method: 'PUT',
        body: JSON.stringify({ value: editValue }),
      })
      if (res.success) {
        onUpdate(entry.key, editValue)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await apiFetch(`/api/v1/memory/${encodeURIComponent(entry.key)}`, { method: 'DELETE' })
      onDelete(entry.key)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="text-xs font-medium text-zinc-300">{toTitleCase(entry.key)}</span>
          {sourceBadge(entry.source)}
        </div>

        {editing ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              autoFocus
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') { setEditing(false); setEditValue(entry.value) }
              }}
              className="flex-1 px-3 py-1.5 bg-zinc-950 border border-indigo-500/50 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500/40"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-white transition-colors"
            >
              {saving ? '…' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditValue(entry.value) }}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <p
            onClick={() => setEditing(true)}
            className="text-sm text-zinc-400 cursor-pointer hover:text-zinc-200 transition-colors leading-relaxed"
            title="Click to edit"
          >
            {entry.value}
          </p>
        )}

        {/* Confidence bar for inferred */}
        {entry.source === 'INFERRED' && typeof entry.confidence === 'number' && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden max-w-24">
              <div
                className={`h-full rounded-full transition-all ${confidenceColor(entry.confidence)}`}
                style={{ width: `${Math.round(entry.confidence * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-600 tabular-nums">
              {Math.round(entry.confidence * 100)}% confidence
            </span>
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
        aria-label="Delete memory"
      >
        {deleting ? (
          <span className="w-3 h-3 border border-red-400/50 border-t-red-400 rounded-full animate-spin" />
        ) : (
          '×'
        )}
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [facts, setFacts] = useState<InferredFact[]>([])
  const [context, setContext] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadingContext, setLoadingContext] = useState(false)
  const [loadingFacts, setLoadingFacts] = useState(false)
  const [activeTab, setActiveTab] = useState<Category>('Business')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const fetchMemories = useCallback(async () => {
    setLoading(true)
    setGlobalError(null)
    try {
      const res = await apiFetch<{ memories: MemoryEntry[] }>('/api/v1/memory')
      if (res.success && res.data) {
        setMemories(res.data.memories || [])
      } else {
        setGlobalError(res.error?.message || 'Failed to load memories.')
      }
    } catch {
      setGlobalError('Network error loading memories.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchContext = useCallback(async () => {
    setLoadingContext(true)
    try {
      const res = await apiFetch<{ context: string }>('/api/v1/memory/context')
      if (res.success && res.data) setContext(res.data.context || '')
    } finally {
      setLoadingContext(false)
    }
  }, [])

  const fetchFacts = useCallback(async () => {
    setLoadingFacts(true)
    try {
      const res = await apiFetch<{ facts: InferredFact[] }>('/api/v1/memory/facts')
      if (res.success && res.data) setFacts(res.data.facts || [])
    } finally {
      setLoadingFacts(false)
    }
  }, [])

  useEffect(() => {
    fetchMemories()
    fetchContext()
    fetchFacts()
  }, [fetchMemories, fetchContext, fetchFacts])

  function handleDelete(key: string) {
    setMemories((prev) => prev.filter((m) => m.key !== key))
  }

  function handleUpdate(key: string, value: string) {
    setMemories((prev) => prev.map((m) => (m.key === key ? { ...m, value } : m)))
  }

  async function handleResetAll() {
    setResetting(true)
    setResetError(null)
    try {
      const res = await apiFetch('/api/v1/memory', { method: 'DELETE' })
      if (!res.success) {
        setResetError(res.error?.message || 'Failed to reset memories.')
        return
      }
      setMemories([])
      setFacts([])
      setContext('')
      setShowResetConfirm(false)
    } catch {
      setResetError('Network error — please try again.')
    } finally {
      setResetting(false)
    }
  }

  // Filter by active category
  const tabMemories = memories.filter(
    (m) => m.category?.toLowerCase() === activeTab.toLowerCase(),
  )

  const showOnboarding = memories.length < 3

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* ── Hero card ──────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-indigo-500/20 rounded-2xl p-6 mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Sabha's Memory</h1>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
            Sabha remembers your business context and preferences across all tasks.
            The more it knows, the better every output becomes.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm">
            <span className="text-zinc-500">
              <span className="text-white font-semibold">{memories.length}</span> memories stored
            </span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-500">
              <span className="text-white font-semibold">{facts.length}</span> inferred facts
            </span>
          </div>
        </div>

        {globalError && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {globalError}
          </div>
        )}

        {/* ── Onboarding panel ───────────────────────────────────────────────── */}
        {showOnboarding && !loading && (
          <OnboardingPanel onSaved={fetchMemories} />
        )}

        {/* ── Memory by category ─────────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-8">
          {/* Tab nav */}
          <div className="flex overflow-x-auto border-b border-zinc-800 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const count = memories.filter(
                (m) => m.category?.toLowerCase() === cat.toLowerCase(),
              ).length
              return (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === cat
                      ? 'text-white border-b-2 border-indigo-500 bg-zinc-800/50'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {cat}
                  {count > 0 && (
                    <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full tabular-nums">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="p-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-zinc-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : tabMemories.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-zinc-600 text-sm">No {activeTab} memories yet</p>
                <p className="text-zinc-700 text-xs mt-1">
                  Sabha will learn from your tasks automatically
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tabMemories.map((entry) => (
                  <MemoryEntryRow
                    key={entry.key}
                    entry={entry}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── What Sabha Knows preview ────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-8">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-semibold text-white">What Sabha Knows About You</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                This context is injected into every AI prompt
              </p>
            </div>
            <button
              onClick={fetchContext}
              disabled={loadingContext}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-zinc-300 transition-colors"
            >
              {loadingContext ? (
                <span className="w-3 h-3 border border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Refresh
            </button>
          </div>
          <div className="p-5">
            {loadingContext ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-4 bg-zinc-800 rounded animate-pulse" style={{ width: `${60 + (i * 13) % 35}%` }} />
                ))}
              </div>
            ) : context ? (
              <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
                {context}
              </pre>
            ) : (
              <p className="text-zinc-600 text-sm text-center py-6">
                No context generated yet — add memories above
              </p>
            )}
          </div>
        </div>

        {/* ── Inferred Facts ──────────────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-white">Inferred Facts</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Observations Sabha auto-detected from your tasks
            </p>
          </div>
          <div className="p-4">
            {loadingFacts ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-zinc-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : facts.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-zinc-600 text-sm">No inferred facts yet</p>
                <p className="text-zinc-700 text-xs mt-1">Run a few tasks and Sabha will start learning patterns</p>
              </div>
            ) : (
              <div className="space-y-2">
                {facts.map((f) => {
                  const color = f.confidence >= 0.8 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : f.confidence >= 0.5 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    : 'text-red-400 bg-red-500/10 border-red-500/20'
                  return (
                    <div key={f.id} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                      <p className="flex-1 text-sm text-zinc-300 leading-relaxed">{f.fact}</p>
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
                        {Math.round(f.confidence * 100)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Danger zone ─────────────────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-red-500/20 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
          </div>
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Reset all memories</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Permanently delete all stored context, preferences, and inferred facts.
                This cannot be undone.
              </p>
            </div>

            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="shrink-0 px-4 py-2 text-sm font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                Reset all
              </button>
            ) : (
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-xs text-zinc-400">Are you sure?</span>
                <button
                  onClick={handleResetAll}
                  disabled={resetting}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {resetting && (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {resetting ? 'Deleting…' : 'Yes, delete all'}
                </button>
                <button
                  onClick={() => { setShowResetConfirm(false); setResetError(null) }}
                  disabled={resetting}
                  className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          {resetError && (
            <div className="px-5 pb-4">
              <p className="text-xs text-red-400">{resetError}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
