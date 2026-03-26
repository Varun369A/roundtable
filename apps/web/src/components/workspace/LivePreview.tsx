'use client'

import { useMemo } from 'react'

interface CodeFile {
  path:     string
  content:  string
  language: string
}

interface LivePreviewProps {
  files: CodeFile[]
  projectName: string
}

/**
 * Phase 6 — Live Preview
 *
 * For HTML/CSS/JS projects: renders a live iframe with srcdoc.
 * For other projects: shows a structured project overview card.
 */
export function LivePreview({ files, projectName }: LivePreviewProps) {
  const htmlFile = useMemo(() => files.find((f) =>
    f.path === 'index.html' || f.path.endsWith('/index.html') || (f.language === 'html' && f.path.includes('index'))
  ), [files])

  const cssFile = useMemo(() => files.find((f) => f.language === 'css' || f.path.endsWith('.css')), [files])
  const jsFile = useMemo(() => files.find((f) =>
    (f.language === 'javascript' || f.path.endsWith('.js')) && !f.path.includes('node_modules')
  ), [files])

  // Detect project type from file extensions and paths
  const projectType = useMemo(() => {
    const paths = files.map((f) => f.path)
    if (paths.some((p) => p.includes('next.config'))) return 'nextjs'
    if (paths.some((p) => p === 'index.html' || p.endsWith('/index.html'))) return 'html'
    if (paths.some((p) => p.includes('fastapi') || p.includes('django') || p.includes('flask'))) return 'python-api'
    if (paths.some((p) => p.includes('server.ts') || p.includes('server.js') || p.includes('app.ts'))) return 'node-api'
    if (paths.some((p) => p.includes('App.tsx') || p.includes('App.jsx'))) return 'react'
    return 'other'
  }, [files])

  // For HTML projects: inject CSS and JS into the HTML for preview
  const previewHtml = useMemo(() => {
    if (!htmlFile) return null
    let html = htmlFile.content
    // Inject CSS if available and not already linked externally
    if (cssFile && !html.includes('<link')) {
      html = html.replace('</head>', `<style>\n${cssFile.content}\n</style>\n</head>`)
    }
    // Inject JS if available and not already linked externally
    if (jsFile && !html.includes('<script src')) {
      html = html.replace('</body>', `<script>\n${jsFile.content}\n</script>\n</body>`)
    }
    return html
  }, [htmlFile, cssFile, jsFile])

  const filesByType = useMemo(() => {
    const groups: Record<string, CodeFile[]> = {}
    for (const f of files) {
      const dir = f.path.split('/').slice(0, -1).join('/') || 'root'
      if (!groups[dir]) groups[dir] = []
      groups[dir].push(f)
    }
    return groups
  }, [files])

  if (previewHtml) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-2 bg-slate-800 flex items-center gap-3 shrink-0">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-amber-500/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-slate-400 text-xs font-mono truncate">{projectName} — live preview</span>
          <span className="ml-auto text-[10px] text-emerald-400 font-medium">● HTML</span>
        </div>
        <iframe
          srcDoc={previewHtml}
          sandbox="allow-scripts"
          className="flex-1 w-full bg-white"
          title="Live Preview"
        />
      </div>
    )
  }

  // Non-HTML projects — show architecture overview
  const TYPE_INFO: Record<string, { icon: string; label: string; description: string }> = {
    nextjs:     { icon: '▲', label: 'Next.js App',          description: 'Full-stack React app — deploy to Vercel for live preview' },
    react:      { icon: '⚛', label: 'React App',            description: 'Client-side React app — run `npm run dev` to preview locally' },
    'node-api': { icon: '🟩', label: 'Node.js API',         description: 'REST API server — run `npm start` and test with the REST Client tab' },
    'python-api':{ icon: '🐍', label: 'Python API',         description: 'Python API — run `uvicorn main:app --reload` or `python app.py`' },
    other:      { icon: '📦', label: 'Project',             description: 'See README.md for setup and run instructions' },
  }

  const info = TYPE_INFO[projectType] ?? TYPE_INFO['other']

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-6">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-3xl">
        {info.icon}
      </div>
      <div>
        <p className="text-base font-bold text-slate-800">{info.label}</p>
        <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">{info.description}</p>
      </div>

      {/* File structure summary */}
      <div className="w-full max-w-sm text-left rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
          <p className="text-xs font-semibold text-slate-600">Project structure ({files.length} files)</p>
        </div>
        <div className="px-4 py-3 space-y-1.5 max-h-48 overflow-y-auto">
          {Object.entries(filesByType).map(([dir, dirFiles]) => (
            <div key={dir}>
              {dir !== 'root' && <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">{dir}/</p>}
              {dirFiles.map((f) => (
                <p key={f.path} className="text-xs font-mono text-slate-600 pl-2">
                  {f.path.split('/').pop()}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
