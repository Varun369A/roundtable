'use client'

import { useState, useMemo } from 'react'
import { apiFetch } from '@/lib/api'

interface CodeFile {
  path: string
  content: string
  language: string
}

interface EnvSetupHelperProps {
  taskId: string
  files: CodeFile[]
}

interface Provider {
  name: string
  description: string
  url: string | null
  howTo: string
  category: 'ai' | 'database' | 'auth' | 'payment' | 'email' | 'storage' | 'other'
}

const ENV_PROVIDERS: Record<string, Provider> = {
  OPENAI_API_KEY:            { name: 'OpenAI',        description: 'AI text, image generation',       url: 'https://platform.openai.com/api-keys',                   howTo: 'Create account → API Keys → Create new secret key',      category: 'ai' },
  ANTHROPIC_API_KEY:         { name: 'Anthropic',     description: 'Claude AI',                       url: 'https://console.anthropic.com/settings/keys',            howTo: 'Console → API Keys → Create key',                        category: 'ai' },
  GEMINI_API_KEY:            { name: 'Google Gemini', description: 'Gemini AI',                       url: 'https://aistudio.google.com/app/apikey',                 howTo: 'AI Studio → Get API key → Create API key',              category: 'ai' },
  GROQ_API_KEY:              { name: 'Groq',          description: 'Fast AI inference',               url: 'https://console.groq.com/keys',                          howTo: 'Console → API Keys → Create API Key',                    category: 'ai' },
  DATABASE_URL:              { name: 'Database',      description: 'PostgreSQL connection string',    url: 'https://neon.tech',                                      howTo: 'Neon (free) → New project → Connection string → copy',   category: 'database' },
  POSTGRES_URL:              { name: 'PostgreSQL',    description: 'PostgreSQL connection string',    url: 'https://neon.tech',                                      howTo: 'Neon (free) → New project → Connection string',          category: 'database' },
  MONGODB_URI:               { name: 'MongoDB Atlas', description: 'MongoDB connection URI',          url: 'https://cloud.mongodb.com',                              howTo: 'New cluster → Connect → Drivers → copy URI',             category: 'database' },
  REDIS_URL:                 { name: 'Redis',         description: 'Redis connection URL',            url: 'https://upstash.com',                                    howTo: 'Upstash (free) → Create database → REST URL',            category: 'database' },
  SUPABASE_URL:              { name: 'Supabase',      description: 'Supabase project URL',            url: 'https://supabase.com/dashboard',                         howTo: 'New project → Settings → API → Project URL',             category: 'database' },
  SUPABASE_ANON_KEY:         { name: 'Supabase',      description: 'Supabase anonymous key',          url: 'https://supabase.com/dashboard',                         howTo: 'Settings → API → Project API keys → anon (public)',      category: 'database' },
  SUPABASE_SERVICE_ROLE_KEY: { name: 'Supabase',      description: 'Supabase service role key',       url: 'https://supabase.com/dashboard',                         howTo: 'Settings → API → Project API keys → service_role',       category: 'database' },
  JWT_SECRET:                { name: 'JWT Secret',    description: 'Auth token signing key',          url: null,                                                     howTo: 'Generate 64-char random string: openssl rand -base64 48', category: 'auth' },
  NEXTAUTH_SECRET:           { name: 'NextAuth',      description: 'NextAuth.js secret',              url: null,                                                     howTo: 'Run: openssl rand -base64 32',                           category: 'auth' },
  NEXTAUTH_URL:              { name: 'NextAuth',      description: 'App base URL for NextAuth',       url: null,                                                     howTo: 'Set to your app URL e.g. http://localhost:3000',          category: 'auth' },
  GITHUB_CLIENT_ID:          { name: 'GitHub OAuth',  description: 'GitHub login app ID',             url: 'https://github.com/settings/developers',                 howTo: 'Settings → Developer → OAuth Apps → New OAuth App',      category: 'auth' },
  GITHUB_CLIENT_SECRET:      { name: 'GitHub OAuth',  description: 'GitHub login app secret',        url: 'https://github.com/settings/developers',                 howTo: 'OAuth App → Generate a new client secret',               category: 'auth' },
  GOOGLE_CLIENT_ID:          { name: 'Google OAuth',  description: 'Google login client ID',          url: 'https://console.cloud.google.com/apis/credentials',      howTo: 'Credentials → Create → OAuth client ID → Web',           category: 'auth' },
  GOOGLE_CLIENT_SECRET:      { name: 'Google OAuth',  description: 'Google login client secret',     url: 'https://console.cloud.google.com/apis/credentials',      howTo: 'Same as above — copy the secret',                        category: 'auth' },
  STRIPE_SECRET_KEY:         { name: 'Stripe',        description: 'Stripe payments (server)',        url: 'https://dashboard.stripe.com/test/apikeys',              howTo: 'Developers → API keys → Secret key (use test key first)', category: 'payment' },
  STRIPE_PUBLISHABLE_KEY:    { name: 'Stripe',        description: 'Stripe payments (client)',        url: 'https://dashboard.stripe.com/test/apikeys',              howTo: 'Developers → API keys → Publishable key',                category: 'payment' },
  STRIPE_WEBHOOK_SECRET:     { name: 'Stripe',        description: 'Stripe webhook signing secret',   url: 'https://dashboard.stripe.com/test/webhooks',             howTo: 'Webhooks → Add endpoint → Signing secret',               category: 'payment' },
  RAZORPAY_KEY_ID:           { name: 'Razorpay',      description: 'Razorpay API key',               url: 'https://dashboard.razorpay.com/app/keys',                howTo: 'Account → API Keys → Generate test key',                 category: 'payment' },
  RAZORPAY_KEY_SECRET:       { name: 'Razorpay',      description: 'Razorpay API secret',            url: 'https://dashboard.razorpay.com/app/keys',                howTo: 'Account → API Keys → Key Secret',                        category: 'payment' },
  SENDGRID_API_KEY:          { name: 'SendGrid',      description: 'Email via SendGrid',              url: 'https://app.sendgrid.com/settings/api_keys',             howTo: 'Settings → API Keys → Create API Key → Full Access',     category: 'email' },
  RESEND_API_KEY:            { name: 'Resend',        description: 'Email via Resend',                url: 'https://resend.com/api-keys',                            howTo: 'API Keys → Create API Key',                              category: 'email' },
  SMTP_HOST:                 { name: 'SMTP',          description: 'Email server host',               url: null,                                                     howTo: 'e.g. smtp.gmail.com (Gmail), smtp.sendgrid.net',         category: 'email' },
  CLOUDINARY_CLOUD_NAME:     { name: 'Cloudinary',    description: 'Image hosting cloud name',        url: 'https://console.cloudinary.com',                         howTo: 'Dashboard → Product Environment → Cloud name',           category: 'storage' },
  CLOUDINARY_API_KEY:        { name: 'Cloudinary',    description: 'Cloudinary API key',              url: 'https://console.cloudinary.com',                         howTo: 'Dashboard → API Keys → Generate new',                    category: 'storage' },
  AWS_ACCESS_KEY_ID:         { name: 'AWS',           description: 'Amazon Web Services key ID',      url: 'https://console.aws.amazon.com/iam/home#/security_credentials', howTo: 'IAM → Security credentials → Create access key', category: 'storage' },
  AWS_SECRET_ACCESS_KEY:     { name: 'AWS',           description: 'Amazon Web Services secret',      url: 'https://console.aws.amazon.com/iam/home#/security_credentials', howTo: 'Created alongside the access key ID',           category: 'storage' },
  AWS_S3_BUCKET:             { name: 'AWS S3',        description: 'S3 bucket name',                  url: 'https://s3.console.aws.amazon.com',                      howTo: 'S3 → Create bucket → copy bucket name',                  category: 'storage' },
}

