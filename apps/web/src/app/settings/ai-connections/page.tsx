'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

interface Provider {
  key: string
  displayName: string
  icon: string
  description: string
  apiKeyLabel: string
  apiKeyHint: string
  docsUrl: string
  models: string[]
  categories: string[]
  color: string
  connected: boolean
  verified: boolean
  lastUsedAt?: string
  connectedAt?: string
}

const COLOR_MAP: Record<string, string> = {
  orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
  green:  'bg-green-500/10 border-green-500/20 text-green-400',
  blue:   'bg-blue-500/10 border-blue-500/20 text-blue-400',
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  pink:   'bg-pink-500/10 border-pink-500/20 text-pink-400',
  cyan:   'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
  teal:   'bg-teal-500/10 border-teal-500/20 text-teal-400',
  red:    'bg-red-500/10 border-red-500/20 text-red-400',
}

export default function AIConnectionsPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading]     = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null) // provider key being connected
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)

  async function load() {
    const res = await apiFetch<{ data: { providers: Provider[] } }>('/api/v1/ai-connections')
    if (res.success && res.data) setProviders((res.data as any).data.providers)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function connect(provider: Provider) {
    if (!apiKeyInput.trim()) { setError('Please enter your API key'); return }
    setSaving(true)
    setError('')
    const res = await apiFetch('/api/v1/ai-connections', {
      method: 'POST',
      body: JSON.stringify({ provider: provider.key, apiKey: apiKeyInput.trim() }),
    })
    if (res.success) {
      setApiKeyInput('')
      setConnecting(null)
      await load()
    } else {
      setError((res.error as any)?.message || 'Connection failed')
    }
    setSaving(false)
  }

  async function disconnect(providerKey: string) {
    await apiFetch(`/api/v1/ai-connections/${providerKey}`, { method: 'DELETE' })
    await load()
  }

  if (loading) return <div className="p-8 text-zinc-500 text-sm">Loading AI connections…</div>

  const connected = providers.filter((p) => p.connected)
  const available = providers.filter((p) => !p.connected)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">AI Connections</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Connect your own AI provider accounts. When you use your own API key, those AI tasks run on
          <strong className="text-zinc-200"> your quota — free of Sabha credits</strong>. Sabha's defaults are
          used for any provider you haven't connected.
        </p>
      </div>

      {/* Connected providers */}
      {connected.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Connected ({connected.length})</h2>
          <div className="space-y-3">
            {connected.map((p) => (
              <div key={p.key} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{p.displayName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${p.verified ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'}`}>
                        {p.verified ? '✓ Verified' : '! Needs verification'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Unlocks: {p.models.join(', ')}
                      {p.connectedAt && ` · Connected ${new Date(p.connectedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600 font-mono">🔑 Your key</span>
                  <button
                    onClick={() => disconnect(p.key)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sabha defaults info */}
      <div className="mb-6 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
        <div className="flex items-start gap-3">
          <span className="text-lg mt-0.5">⚡</span>
          <div>
            <p className="text-sm font-medium text-zinc-300">Sabha Defaults (always available)</p>
            <p className="text-xs text-zinc-500 mt-1">
              All AI models work out of the box using Sabha's API keys — deducted from your plan credits.
              Connect your own keys above to use them for free on your quota.
            </p>
          </div>
        </div>
      </div>

      {/* Available to connect */}
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Available to Connect ({available.length})
        </h2>
        <div className="space-y-3">
          {available.map((p) => {
            const isExpanded = connecting === p.key
            const colorClass = COLOR_MAP[p.color] || COLOR_MAP.blue

            return (
              <div key={p.key} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.icon}</span>
                    <div>
                      <span className="text-sm font-medium text-white">{p.displayName}</span>
                      <p className="text-xs text-zinc-500 mt-0.5">{p.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={p.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      Get key ↗
                    </a>
                    <button
                      onClick={() => {
                        setConnecting(isExpanded ? null : p.key)
                        setApiKeyInput('')
                        setError('')
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        isExpanded
                          ? 'bg-zinc-700 text-zinc-300'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {isExpanded ? 'Cancel' : 'Connect'}
                    </button>
                  </div>
                </div>

                {/* Expand on connect */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-zinc-800 pt-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">{p.apiKeyLabel}</label>
                          <input
                            type="password"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && connect(p)}
                            placeholder={p.apiKeyHint}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                            autoFocus
                          />
                        </div>
                        {error && <p className="text-red-400 text-xs">{error}</p>}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => connect(p)}
                            disabled={saving || !apiKeyInput.trim()}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            {saving ? 'Verifying…' : 'Verify & Connect'}
                          </button>
                          <p className="text-xs text-zinc-600">
                            Key is encrypted and verified before saving
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-8 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800">
        <p className="text-xs text-zinc-600 leading-relaxed">
          🔒 API keys are encrypted with AES-256-GCM and verified with a minimal test call before saving.
          They are never logged, displayed, or shared. Only used to execute AI tasks you trigger.
          You can disconnect at any time.
        </p>
      </div>
    </div>
  )
}
