/**
 * suggestion-engine.ts — Proactive AI Suggestions (Phase 3)
 *
 * After code generation, scans the project files and uses Groq to generate
 * 3-5 actionable improvement suggestions (security, performance, missing features, etc.)
 * Results are cached in Redis for 24 hours.
 */

import { redis } from './redis'
import { callGroq } from '../connectors/groq.connector'

export interface Suggestion {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: 'security' | 'performance' | 'feature' | 'best-practice' | 'testing'
  filePath?: string
  editPrompt?: string  // pre-filled prompt for the Edit chat
}

const SUGGESTIONS_TTL = 86400  // 24 hours

export function suggestionsKey(projectId: string): string {
  return `sabha:suggestions:${projectId}`
}

/**
 * Generate suggestions for a code project.
 * Called in background after generation completes.
 * Results cached in Redis.
 */
export async function generateSuggestions(
  projectId: string,
  files: Array<{ path: string; content: string; language: string }>,
): Promise<Suggestion[]> {
  // Return cached if available
  const cached = await redis.get(suggestionsKey(projectId))
  if (cached) return JSON.parse(cached) as Suggestion[]

  // Build file context (top 8 files, capped at 1500 chars each)
  const topFiles = files.slice(0, 8)
  const fileContext = topFiles
    .map((f) => {
      const content = f.content.length > 1500 ? f.content.slice(0, 1500) + '\n…' : f.content
      return `--- ${f.path} ---\n${content}`
    })
    .join('\n\n')

  const prompt = `You are a senior software engineer reviewing a generated codebase. Analyse these files and provide 4 specific, actionable improvement suggestions.

${fileContext}

Respond ONLY with a JSON array (no markdown, no preamble):
[
  {
    "title": "Short title (max 8 words)",
    "description": "2-sentence explanation of the issue and fix",
    "priority": "high|medium|low",
    "category": "security|performance|feature|best-practice|testing",
    "filePath": "the most relevant file path (optional)",
    "editPrompt": "A ready-to-send edit request the user can click to apply, e.g. 'Add rate limiting middleware to all API routes'"
  }
]

Focus on: missing auth guards, unhandled errors, missing input validation, no tests, performance bottlenecks, security holes, missing env validation. Be specific and actionable.`

  let suggestions: Suggestion[] = []
  try {
    const raw = await callGroq(prompt, { maxTokens: 1200, fast: true })
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const parsed = JSON.parse(cleaned) as Suggestion[]
    suggestions = parsed.slice(0, 5).map((s, i) => ({ ...s, id: `suggestion_${i}` }))
  } catch {
    // On failure, return empty (don't crash the main pipeline)
    return []
  }

  await redis.set(suggestionsKey(projectId), JSON.stringify(suggestions), 'EX', SUGGESTIONS_TTL)
  return suggestions
}

export async function getSuggestions(projectId: string): Promise<Suggestion[] | null> {
  const cached = await redis.get(suggestionsKey(projectId))
  return cached ? (JSON.parse(cached) as Suggestion[]) : null
}
