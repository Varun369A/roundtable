'use client'

import { useCallback, useRef, useState } from 'react'

export interface CodeFile {
  path: string
  content: string
  language: string
}

export type WCStatus =
  | 'idle'
  | 'booting'
  | 'mounting'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'error'

export const WC_STATUS_LABEL: Record<WCStatus, string> = {
  idle:       'Not started',
  booting:    'Booting runtime…',
  mounting:   'Mounting files…',
  installing: 'Installing dependencies…',
  starting:   'Starting dev server…',
  ready:      'Live',
  error:      'Error',
}

export function useWebContainer(files: CodeFile[]) {
  const [status,     setStatus]     = useState<WCStatus>('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  const wcRef      = useRef<any>(null)
  const startedRef = useRef(false)

  const start = useCallback(async (onOutput?: (data: string) => void) => {
    if (startedRef.current) return
    startedRef.current = true

    const write = (msg: string) => onOutput?.(msg)

    try {
      setStatus('booting')
      write('\x1b[1;34m▶ Arivarangam Dev Environment\x1b[0m\r\n\r\n')

      const { WebContainer } = await import('@webcontainer/api')
      const wc = await WebContainer.boot()
      wcRef.current = wc

      setStatus('mounting')
      write('\x1b[33m• Mounting project files…\x1b[0m\r\n')
      const tree = buildFileTree(files)
      await wc.mount(tree)
      write(`\x1b[32m✓ ${files.length} files mounted\x1b[0m\r\n\r\n`)

      // Detect package manager
      const hasPnpm = files.some(f => f.path === 'pnpm-lock.yaml')
      const pm = hasPnpm ? 'pnpm' : 'npm'

      setStatus('installing')
      write(`\x1b[33m$ ${pm} install\x1b[0m\r\n`)
      const install = await wc.spawn(pm, ['install'])
      install.output.pipeTo(new WritableStream({ write(d: string) { write(d) } }))
      const exitCode = await install.exit
      if (exitCode !== 0) throw new Error(`${pm} install exited with code ${exitCode}`)
      write('\x1b[32m✓ Dependencies installed\x1b[0m\r\n\r\n')

      setStatus('starting')
      write('\x1b[33m$ npm run dev\x1b[0m\r\n')
      const dev = await wc.spawn('npm', ['run', 'dev'])
      dev.output.pipeTo(new WritableStream({ write(d: string) { write(d) } }))

      wc.on('server-ready', (_port: number, url: string) => {
        setPreviewUrl(url)
        setStatus('ready')
        write(`\r\n\x1b[32m✓ Server ready → ${url}\x1b[0m\r\n`)
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setStatus('error')
      write(`\r\n\x1b[31mError: ${msg}\x1b[0m\r\n`)
    }
  }, [files])

  /** Spawn an interactive bash shell connected to the running WebContainer */
  const spawnShell = useCallback(async (cols = 80, rows = 24) => {
    if (!wcRef.current) return null
    try {
      return await wcRef.current.spawn('bash', {
        terminal: { cols, rows },
      })
    } catch {
      // Fallback to sh if bash not available
      try {
        return await wcRef.current.spawn('sh', {
          terminal: { cols, rows },
        })
      } catch {
        return null
      }
    }
  }, [])

  /** Write a file into the running container (e.g. after an edit) */
  const writeFile = useCallback(async (path: string, content: string) => {
    if (!wcRef.current) return
    await wcRef.current.fs.writeFile(path, content)
  }, [])

  return { status, previewUrl, error, start, spawnShell, writeFile }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildFileTree(files: CodeFile[]): Record<string, any> {
  const tree: Record<string, any> = {}

  for (const f of files) {
    const parts = f.path.replace(/^\//, '').split('/')
    let node = tree
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!node[part]) node[part] = { directory: {} }
      node = node[part].directory
    }
    const filename = parts[parts.length - 1]!
    node[filename] = { file: { contents: f.content } }
  }

  return tree
}
