'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateAgent {
  model: string
  role: string
  instruction: string
  dependsOnPrevious: boolean
  optional?: boolean
}

interface Template {
  id: string
  name: string
  description: string
  category: string
  subcategory?: string
  icon: string
  color: string
  tags: string[]
  examplePrompts: string[]
  useCount: number
  isBuiltIn: boolean
  agents: TemplateAgent[]
}

interface Category {
  id: string
  label: string
  icon: string
  description: string
  templateCount: number
}

// ─── Color map ────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  text: 'text-indigo-400',  badge: 'bg-indigo-500/20 text-indigo-300' },
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    text: 'text-blue-400',    badge: 'bg-blue-500/20 text-blue-300' },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  text: 'text-violet-400',  badge: 'bg-violet-500/20 text-violet-300' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  pink:    { bg: 'bg-pink-500/10',    border: 'border-pink-500/20',    text: 'text-pink-400',    badge: 'bg-pink-500/20 text-pink-300' },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  text: 'text-purple-400',  badge: 'bg-purple-500/20 text-purple-300' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400',   badge: 'bg-amber-500/20 text-amber-300' },
  teal:    { bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    text: 'text-teal-400',    badge: 'bg-teal-500/20 text-teal-300' },
  orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  text: 'text-orange-400',  badge: 'bg-orange-500/20 text-orange-300' },
  cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    text: 'text-cyan-400',    badge: 'bg-cyan-500/20 text-cyan-300' },
  slate:   { bg: 'bg-slate-500/10',   border: 'border-slate-500/20',   text: 'text-slate-400',   badge: 'bg-slate-500/20 text-slate-300' },
  red:     { bg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-400',     badge: 'bg-red-500/20 text-red-300' },
  rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    text: 'text-rose-400',    badge: 'bg-rose-500/20 text-rose-300' },
  fuchsia: { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20', text: 'text-fuchsia-400', badge: 'bg-fuchsia-500/20 text-fuchsia-300' },
  green:   { bg: 'bg-green-500/10',   border: 'border-green-500/20',   text: 'text-green-400',   badge: 'bg-green-500/20 text-green-300' },
  zinc:    { bg: 'bg-zinc-500/10',    border: 'border-zinc-500/20',    text: 'text-zinc-400',    badge: 'bg-zinc-500/20 text-zinc-300' },
  lime:    { bg: 'bg-lime-500/10',    border: 'border-lime-500/20',    text: 'text-lime-400',    badge: 'bg-lime-500/20 text-lime-300' },
}

