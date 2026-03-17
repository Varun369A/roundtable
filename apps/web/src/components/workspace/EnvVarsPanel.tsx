'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'

interface EnvVar {
  id: string
  name: string
  hint?: string
  createdAt: string
}

interface EnvVarsPanelProps {
  projectId: string
}

export function EnvVarsPanel({ projectId }: EnvVarsPanelProps) {
  const [vars, setVars]       = useState<EnvVar[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [form, setForm]       = useState({ name: '', value: '', hint: '' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function loadVars() {
    const res = await apiFetch<{ data: { vars: EnvVar[] } }>(`/api/v1/code-projects/${projectId}/env-vars`)
    if (res.success && res.data) setVars((res.data as any).data.vars)
    setLoading(false)
  }

  useEffect(() => { loadVars() }, [projectId])

  async function addVar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.value) { setError('Name and value are required'); return }
    setSaving(true)
    setError('')
    const res = await apiFetch(`/api/v1/code-projects/${projectId}/env-vars`, {
      method: 'POST',
      body: JSON.stringify({ name: form.name, value: form.value, hint: form.hint || undefined }),
    })
    if (res.success) {
      setForm({ name: '', value: '', hint: '' })
      setAdding(false)
      await loadVars()
    } else {
      setError((res.error as any)?.message || 'Failed to save')
    }
    setSaving(false)
  }

  async function deleteVar(id: string) {
    await apiFetch(`/api/v1/code-projects/${projectId}/env-vars/${id}`, { method: 'DELETE' })
    setVars((prev) => prev.filter((v) => v.id !== id))
  }

  async function downloadExample() {
    const token = localStorage.getItem('accessToken')
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const a = document.createElement('a')
    a.href = `${apiUrl}/api/v1/code-projects/${projectId}/env-vars/export?token=${encodeURIComponent(token || '')}`
    a.download = '.env.example'
    a.click()
  }

  if (loading) {
    return <div className="p-6 text-zinc-500 text-sm">Loading env vars…</div>
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Environment Variables</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Stored encrypted with AES-256-GCM. Values are never shown after saving.
          </p>
        </div>
        <div className="flex gap-2">
          {vars.length > 0 && (
            <button
              onClick={downloadExample}
              className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              ↓ .env.example
            </button>
          )}
          <button
            onClick={() => { setAdding(true); setError('') }}
            className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            + Add Variable
          </button>
        </div>
      </div>

      {/* Existing vars */}
      {vars.length === 0 && !adding && (
        <div className="text-center py-12 border border-zinc-800 rounded-xl">
          <p className="text-zinc-500 text-sm">No environment variables yet.</p>
          <p className="text-zinc-600 text-xs mt-1">
            Add API keys, database URLs, and other secrets your project needs.
          </p>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {vars.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800"
          >
            <div>
              <span className="font-mono text-sm text-zinc-200">{v.name}</span>
              {v.hint && <span className="text-xs text-zinc-500 ml-2">— {v.hint}</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-600 font-mono">••••••••</span>
              <button
                onClick={() => deleteVar(v.id)}
                className="text-zinc-600 hover:text-red-400 transition-colors text-sm"
                title="Remove variable"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <form
          onSubmit={addVar}
          className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3"
        >
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Variable Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="DATABASE_URL"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Value <span className="text-zinc-600">(encrypted immediately on save — never visible again)</span>
            </label>
            <input
              type="password"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="postgres://user:pass@host/db"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Hint <span className="text-zinc-600">(optional reminder, stored in plaintext)</span>
            </label>
            <input
              type="text"
              value={form.hint}
              onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
              placeholder="PostgreSQL connection string"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Variable'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setError('') }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
        <p className="text-xs text-zinc-600 leading-relaxed">
          🔒 Variables are encrypted with AES-256-GCM before storage. Use "↓ .env.example" to export a
          template file showing variable names (no values) that you can commit to your repository.
          Never commit actual secret values.
        </p>
      </div>
    </div>
  )
}
