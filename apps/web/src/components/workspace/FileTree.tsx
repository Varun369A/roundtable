'use client'

import { useState } from 'react'

interface CodeFile {
  path:     string
  content:  string
  language: string
}

interface TreeNode {
  name:     string
  path:     string
  isDir:    boolean
  children: TreeNode[]
  file?:    CodeFile
}

function buildTree(files: CodeFile[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const file of files) {
    const parts = file.path.split('/')
    let nodes = root

    for (let i = 0; i < parts.length; i++) {
      const name  = parts[i]
      const isDir = i < parts.length - 1
      const path  = parts.slice(0, i + 1).join('/')

      let existing = nodes.find((n) => n.name === name)
      if (!existing) {
        existing = { name, path, isDir, children: [], file: isDir ? undefined : file }
        nodes.push(existing)
      }
      nodes = existing.children
    }
  }

  // Sort: dirs first, then files, both alphabetically
  const sort = (ns: TreeNode[]): TreeNode[] => {
    ns.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    ns.forEach((n) => { n.children = sort(n.children) })
    return ns
  }

  return sort(root)
}

const FILE_ICONS: Record<string, string> = {
  ts: '📘', tsx: '📘', js: '📒', jsx: '📒', py: '🐍',
  go: '🐹', rs: '🦀', java: '☕', kt: '🟣', css: '🎨',
  scss: '🎨', html: '🌐', json: '📋', yaml: '📋', yml: '📋',
  md: '📝', sh: '⚙️', sql: '🗄️', env: '🔑', txt: '📄',
  prisma: '🔷', graphql: '🔴', dockerfile: '🐳',
}

function fileIcon(name: string): string {
  const lower = name.toLowerCase()
  if (lower === 'dockerfile') return '🐳'
  const ext = lower.split('.').pop() ?? ''
  return FILE_ICONS[ext] ?? '📄'
}

function TreeNodeItem({
  node,
  depth,
  selected,
  onSelect,
}: {
  node:     TreeNode
  depth:    number
  selected: string | null
  onSelect: (f: CodeFile) => void
}) {
  const [open, setOpen] = useState(depth < 1)

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded hover:bg-zinc-800/60 transition-colors text-sm"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <span className="text-zinc-500 text-xs">{open ? '▾' : '▸'}</span>
          <span className="text-zinc-400">📁</span>
          <span className="text-zinc-300 font-medium">{node.name}</span>
        </button>
        {open && node.children.map((child) => (
          <TreeNodeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
      </div>
    )
  }

  const isSelected = selected === node.path
  return (
    <button
      onClick={() => node.file && onSelect(node.file)}
      className={`flex items-center gap-1.5 w-full text-left px-2 py-1 rounded transition-colors text-sm ${
        isSelected
          ? 'bg-indigo-500/20 text-indigo-300'
          : 'hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'
      }`}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      <span>{fileIcon(node.name)}</span>
      <span className={isSelected ? 'text-indigo-300' : 'text-zinc-300'}>{node.name}</span>
    </button>
  )
}

export default function FileTree({
  files,
  selected,
  onSelect,
}: {
  files:    CodeFile[]
  selected: string | null
  onSelect: (f: CodeFile) => void
}) {
  const tree = buildTree(files)

  return (
    <div className="h-full overflow-y-auto py-2">
      <p className="px-3 py-1 text-[10px] text-zinc-600 uppercase tracking-widest font-medium mb-1">
        Explorer
      </p>
      {tree.length === 0 ? (
        <p className="px-3 py-4 text-xs text-zinc-600 text-center">No files</p>
      ) : (
        tree.map((node) => (
          <TreeNodeItem
            key={node.path}
            node={node}
            depth={0}
            selected={selected}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  )
}
