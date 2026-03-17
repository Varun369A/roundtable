'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

// ── Provider configs ────────────────────────────────────────────────────────

type ProviderKey = 'GITHUB' | 'GMAIL' | 'NOTION' | 'SLACK' | 'LINEAR' | 'JIRA'

interface ProviderConfig {
  name: string
  icon: string
  color: string
  description: string
  tokenInstructions: string
  tokenLabel: string
  defaultScopes: string[]
  availableScopes: string[]
}

const PROVIDERS: Record<ProviderKey, ProviderConfig> = {
  GITHUB: {
    name: 'GitHub',
    icon: '🐙',
    color: 'from-gray-800 to-gray-900',
    description: 'Push code, create PRs and issues',
    tokenInstructions: 'Create a Personal Access Token at github.com/settings/tokens/new with scopes: repo, workflow',
    tokenLabel: 'Personal Access Token',
    defaultScopes: ['repo', 'workflow'],
    availableScopes: ['repo', 'workflow', 'issues', 'pull_request'],
  },
  GMAIL: {
    name: 'Gmail',
    icon: '✉️',
    color: 'from-red-500 to-red-700',
    description: 'Send emails and manage drafts',
    tokenInstructions: 'Use OAuth — click Connect to authorize Sabha with your Google account',
    tokenLabel: 'OAuth Token (auto-generated)',
    defaultScopes: ['gmail.send', 'gmail.compose'],
    availableScopes: ['gmail.send', 'gmail.compose', 'gmail.readonly'],
  },
  NOTION: {
    name: 'Notion',
    icon: '📝',
    color: 'from-gray-100 to-gray-200',
    description: 'Create pages and database entries',
    tokenInstructions: 'Create an Internal Integration at notion.so/my-integrations and copy the secret',
    tokenLabel: 'Integration Secret',
    defaultScopes: ['pages.write', 'databases.write'],
    availableScopes: ['pages.write', 'pages.read', 'databases.write', 'databases.read'],
  },
  SLACK: {
    name: 'Slack',
    icon: '💬',
    color: 'from-purple-500 to-purple-700',
    description: 'Post messages to channels',
    tokenInstructions: 'Create a Slack App at api.slack.com/apps and copy the Bot User OAuth Token',
    tokenLabel: 'Bot OAuth Token',
    defaultScopes: ['chat:write', 'channels:join'],
    availableScopes: ['chat:write', 'channels:join', 'files:write'],
  },
  LINEAR: {
    name: 'Linear',
    icon: '📐',
    color: 'from-indigo-500 to-indigo-700',
    description: 'Create and update issues and cycles',
    tokenInstructions: 'Generate a Personal API Key at linear.app/settings/api',
    tokenLabel: 'Personal API Key',
    defaultScopes: ['issues:write', 'cycles:write'],
    availableScopes: ['issues:write', 'issues:read', 'cycles:write', 'projects:write'],
  },
  JIRA: {
    name: 'Jira',
    icon: '🔵',
    color: 'from-blue-600 to-blue-800',
    description: 'Create tickets and update sprints',
    tokenInstructions: 'Generate an API token at id.atlassian.com/manage-profile/security/api-tokens',
    tokenLabel: 'API Token',
    defaultScopes: ['issues:write', 'sprints:write'],
    availableScopes: ['issues:write', 'issues:read', 'sprints:write', 'projects:read'],
  },
}

// ── Types ───────────────────────────────────────────────────────────────────

interface Integration {
  id: string
  provider: ProviderKey
  displayName: string
  isActive: boolean
  scopes: string[]
  lastUsedAt?: string
  createdAt: string
}

// ── Connect Modal ───────────────────────────────────────────────────────────

interface ConnectModalProps {
  providerKey: ProviderKey
  onClose: () => void
  onConnected: () => void
}