const CATEGORY_ICONS: Record<string, string> = {
  ai: '🤖', database: '🗄', auth: '🔐', payment: '💳', email: '📧', storage: '📦', other: '⚙',
}

function detectEnvVars(files: CodeFile[]): string[] {
  const vars = new Set<string>()
  const pattern = /process\.env(?:\.([A-Z][A-Z0-9_]+)|\[['"]([A-Z][A-Z0-9_]+)['"]\])/g

  for (const f of files) {
    for (const m of f.content.matchAll(pattern)) {
      const name = m[1] ?? m[2]
      if (name && name.length > 3) vars.add(name)
    }
  }

  // Also parse .env.example
  const envExample = files.find(f => f.path.endsWith('.env.example') || f.path === '.env.example')
  if (envExample) {
    for (const line of envExample.content.split('\n')) {
      const m = line.match(/^([A-Z][A-Z0-9_]+)=/)
      if (m) vars.add(m[1])
    }
  }

  return Array.from(vars)
}

export function EnvSetupHelper({ taskId, files }: EnvSetupHelperProps) {
  const detectedVars = useMemo(() => detectEnvVars(files), [files])
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState<string[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  const known   = detectedVars.filter(v => ENV_PROVIDERS[v])
  const unknown = detectedVars.filter(v => !ENV_PROVIDERS[v])

  async function saveVar(name: string) {
    const value = values[name]?.trim()
    if (!value) return
    setSaving(true)
    const res = await apiFetch(`/api/v1/tasks/${taskId}/env-vars`, {
      method: 'POST',
      body: JSON.stringify({ key: name, value }),
    })
    setSaving(false)
    if (res.success) setSaved(prev => [...prev, name])
  }

  async function saveAll() {
    setSaving(true)
    for (const name of Object.keys(values)) {
      if (values[name]?.trim()) {
        await apiFetch(`/api/v1/tasks/${taskId}/env-vars`, {
          method: 'POST',
          body: JSON.stringify({ key: name, value: values[name].trim() }),
        })
        setSaved(prev => [...prev, name])
      }
    }
    setSaving(false)
  }

  if (detectedVars.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center px-4">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-sm text-slate-600 font-medium">No environment variables detected</p>
        <p className="text-xs text-slate-400 mt-1">Your project doesn't seem to require any API keys or secrets.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 text-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
        <p className="text-xs font-semibold text-indigo-800">
          {known.length} environment variable{known.length !== 1 ? 's' : ''} detected
        </p>
        <p className="text-[11px] text-indigo-600 mt-0.5">
          Set these up so your project can run. Click each to get instructions.
        </p>
      </div>

      {/* Known vars */}
      <div className="divide-y divide-slate-100">
        {known.map(name => {
          const provider = ENV_PROVIDERS[name]
          const isSaved = saved.includes(name)
          const isOpen = expanded === name

          return (
            <div key={name} className="bg-white">
              {/* Row header */}
              <button
                onClick={() => setExpanded(isOpen ? null : name)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors"
              >
                <span className="text-base shrink-0">{CATEGORY_ICONS[provider.category]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-semibold text-slate-800 truncate">{name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{provider.name} · {provider.description}</p>
                </div>
                {isSaved
                  ? <span className="text-[10px] text-emerald-600 font-semibold shrink-0">✓ Saved</span>
                  : values[name] ? <span className="text-[10px] text-amber-600 shrink-0">• Unsaved</span> : null
                }
                <span className="text-slate-300 text-xs shrink-0">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 bg-slate-50 border-t border-slate-100">
                  {/* How to get */}
                  <div className="pt-3">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">How to get it</p>
                    <p className="text-xs text-slate-700">{provider.howTo}</p>
                    {provider.url && (
                      <a
                        href={provider.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Open {provider.name} →
                      </a>
                    )}
                  </div>

                  {/* Input */}
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Value</p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={values[name] ?? ''}
                        onChange={e => setValues(v => ({ ...v, [name]: e.target.value }))}
                        placeholder={`Paste your ${provider.name} key…`}
                        className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        onClick={() => saveVar(name)}
                        disabled={!values[name]?.trim() || saving || isSaved}
                        className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-40 shrink-0"
                      >
                        {isSaved ? '✓' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Unknown vars */}
      {unknown.length > 0 && (
        <div className="border-t border-slate-200">
          <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
            Other variables ({unknown.length})
          </p>
          <div className="px-4 pb-3 space-y-2">
            {unknown.map(name => (
              <div key={name} className="flex gap-2 items-center">
                <p className="text-xs font-mono text-slate-600 w-40 shrink-0 truncate">{name}</p>
                <input
                  type="text"
                  value={values[name] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [name]: e.target.value }))}
                  placeholder="value"
                  className="flex-1 text-xs px-2 py-1.5 rounded border border-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  onClick={() => saveVar(name)}
                  disabled={!values[name]?.trim() || saving}
                  className="text-xs px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-40 shrink-0"
                >
                  Save
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save all */}
      {Object.values(values).some(v => v?.trim()) && (
        <div className="px-4 py-3 border-t border-slate-200 bg-white">
          <button
            onClick={saveAll}
            disabled={saving}
            className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save all variables'}
          </button>
        </div>
      )}
    </div>
  )
}
