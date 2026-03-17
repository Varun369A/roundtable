/**
 * Preview Generator
 *
 * Converts subtask AI outputs to HTML preview snippets for the
 * live preview pane in the roundtable UI.
 *
 * Each template category renders differently:
 * - development: syntax-highlighted code blocks
 * - design: image or design brief card
 * - marketing/content: formatted article preview
 * - business: document-style preview
 * - research: structured research with sections
 * - learning: module-style content
 * - personal: clean text
 */

export type PreviewType = 'code' | 'image' | 'document' | 'article' | 'research' | 'learning' | 'text'

export interface PreviewResult {
  type: PreviewType
  html: string
  title: string
}

const CATEGORY_PREVIEW_TYPE: Record<string, PreviewType> = {
  development: 'code',
  design:      'image',
  marketing:   'article',
  content:     'article',
  business:    'document',
  research:    'research',
  learning:    'learning',
  personal:    'text',
}

/**
 * Generate preview HTML from a subtask output.
 * templateCategory: the TemplateCategory of the parent task (e.g. 'development')
 * subtaskTitle: title of the subtask for display
 * output: { type, content?, fileUrl? }
 */
export function generatePreview(
  templateCategory: string,
  subtaskTitle: string,
  output: { type: string; content?: string; fileUrl?: string }
): PreviewResult {
  const previewType = CATEGORY_PREVIEW_TYPE[templateCategory] || 'text'

  if (output.type === 'image' && output.fileUrl) {
    return generateImagePreview(subtaskTitle, output.fileUrl)
  }

  const content = output.content || ''

  switch (previewType) {
    case 'code':      return generateCodePreview(subtaskTitle, content)
    case 'document':  return generateDocumentPreview(subtaskTitle, content)
    case 'article':   return generateArticlePreview(subtaskTitle, content)
    case 'research':  return generateResearchPreview(subtaskTitle, content)
    case 'learning':  return generateLearningPreview(subtaskTitle, content)
    default:          return generateTextPreview(subtaskTitle, content)
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function markdownToHtml(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="preview-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="preview-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="preview-h1">$1</h1>')
    // Code blocks (extract before line processing)
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre class="preview-code"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="preview-inline-code">$1</code>')
    // Bullet lists
    .replace(/^[*\-] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul class="preview-ul">$1</ul>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Line breaks to paragraphs (double newline)
    .replace(/\n\n(?!<)/g, '</p><p class="preview-p">')
    .replace(/\n(?!<)/g, '<br>')
}

function wrapPreview(type: PreviewType, title: string, body: string): PreviewResult {
  const html = `
<div class="preview-root" data-type="${type}">
  <div class="preview-title">${escapeHtml(title)}</div>
  <div class="preview-body">${body}</div>
</div>`
  return { type, html, title }
}

function generateCodePreview(title: string, content: string): PreviewResult {
  // Extract code blocks
  const codeBlocks: string[] = []
  const codeRegex = /```(?:\w+)?\n?([\s\S]*?)```/g
  let match
  while ((match = codeRegex.exec(content)) !== null) {
    codeBlocks.push(match[1].trim())
  }

  let body: string
  if (codeBlocks.length > 0) {
    body = codeBlocks
      .slice(0, 3) // show first 3 code blocks
      .map((code) => `<pre class="preview-code"><code>${escapeHtml(code)}</code></pre>`)
      .join('\n')
    // Any text before first code block
    const preamble = content.split('```')[0].trim()
    if (preamble) {
      body = `<p class="preview-p">${escapeHtml(preamble.slice(0, 300))}</p>` + body
    }
  } else {
    // No code blocks, treat as text but show in monospace
    body = `<pre class="preview-code"><code>${escapeHtml(content.slice(0, 2000))}</code></pre>`
  }

  return wrapPreview('code', title, body)
}

function generateImagePreview(title: string, fileUrl: string): PreviewResult {
  const body = `<img src="${fileUrl}" alt="${escapeHtml(title)}" class="preview-image" />`
  return wrapPreview('image', title, body)
}

function generateArticlePreview(title: string, content: string): PreviewResult {
  const html = markdownToHtml(content.slice(0, 3000))
  const body = `<article class="preview-article"><p class="preview-p">${html}</p></article>`
  return wrapPreview('article', title, body)
}

function generateDocumentPreview(title: string, content: string): PreviewResult {
  const html = markdownToHtml(content.slice(0, 3000))
  const body = `<div class="preview-document"><p class="preview-p">${html}</p></div>`
  return wrapPreview('document', title, body)
}

function generateResearchPreview(title: string, content: string): PreviewResult {
  const html = markdownToHtml(content.slice(0, 3000))
  const body = `<div class="preview-research"><p class="preview-p">${html}</p></div>`
  return wrapPreview('research', title, body)
}

function generateLearningPreview(title: string, content: string): PreviewResult {
  const html = markdownToHtml(content.slice(0, 3000))
  const body = `<div class="preview-learning"><p class="preview-p">${html}</p></div>`
  return wrapPreview('learning', title, body)
}

function generateTextPreview(title: string, content: string): PreviewResult {
  const html = markdownToHtml(content.slice(0, 2000))
  const body = `<p class="preview-p">${html}</p>`
  return wrapPreview('text', title, body)
}
