'use client'

interface CodeFile {
  path:     string
  content:  string
  language: string
}

const LANG_COLORS: Record<string, string> = {
  typescript: 'text-blue-600',
  javascript: 'text-yellow-600',
  python:     'text-green-600',
  go:         'text-cyan-600',
  rust:       'text-orange-600',
  html:       'text-orange-500',
  css:        'text-pink-600',
  json:       'text-yellow-600',
  markdown:   'text-slate-600',
  sql:        'text-purple-600',
  bash:       'text-green-600',
  dockerfile: 'text-blue-500',
  plaintext:  'text-slate-500',
}

export default function CodeViewer({ file }: { file: CodeFile | null }) {
  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Select a file to view its contents
      </div>
    )
  }

  const langColor = LANG_COLORS[file.language] ?? 'text-slate-500'
  const lineCount = file.content.split('\n').length

  return (
    <div className="flex flex-col h-full">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-slate-700 text-sm font-mono">{file.path}</span>
          <span className={`text-xs font-medium ${langColor}`}>{file.language}</span>
        </div>
        <span className="text-xs text-slate-400">{lineCount} lines</span>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-h-full">
          {/* Line numbers */}
          <div className="select-none px-3 py-4 text-right text-slate-400 text-xs font-mono leading-6 bg-slate-100 border-r border-slate-200 min-w-[3rem] shrink-0">
            {file.content.split('\n').map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* Code */}
          <pre className="flex-1 px-4 py-4 text-xs font-mono leading-6 text-slate-800 overflow-x-auto whitespace-pre">
            {file.content}
          </pre>
        </div>
      </div>
    </div>
  )
}
