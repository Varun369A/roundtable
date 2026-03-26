'use client'

import { useEffect, useRef, useState } from 'react'
import { useWebContainer, WC_STATUS_LABEL, type WCStatus, type CodeFile } from '@/hooks/useWebContainer'

// xterm CSS — must be a top-level import; Next.js bundles it as global CSS
import '@xterm/xterm/css/xterm.css'

interface WorkspaceRightPanelProps {
  files: CodeFile[]
  projectName: string
}

export function WorkspaceRightPanel({ files, projectName }: WorkspaceRightPanelProps) {
  const { status, previewUrl, error, start, spawnShell } = useWebContainer(files)

  const termContainerRef = useRef<HTMLDivElement>(null)
  const xtermRef         = useRef<any>(null)
  const fitAddonRef      = useRef<any>(null)

  const [termOpen,    setTermOpen]    = useState(true)
  const [started,     setStarted]     = useState(false)
  const [urlInput,    setUrlInput]    = useState('')
  const [iframeKey,   setIframeKey]   = useState(0) // force reload

  // Sync URL bar with preview URL
  useEffect(() => {
    if (previewUrl) setUrlInput(previewUrl)
  }, [previewUrl])

  // Handle terminal resize
  useEffect(() => {
    const handler = () => fitAddonRef.current?.fit()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  async function initTerminal() {
    if (xtermRef.current || !termContainerRef.current) return

    // Dynamic imports — xterm uses browser APIs, can't run on server
    const { Terminal }  = await import('@xterm/xterm')
    const { FitAddon }  = await import('@xterm/addon-fit')

    const term = new Terminal({
      theme: {
        background:    '#0f172a',
        foreground:    '#cbd5e1',
        cursor:        '#818cf8',
        cursorAccent:  '#0f172a',
        selectionBackground: '#334155',
        black:         '#1e293b',
        brightBlack:   '#334155',
        red:           '#f87171',
        brightRed:     '#fca5a5',
        green:         '#4ade80',
        brightGreen:   '#86efac',
        yellow:        '#fbbf24',
        brightYellow:  '#fcd34d',
        blue:          '#818cf8',
        brightBlue:    '#a5b4fc',
        magenta:       '#c084fc',
        brightMagenta: '#d8b4fe',
        cyan:          '#22d3ee',
        brightCyan:    '#67e8f9',
        white:         '#cbd5e1',
        brightWhite:   '#f1f5f9',
      },
      fontSize:       12,
      fontFamily:     '"Menlo", "Monaco", "Cascadia Code", "Courier New", monospace',
      cursorBlink:    true,
      scrollback:     1000,
      convertEol:     true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termContainerRef.current)
    fitAddon.fit()

    xtermRef.current    = term
    fitAddonRef.current = fitAddon

    return term
  }

  async function handleRun() {
    setStarted(true)

    const term = await initTerminal()
    if (!term && xtermRef.current) {
      // Already initialized
    }
    const t = xtermRef.current

    // Start WebContainer, piping output to terminal
    await start((data: string) => t?.write(data))

    // After WebContainer boots, connect an interactive shell
    const shell = await spawnShell(
      xtermRef.current?.cols ?? 80,
      xtermRef.current?.rows ?? 24,
    )
    if (shell && xtermRef.current) {
      shell.output.pipeTo(
        new WritableStream({ write(d: string) { xtermRef.current?.write(d) } })
      )
      const writer = shell.input.getWriter()
      xtermRef.current.onData((d: string) => writer.write(d))
    }
  }

  function reloadPreview() {
    setIframeKey(k => k + 1)
  }

  const isLoading = started && status !== 'ready' && status !== 'error'

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">

      {/* ── Browser chrome ─────────────────────────────────────────────────── */}
      <div className="h-10 flex items-center gap-2 px-3 bg-gray-100 border-b border-gray-200 shrink-0">
        {/* Traffic lights */}
        <div className="flex gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-400/60 hover:bg-red-400 transition-colors cursor-default" />
          <div className="w-3 h-3 rounded-full bg-amber-400/60 hover:bg-amber-400 transition-colors cursor-default" />
          <div className="w-3 h-3 rounded-full bg-emerald-400/60 hover:bg-emerald-400 transition-colors cursor-default" />
        </div>

        {/* URL bar */}
        <input
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && reloadPreview()}
          placeholder={started ? WC_STATUS_LABEL[status] : `${projectName} — click ▶ Run`}
          className="flex-1 h-6 px-2 text-[11px] bg-white text-gray-700 rounded border border-gray-300 focus:outline-none focus:border-indigo-400 font-mono placeholder:text-gray-400"
        />

        {/* Status badge */}
        {status === 'ready' && (
          <span className="text-[10px] font-bold text-emerald-600 shrink-0">● LIVE</span>
        )}
        {status === 'error' && (
          <span className="text-[10px] font-bold text-red-500 shrink-0">● ERROR</span>
        )}
        {isLoading && (
          <span className="text-[10px] font-bold text-amber-500 shrink-0 animate-pulse">● STARTING</span>
        )}

        {/* Reload button */}
        {status === 'ready' && (
          <button
            onClick={reloadPreview}
            title="Reload preview"
            className="text-gray-400 hover:text-gray-600 transition-colors text-xs shrink-0"
          >
            ↺
          </button>
        )}

        {/* Run button */}
        {!started && (
          <button
            onClick={handleRun}
            className="shrink-0 px-2.5 h-6 rounded bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-[11px] font-bold transition-colors"
          >
            ▶ Run
          </button>
        )}
      </div>

      {/* ── Preview area ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative bg-white">
        {status === 'ready' && previewUrl ? (
          <iframe
            key={iframeKey}
            src={urlInput || previewUrl}
            className="w-full h-full border-none"
            title="Live Preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-6 bg-gray-50">
            {!started ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                  <span className="text-2xl text-gray-400">▶</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Run your project live</p>
                  <p className="text-xs text-gray-500 mt-1.5 max-w-xs leading-relaxed">
                    Click <strong className="text-gray-600">▶ Run</strong> to install dependencies and start the dev server in your browser.
                    No setup needed.
                  </p>
                </div>
                <button
                  onClick={handleRun}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  ▶ Run project
                </button>
              </>
            ) : status === 'error' ? (
              <>
                <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-2xl">⚠</div>
                <div>
                  <p className="text-sm font-semibold text-red-600">Failed to start</p>
                  <p className="text-xs text-red-400 mt-1">{error}</p>
                </div>
                <p className="text-xs text-gray-400">Check the terminal below for details</p>
              </>
            ) : (
              <>
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  <div className="absolute inset-2 rounded-full border-2 border-indigo-300 border-b-transparent animate-spin animation-reverse" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{WC_STATUS_LABEL[status as WCStatus]}</p>
                  <p className="text-xs text-gray-400 mt-1">See terminal below for live output</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Terminal panel ─────────────────────────────────────────────────── */}
      <div
        className={`border-t border-gray-200 shrink-0 flex flex-col transition-all duration-200 ${termOpen ? 'h-44' : 'h-8'}`}
      >
        {/* Terminal header */}
        <button
          onClick={() => setTermOpen(v => !v)}
          className="h-8 flex items-center gap-2 px-3 bg-gray-100 hover:bg-gray-200 w-full text-left shrink-0 group border-b border-gray-200"
        >
          <span className="text-gray-400 text-xs font-mono group-hover:text-gray-600 transition-colors">$_</span>
          <span className="text-xs font-mono text-gray-600 group-hover:text-gray-800 transition-colors">Terminal</span>
          {!started && (
            <span className="text-[10px] text-gray-400 ml-1">— run project to activate</span>
          )}
          <span className="ml-auto text-gray-400 text-xs group-hover:text-gray-600 transition-colors">
            {termOpen ? '▼' : '▲'}
          </span>
        </button>

        {/* xterm container — terminal stays dark, it's standard */}
        {termOpen && (
          <div
            ref={termContainerRef}
            className="flex-1 min-h-0 overflow-hidden px-1 py-0.5"
            style={{ background: '#0f172a' }}
          />
        )}
      </div>
    </div>
  )
}
