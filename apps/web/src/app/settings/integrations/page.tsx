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
    tokenInstructions: 'Use OAuth — click Connect to authorize Arivarangam with your Google account',
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
      setSaving(false)
      onConnected()
    } else {
      setError((res.error as any)?.message || 'Connection failed. Check your token and try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/60"
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
          <div className="px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700 leading-relaxed">
            {config.tokenInstructions}
          </div>

          {/* Display name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              placeholder={config.name}
            />
          </div>

          {/* Token */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">{config.tokenLabel}</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              placeholder="Paste token here…"
              autoFocus
            />
          </div>

          {/* Scopes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Permissions</label>
            <div className="flex flex-wrap gap-1.5">
              {config.availableScopes.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border ${
                    scopes.includes(scope)
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-slate-100 border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  {scopes.includes(scope) ? '✓ ' : ''}{scope}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
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
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/60 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <h2 className="text-base font-bold text-slate-900">Disconnect {config.name}?</h2>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          This will remove the <span className="text-slate-800 font-medium">{integration.displayName}</span> integration.
          Arivarangam will no longer be able to execute {config.name} actions.
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
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm transition-colors"
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
      <div className="p-8 flex items-center gap-3 text-slate-500 text-sm">
        <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
        Loading integrations…
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Integrations</h1>
        <p className="text-slate-500 text-sm leading-relaxed">
          Connect external tools to let Arivarangam take real-world actions — push code to GitHub, send emails,
          create Notion pages, and more.
        </p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
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
                  ? 'border-slate-300 bg-white'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
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
                      <p className="text-sm font-semibold text-slate-900">{config.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{config.description}</p>
                    </div>
                  </div>
                  {/* Active toggle (only when connected) */}
                  {isConnected && (
                    <button
                      onClick={() => toggleActive(integration!)}
                      disabled={isToggling}
                      title={isActive ? 'Disable integration' : 'Enable integration'}
                      className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                        isActive ? 'bg-indigo-600' : 'bg-slate-300'
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
                            ? 'bg-green-50 border-green-200 text-green-600'
                            : 'bg-slate-100 border-slate-200 text-slate-500'
                        }`}
                      >
                        {isActive ? '✓ Active' : '— Inactive'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{integration!.displayName}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {integration!.scopes.map((s) => (
                        <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          {s}
                        </span>
                      ))}
                    </div>
                    {integration!.lastUsedAt && (
                      <p className="text-[10px] text-slate-400">
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
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-500 transition-colors"
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

      <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <p className="text-xs text-slate-500 leading-relaxed">
          🔒 Tokens are encrypted with AES-256-GCM. Arivarangam will only execute actions that are explicitly
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
