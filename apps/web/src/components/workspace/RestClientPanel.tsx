'use client'

import { useState, useMemo } from 'react'

interface CodeFile {
  path:     string
  content:  string
  language: string
}

interface RestClientPanelProps {
  files: CodeFile[]
}

interface DetectedEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  description?: string
}

interface RequestResult {
  status: number
  statusText: string
  body: string
  duration: number
  ok: boolean
}

const METHOD_COLOR: Record<string, string> = {
  GET:    'bg-emerald-100 text-emerald-700',
  POST:   'bg-blue-100 text-blue-700',
  PUT:    'bg-amber-100 text-amber-700',
  PATCH:  'bg-violet-100 text-violet-700',
  DELETE: 'bg-red-100 text-red-700',
}

/** Extract API endpoints from route files */
function detectEndpoints(files: CodeFile[]): DetectedEndpoint[] {
  const endpoints: DetectedEndpoint[] = []
  const routeFiles = files.filter((f) =>
    f.path.includes('/routes/') || f.path.includes('/api/') || f.path.includes('route.ts')
  )

  for (const file of routeFiles) {
    // Match patterns like: app.get('/path', ...) or router.post('/path', ...)
    const matches = file.content.matchAll(/(?:app|router|fastify)\.(get|post|put|patch|delete)\s*\(['"`]([^'"`,]+)['"`]/gi)
    for (const match of matches) {
      const method = match[1].toUpperCase() as DetectedEndpoint['method']
      const path = match[2]
      if (path && !endpoints.some((e) => e.method === method && e.path === path)) {
        endpoints.push({ method, path })
      }
    }
    // Next.js route handlers: export async function GET/POST(...)
    const nextMatches = file.content.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g)
    for (const match of nextMatches) {
      const method = match[1] as DetectedEndpoint['method']
      // Try to infer path from file path: src/app/api/users/route.ts → /api/users
      const routePath = file.path
        .replace(/.*?src\/app/, '')
        .replace('/route.ts', '')
        .replace('/route.js', '')
        || '/api'
      if (!endpoints.some((e) => e.method === method && e.path === routePath)) {
        endpoints.push({ method, path: routePath })
      }
    }
  }

  return endpoints.slice(0, 20)
}

export function RestClientPanel({ files }: RestClientPanelProps) {
  const detectedEndpoints = useMemo(() => detectEndpoints(files), [files])

  const [baseUrl, setBaseUrl]   = useState('http://localhost:3000')
  const [method, setMethod]     = useState<string>('GET')
  const [path, setPath]         = useState('/api/health')
  const [body, setBody]         = useState('')
  const [headers, setHeaders]   = useState('{\n  "Content-Type": "application/json"\n}')
  const [result, setResult]     = useState<RequestResult | null>(null)
  const [loading, setLoading]   = useState(false)
  const [showHeaders, setShowHeaders] = useState(false)

  function loadEndpoint(ep: DetectedEndpoint) {
    setMethod(ep.method)
    setPath(ep.path)
    if (ep.method !== 'GET' && ep.method !== 'DELETE') {
      setBody('{\n  \n}')
    } else {
      setBody('')
    }
  }

  async function sendRequest() {
    setLoading(true)
    setResult(null)
    const start = Date.now()
    try {
      let parsedHeaders: Record<string, string> = {}
      try { parsedHeaders = JSON.parse(headers) } catch { /* ignore */ }

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: parsedHeaders,
        body: ['GET', 'DELETE'].includes(method) ? undefined : (body || undefined),
      })
      const text = await res.text()
      let pretty = text
      try { pretty = JSON.stringify(JSON.parse(text), null, 2) } catch { /* not JSON */ }

      setResult({
        status: res.status,
        statusText: res.statusText,
        body: pretty,
        duration: Date.now() - start,
        ok: res.ok,
      })
    } catch (err) {
      setResult({
        status: 0,
        statusText: 'Network Error',
        body: err instanceof Error ? err.message : 'Request failed',
        duration: Date.now() - start,
        ok: false,
      })
    }
    setLoading(false)
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Left — Detected endpoints */}
      <div className="w-52 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-200">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Detected Endpoints</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {detectedEndpoints.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-400 text-center">No endpoints detected</p>
          ) : (
            detectedEndpoints.map((ep, i) => (
              <button
                key={i}
                onClick={() => loadEndpoint(ep)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white border-b border-slate-100 text-left transition-colors"
              >
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${METHOD_COLOR[ep.method] ?? 'bg-slate-100 text-slate-600'}`}>
                  {ep.method}
                </span>
                <span className="text-xs font-mono text-slate-600 truncate">{ep.path}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right — Request builder */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* URL bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 shrink-0">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-40 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/api/endpoint"
            className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={sendRequest}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 shrink-0"
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>

        {/* Body + Headers */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!['GET', 'DELETE'].includes(method) && (
            <div className="border-b border-slate-200 flex flex-col" style={{ maxHeight: '35%' }}>
              <p className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">Request Body</p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="flex-1 resize-none px-4 py-3 text-xs font-mono text-slate-700 bg-white focus:outline-none"
                placeholder='{"key": "value"}'
              />
            </div>
          )}

          {/* Headers (collapsible) */}
          <div className="border-b border-slate-200">
            <button
              onClick={() => setShowHeaders((v) => !v)}
              className="w-full px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between hover:bg-slate-50"
            >
              Headers
              <span>{showHeaders ? '▲' : '▼'}</span>
            </button>
            {showHeaders && (
              <textarea
                value={headers}
                onChange={(e) => setHeaders(e.target.value)}
                rows={4}
                className="w-full resize-none px-4 py-2 text-xs font-mono text-slate-700 bg-slate-50 border-t border-slate-100 focus:outline-none"
              />
            )}
          </div>

          {/* Response */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {!result ? (
              <div className="flex items-center justify-center h-24 text-slate-400 text-xs">
                Send a request to see the response
              </div>
            ) : (
              <div>
                <div className={`px-4 py-2.5 flex items-center gap-3 ${result.ok ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <span className={`text-sm font-bold ${result.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                    {result.status} {result.statusText}
                  </span>
                  <span className="text-xs text-slate-400">{result.duration}ms</span>
                </div>
                <pre className="px-4 py-3 text-xs font-mono text-slate-700 whitespace-pre-wrap break-all overflow-auto">
                  {result.body}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
