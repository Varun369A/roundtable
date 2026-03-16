/**
 * Code Assembler — extracts structured files from AI subtask outputs.
 *
 * Supports multiple output formats that Claude / GPT-4o naturally produce:
 *   1. JSON: { "files": [{ "path": "...", "content": "..." }] }
 *   2. Markdown code blocks with filepath comment at top:
 *        ```ts\n// filepath: src/index.ts\n...code\n```
 *   3. Section markers:  === FILE: src/index.ts ===
 *   4. Markdown H3 headers followed by code blocks: ### src/index.ts\n```...```
 */

import { prisma } from '@sabha/db'

export interface CodeFile {
  path:     string
  content:  string
  language: string
}

// ─── Language detection ───────────────────────────────────────────────────────

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  kt: 'kotlin', cs: 'csharp', cpp: 'cpp', c: 'c', php: 'php',
  swift: 'swift', html: 'html', css: 'css', scss: 'scss',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  md: 'markdown', sh: 'bash', bash: 'bash', sql: 'sql',
  dockerfile: 'dockerfile', env: 'plaintext', txt: 'plaintext',
  prisma: 'prisma', graphql: 'graphql', proto: 'protobuf',
}

function detectLanguage(path: string): string {
  const lower = path.toLowerCase()
  if (lower === 'dockerfile') return 'dockerfile'
  const ext = lower.split('.').pop() ?? ''
  return EXT_TO_LANG[ext] ?? 'plaintext'
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

/** Strategy 1: try parsing as JSON { files: [{path, content}] } */
function parseJson(text: string): CodeFile[] {
  try {
    const match = text.match(/\{[\s\S]*"files"\s*:\s*\[[\s\S]*\]\s*\}/)
    if (!match) return []
    const obj = JSON.parse(match[0])
    if (!Array.isArray(obj.files)) return []
    return obj.files
      .filter((f: any) => f.path && typeof f.content === 'string')
      .map((f: any) => ({
        path:     f.path.replace(/^\//, ''),
        content:  f.content,
        language: detectLanguage(f.path),
      }))
  } catch {
    return []
  }
}

/** Strategy 2: fenced code blocks with filepath comment/header inside */
function parseFencedBlocks(text: string): CodeFile[] {
  const files: CodeFile[] = []
  // Match ```lang\n[optional filepath comment]\ncode\n```
  const fence = /```(\w*)\n([\s\S]*?)```/g
  let m: RegExpExecArray | null

  while ((m = fence.exec(text)) !== null) {
    const lang    = m[1] || ''
    const body    = m[2]
    const lines   = body.split('\n')
    const firstLine = lines[0].trim()

    // Look for filepath on first line: "// filepath: path", "# filepath: path", "// path", "// File: path"
    const fpMatch = firstLine.match(
      /^(?:\/\/|#|--)\s*(?:filepath:|file:|path:)?\s*([^\s].+)/i
    )
    if (fpMatch) {
      const path    = fpMatch[1].trim().replace(/^['"]|['"]$/g, '')
      const content = lines.slice(1).join('\n').trimEnd()
      if (path && content && looksLikeFilePath(path)) {
        files.push({ path: path.replace(/^\//, ''), content, language: lang || detectLanguage(path) })
      }
    }
  }
  return files
}

/** Strategy 3: === FILE: path === markers */
function parseFileMarkers(text: string): CodeFile[] {
  const files: CodeFile[] = []
  const marker = /={3,}\s*FILE:\s*([^\s=]+)\s*={3,}([\s\S]*?)(?=={3,}\s*(?:FILE:|END)|$)/gi
  let m: RegExpExecArray | null
  while ((m = marker.exec(text)) !== null) {
    const path    = m[1].trim().replace(/^\//, '')
    const content = m[2].trim()
    if (path && content) {
      files.push({ path, content, language: detectLanguage(path) })
    }
  }
  return files
}

/** Strategy 4: markdown H3 headers followed by fenced code block */
function parseMarkdownHeaders(text: string): CodeFile[] {
  const files: CodeFile[] = []
  // ### path/to/file.ts  followed by ```...```
  const section = /^#{2,4}\s+([^\n]+)\n+```(\w*)\n([\s\S]*?)```/gm
  let m: RegExpExecArray | null
  while ((m = section.exec(text)) !== null) {
    const header  = m[1].trim()
    const lang    = m[2]
    const content = m[3].trimEnd()
    if (looksLikeFilePath(header)) {
      const path = header.replace(/^\//, '')
      files.push({ path, content, language: lang || detectLanguage(path) })
    }
  }
  return files
}

function looksLikeFilePath(s: string): boolean {
  // Has a file extension or looks like a path
  return /\.[a-z]{1,10}$/i.test(s) || s.includes('/')
}

// ─── Merge + deduplicate ──────────────────────────────────────────────────────

function mergeFiles(allFiles: CodeFile[]): CodeFile[] {
  const map = new Map<string, CodeFile>()
  for (const f of allFiles) {
    // Normalize path: strip leading ./, handle backslashes
    const path = f.path.replace(/\\/g, '/').replace(/^\.\//, '')
    map.set(path, { ...f, path })
  }
  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path))
}

// ─── Main assembler ───────────────────────────────────────────────────────────

export async function assembleCodeProject(taskId: string): Promise<CodeFile[]> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      subtasks: {
        where: { status: 'COMPLETED' },
        include: { output: true },
        orderBy: { executionOrder: 'asc' },
      },
    },
  })

  if (!task) throw new Error(`Task ${taskId} not found`)

  const allFiles: CodeFile[] = []

  for (const subtask of task.subtasks) {
    const text = subtask.output?.content ?? ''
    if (!text) continue

    // Try each strategy in order of precision
    let extracted: CodeFile[] = parseJson(text)
    if (extracted.length === 0) extracted = parseFileMarkers(text)
    if (extracted.length === 0) extracted = parseFencedBlocks(text)
    if (extracted.length === 0) extracted = parseMarkdownHeaders(text)

    allFiles.push(...extracted)
  }

  const files = mergeFiles(allFiles)

  // Always ensure a README.md exists
  if (!files.find((f) => f.path.toLowerCase() === 'readme.md')) {
    files.unshift({
      path:     'README.md',
      content:  buildReadme(task.title, task.originalGoal, files),
      language: 'markdown',
    })
  }

  return files
}

function buildReadme(title: string, goal: string, files: CodeFile[]): string {
  const fileList = files.map((f) => `- \`${f.path}\``).join('\n')
  return `# ${title}

> ${goal}

## Generated by Sabha AI

This project was generated by Sabha's multi-AI roundtable system.

## Project Structure

${fileList || '*(No code files detected)*'}

## Getting Started

1. Review the generated files
2. Install dependencies (check \`package.json\` or \`requirements.txt\`)
3. Follow the inline documentation

---
*Generated by Sabha AI · ${new Date().toLocaleDateString()}*
`
}