function ConnectModal({ providerKey, onClose, onConnected }: ConnectModalProps) {
  const config = PROVIDERS[providerKey]
  const [displayName, setDisplayName] = useState(config.name)
  const [token, setToken]             = useState('')
  const [scopes, setScopes]           = useState<string[]>(config.defaultScopes)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  async function handleConnect() {
    if (!token.trim()) { setError('Please enter the token'); return }
    setSaving(true)
    setError(null)
    const res = await apiFetch('/api/v1/integrations', {
      method: 'POST',
      body: JSON.stringify({
        provider: providerKey,
        displayName: displayName.trim() || config.name,
        token: token.trim(),
        scopes,
      }),
    })
    if (res.success) {
      onConnected()
    } else {
      setError((res.error as any)?.message || 'Connection failed. Check your token and try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60"
        role="dialog"
        aria-modal="true"
        aria-label={`Connect ${config.name}`}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 p-5 rounded-t-2xl bg-gradient-to-r ${config.color}`}>
          <span className="text-3xl">{config.icon}</span>
          <div>
            <h2 className="text-base font-bold text-white drop-shadow">Connect {config.name}</h2>
            <p className="text-xs text-white/70">{config.description}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-white/60 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Instructions */}
          <div className="px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 leading-relaxed">
            {config.tokenInstructions}
          </div>

          {/* Display name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder={config.name}
            />
          </div>

          {/* Token */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">{config.tokenLabel}</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Paste token here…"
              autoFocus
            />
          </div>

          {/* Scopes */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Permissions</label>
            <div className="flex flex-wrap gap-1.5">
              {config.availableScopes.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border ${
                    scopes.includes(scope)
                      ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {scopes.includes(scope) ? '✓ ' : ''}{scope}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleConnect}
              disabled={saving || !token.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting…
                </span>
              ) : (
                `Connect ${config.name}`
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>

          <p className="text-[10px] text-zinc-600 text-center">
            🔒 Token is encrypted with AES-256-GCM and never displayed again.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Disconnect confirmation ─────────────────────────────────────────────────

interface DisconnectDialogProps {
  integration: Integration
  onClose: () => void
  onDisconnected: () => void
}

function DisconnectDialog({ integration, onClose, onDisconnected }: DisconnectDialogProps) {
  const config = PROVIDERS[integration.provider]
  const [loading, setLoading] = useState(false)

  async function handleDisconnect() {
    setLoading(true)
    await apiFetch(`/api/v1/integrations/${integration.id}`, { method: 'DELETE' })
    onDisconnected()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <h2 className="text-base font-bold text-white">Disconnect {config.name}?</h2>
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed">
          This will remove the <span className="text-zinc-200 font-medium">{integration.displayName}</span> integration.
          Sabha will no longer be able to execute {config.name} actions.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Disconnecting…' : 'Yes, disconnect'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading]           = useState(true)
  const [connectingProvider, setConnectingProvider] = useState<ProviderKey | null>(null)
  const [disconnectTarget, setDisconnectTarget]     = useState<Integration | null>(null)
  const [togglingId, setTogglingId]     = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)

  async function load() {
    const res = await apiFetch<{ integrations: Integration[] }>('/api/v1/integrations')
    if (res.success && res.data) {
      setIntegrations(res.data.integrations)
    } else if (!res.success) {
      setError('Failed to load integrations.')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleActive(integration: Integration) {
    setTogglingId(integration.id)
    await apiFetch(`/api/v1/integrations/${integration.id}/activate`, {
      method: 'PUT',
      body: JSON.stringify({ isActive: !integration.isActive }),
    })
    setTogglingId(null)
    await load()
  }

  function getIntegration(providerKey: ProviderKey): Integration | undefined {
    return integrations.find((i) => i.provider === providerKey)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-zinc-500 text-sm">
        <span className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
        Loading integrations…
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Integrations</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Connect external tools to let Sabha take real-world actions — push code to GitHub, send emails,
          create Notion pages, and more.
        </p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {(Object.keys(PROVIDERS) as ProviderKey[]).map((providerKey) => {
          const config      = PROVIDERS[providerKey]
          const integration = getIntegration(providerKey)
          const isConnected = !!integration
          const isActive    = integration?.isActive ?? false
          const isToggling  = togglingId === integration?.id

          return (
            <div
              key={providerKey}
              className={`rounded-2xl border overflow-hidden transition-colors ${
                isConnected
                  ? 'border-zinc-700 bg-zinc-900/70'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
              }`}
            >
              {/* Gradient header strip */}
              <div className={`h-1.5 w-full bg-gradient-to-r ${config.color}`} />

              <div className="p-4 space-y-3">
                {/* Provider header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl leading-none">{config.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{config.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{config.description}</p>
                    </div>
                  </div>
                  {/* Active toggle (only when connected) */}
                  {isConnected && (
                    <button
                      onClick={() => toggleActive(integration!)}
                      disabled={isToggling}
                      title={isActive ? 'Disable integration' : 'Enable integration'}
                      className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                        isActive ? 'bg-indigo-600' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                          isActive ? 'translate-x-4' : 'translate-x-0'
                        } ${isToggling ? 'opacity-60' : ''}`}
                      />
                    </button>
                  )}
                </div>

                {/* Connected details */}
                {isConnected && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isActive
                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                            : 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
                        }`}
                      >
                        {isActive ? '✓ Active' : '— Inactive'}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">{integration!.displayName}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {integration!.scopes.map((s) => (
                        <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50">
                          {s}
                        </span>
                      ))}
                    </div>
                    {integration!.lastUsedAt && (
                      <p className="text-[10px] text-zinc-600">
                        Last used {new Date(integration!.lastUsedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <button
                      onClick={() => setDisconnectTarget(integration!)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => setConnectingProvider(providerKey)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800">
        <p className="text-xs text-zinc-600 leading-relaxed">
          🔒 Tokens are encrypted with AES-256-GCM. Sabha will only execute actions that are explicitly
          queued by AI tasks you create. Actions require your approval before execution.
        </p>
      </div>

      {/* Modals */}
      {connectingProvider && (
        <ConnectModal
          providerKey={connectingProvider}
          onClose={() => setConnectingProvider(null)}
          onConnected={async () => {
            setConnectingProvider(null)
            await load()
          }}
        />
      )}
      {disconnectTarget && (
        <DisconnectDialog
          integration={disconnectTarget}
          onClose={() => setDisconnectTarget(null)}
          onDisconnected={async () => {
            setDisconnectTarget(null)
            await load()
          }}
        />
      )}
    </div>
  )
}