function getColor(color: string) {
  return COLOR_MAP[color] || COLOR_MAP.indigo
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template, onSelect }: { template: Template; onSelect: (t: Template) => void }) {
  const c = getColor(template.color)
  return (
    <div
      className={`group relative rounded-2xl border ${c.border} ${c.bg} p-5 cursor-pointer hover:scale-[1.02] transition-all duration-200 hover:shadow-lg hover:shadow-black/20`}
      onClick={() => onSelect(template)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{template.icon}</span>
          <div>
            <h3 className="font-semibold text-white text-sm leading-tight">{template.name}</h3>
            {template.isBuiltIn && (
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Built-in</span>
            )}
          </div>
        </div>
        <div className="text-xs text-zinc-500">{template.useCount.toLocaleString()} uses</div>
      </div>

      {/* Description */}
      <p className="text-xs text-zinc-400 mb-3 line-clamp-2 leading-relaxed">{template.description}</p>

      {/* Agent pipeline preview */}
      <div className="flex items-center gap-1 mb-3 overflow-hidden">
        {template.agents.slice(0, 5).map((agent, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-zinc-700 text-[10px]">→</span>}
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.badge} font-medium whitespace-nowrap`}>
              {agent.role.split(' ')[0]}
            </span>
          </div>
        ))}
        {template.agents.length > 5 && (
          <span className="text-zinc-600 text-[10px]">+{template.agents.length - 5}</span>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {template.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-[10px] text-zinc-600 bg-white/5 px-1.5 py-0.5 rounded">
            {tag}
          </span>
        ))}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/[0.02] transition-colors pointer-events-none" />
    </div>
  )
}

// ─── Use Template Modal ───────────────────────────────────────────────────────

function UseTemplateModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const router = useRouter()
  const [goal, setGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleUse = async () => {
    if (!goal.trim() || goal.trim().length < 10) {
      setError('Please describe your goal (at least 10 characters)')
      return
    }
    setLoading(true)
    try {
      const data = await apiFetch('/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({ goal: goal.trim(), templateId: template.id }),
      })
      if (data.success) {
        router.push(`/roundtable/${(data.data as any).task.id}`)
      } else {
        setError(data.error?.message || 'Failed to create task')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const c = getColor(template.color)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className={`${c.bg} border-b ${c.border} rounded-t-2xl p-6`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{template.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-white">{template.name}</h2>
              <p className="text-xs text-zinc-400">{template.agents.length} AI agents</p>
            </div>
          </div>
          {/* Pipeline */}
          <div className="flex items-center gap-1 flex-wrap mt-3">
            {template.agents.map((agent, i) => (
              <div key={i} className="flex items-center gap-1">
                {i > 0 && <span className={`text-xs ${c.text}`}>→</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.badge} font-medium`}>
                  {agent.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <label className="text-sm text-zinc-400 block mb-2">
            What do you want to build or create?
          </label>
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-white/20 transition-colors"
            rows={4}
            placeholder={template.examplePrompts[0] || `Describe your ${template.name.toLowerCase()} goal...`}
            value={goal}
            onChange={(e) => { setGoal(e.target.value); setError('') }}
          />

          {/* Example prompts */}
          <div className="mt-3 mb-4">
            <p className="text-xs text-zinc-600 mb-2">Examples:</p>
            <div className="flex flex-wrap gap-1.5">
              {template.examplePrompts.slice(0, 3).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setGoal(prompt)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-full transition-colors text-left"
                >
                  {prompt.length > 45 ? prompt.slice(0, 45) + '…' : prompt}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUse}
              disabled={loading || !goal.trim()}
              className={`flex-1 py-2.5 text-sm rounded-xl font-semibold text-white transition-all ${
                loading || !goal.trim()
                  ? 'opacity-40 cursor-not-allowed bg-indigo-600'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'
              }`}
            >
              {loading ? 'Starting Roundtable…' : 'Start Roundtable →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTemplates = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (activeCategory !== 'all') params.set('category', activeCategory)
      if (search) params.set('search', search)

      const [catData, tplData] = await Promise.all([
        apiFetch('/api/v1/templates/categories'),
        apiFetch(`/api/v1/templates?${params}`),
      ])
      if (catData.success) setCategories(catData.data as any)
      if (tplData.success) setTemplates(tplData.data as any)
    } finally {
      setLoading(false)
    }
  }, [activeCategory, search])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Category counts
  const totalCount = categories.reduce((s, c) => s + c.templateCount, 0)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/5 sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-400 transition-colors text-sm">← Dashboard</Link>
            <div>
              <h1 className="text-lg font-bold">Roundtable Templates</h1>
              <p className="text-xs text-zinc-500">Pre-built AI teams for every use case</p>
            </div>
          </div>
          <input
            type="text"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 w-56"
          />
        </div>

        {/* Category tabs */}
        <div className="max-w-7xl mx-auto px-6 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-white text-black'
                : 'text-zinc-500 hover:text-zinc-300 bg-white/5'
            }`}
          >
            All ({totalCount})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-white text-black'
                  : 'text-zinc-500 hover:text-zinc-300 bg-white/5'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
              <span className="text-xs opacity-60">({cat.templateCount})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Category description */}
        {activeCategory !== 'all' && (
          <div className="mb-6">
            {categories.filter((c) => c.id === activeCategory).map((cat) => (
              <p key={cat.id} className="text-sm text-zinc-500">{cat.description}</p>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-600 text-4xl mb-3">🔍</p>
            <p className="text-zinc-400">No templates found</p>
            {search && (
              <button onClick={() => setSearch('')} className="mt-2 text-sm text-indigo-400 hover:text-indigo-300">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {templates.map((t) => (
              <TemplateCard key={t.id} template={t} onSelect={setSelected} />
            ))}
          </div>
        )}

        {/* Custom template CTA */}
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-3xl mb-3">🛠️</p>
          <h3 className="text-base font-semibold text-white mb-1">Build a custom template</h3>
          <p className="text-sm text-zinc-500 mb-4">
            Pro+ users can create and save their own AI team configurations
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm text-white transition-colors"
          >
            Go to Dashboard →
          </Link>
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <UseTemplateModal template={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
