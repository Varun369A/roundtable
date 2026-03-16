'use client'

interface CodeFile {
  path:     string
  content:  string
  language: string
}

const LANG_COLORS: Record<string, string> = {
  typescript: 'text-blue-400',
  javascript: 'text-yellow-400',
  python:     'text-green-400',
  go:         'text-cyan-400',
  rust:       'text-orange-400',
  html:       'text-orange-300',
  css:        'text-pink-400',
  json:       'text-yellow-300',
  markdown:   'text-zinc-300',
  sql:        'text-purple-400',
  bash:       'text-green-300',
  dockerfile: 'text-blue-300',
  plaintext:  'text-zinc-400',
}

export default function CodeViewer({ file }: { file: CodeFile | null }) {
  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        Select a file to view its contents
      </div>
    )
  }

  const langColor = LANG_COLORS[file.language] ?? 'text-zinc-400'
  const lineCount = file.content.split('\n').length

  return (
    <div className="flex flex-col h-full">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-zinc-300 text-sm font-mono">{file.path}</span>
          <span className={`text-xs font-medium ${langColor}`}>{file.language}</span>
        </div>
        <span className="text-xs text-zinc-600">{lineCount} lines</span>
      </div>

      {/* Code content */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-h-full">
          {/* Line numbers */}
          <div className="select-none px-3 py-4 text-right text-zinc-700 text-xs font-mono leading-6 bg-zinc-950/40 border-r border-zinc-800/50 min-w-[3rem] shrink-0">
            {file.content.split('\n').map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* Code */}
          <pre className="flex-1 px-4 py-4 text-xs font-mono leading-6 text-zinc-200 overflow-x-auto whitespace-pre">
            {file.content}
          </pre>
        </div>
      </div>
    </div>
  )
}
