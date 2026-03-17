/**
 * Error Detector
 *
 * Analyzes AI-generated code output for errors and generates
 * a correction prompt when issues are found.
 *
 * Detection strategies:
 * 1. AI self-report: output contains error markers from the AI itself
 * 2. Unclosed brackets/braces check
 * 3. Common runtime error patterns in the code
 */

export interface ErrorDetectionResult {
  hasErrors: boolean
  errors: string[]
  correctionPrompt?: string
}

// Patterns that indicate the AI output itself contains errors or the AI described errors
const AI_ERROR_PATTERNS = [
  /SyntaxError:/i,
  /TypeError:/i,
  /ReferenceError:/i,
  /cannot find module/i,
  /is not defined/i,
  /unexpected token/i,
  /unexpected end of input/i,
  /missing \)/i,
  /missing \}/i,
  /Error: /,
  /\[ERROR\]/i,
  /compilation failed/i,
  /build failed/i,
]

// Patterns in code that indicate potential issues
const CODE_ISSUE_PATTERNS = [
  { pattern: /TODO:.*fix/i, msg: 'Unfixed TODO comment' },
  { pattern: /FIXME:/i, msg: 'FIXME comment present' },
  { pattern: /throw new Error\(['"]not implemented/i, msg: 'Unimplemented function' },
  { pattern: /console\.error\(/g, msg: 'Error logging detected' },
]

function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = []
  const regex = /```(?:\w+)?\n?([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1])
  }
  return blocks
}

function checkBracketBalance(code: string): string | null {
  let braces = 0, brackets = 0, parens = 0
  let inString = false
  let stringChar = ''

  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    const prev = i > 0 ? code[i - 1] : ''

    if (inString) {
      if (ch === stringChar && prev !== '\\') inString = false
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true
      stringChar = ch
      continue
    }

    if (ch === '{') braces++
    else if (ch === '}') braces--
    else if (ch === '[') brackets++
    else if (ch === ']') brackets--
    else if (ch === '(') parens++
    else if (ch === ')') parens--
  }

  const issues: string[] = []
  if (braces !== 0) issues.push(`${Math.abs(braces)} unmatched curly brace(s)`)
  if (brackets !== 0) issues.push(`${Math.abs(brackets)} unmatched square bracket(s)`)
  if (parens !== 0) issues.push(`${Math.abs(parens)} unmatched parenthesis/es`)

  return issues.length > 0 ? issues.join(', ') : null
}

export function detectErrors(output: string, category: string): ErrorDetectionResult {
  // Only analyze code-related outputs
  if (!['code', 'general'].includes(category)) {
    return { hasErrors: false, errors: [] }
  }

  const errors: string[] = []

  // Check for AI-reported errors in the output text
  for (const pattern of AI_ERROR_PATTERNS) {
    if (pattern.test(output)) {
      errors.push(`Detected: ${pattern.source}`)
      break // one is enough to flag
    }
  }

  // Check code blocks for bracket balance
  const codeBlocks = extractCodeBlocks(output)
  for (const code of codeBlocks) {
    const bracketIssue = checkBracketBalance(code)
    if (bracketIssue) {
      errors.push(`Code structure issue: ${bracketIssue}`)
      break
    }

    // Check for code issues
    for (const { pattern, msg } of CODE_ISSUE_PATTERNS) {
      if (pattern.test(code)) {
        errors.push(msg)
      }
    }
  }

  if (errors.length === 0) {
    return { hasErrors: false, errors: [] }
  }

  const correctionPrompt = buildCorrectionPrompt(output, errors)
  return { hasErrors: true, errors, correctionPrompt }
}

function buildCorrectionPrompt(originalOutput: string, errors: string[]): string {
  return `The following code output contains issues that need to be fixed:

Issues detected:
${errors.map((e) => `- ${e}`).join('\n')}

Original output:
${originalOutput.slice(0, 4000)}

Please provide a corrected, complete version of the code that:
1. Fixes all the detected issues
2. Ensures all brackets, braces, and parentheses are balanced
3. Removes any placeholder TODOs or FIXMEs with proper implementations
4. Returns clean, working, production-ready code with the same structure and purpose`
}
