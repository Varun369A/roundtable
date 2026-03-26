/**
 * ReviewBrain — Produces a plain-language code review summary.
 * Uses Groq free tier to synthesize all quality brain outputs into one readable report.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { callGroq } from '../../../connectors/groq.connector'
import type { SecurityIssue } from './SecurityBrain'

export interface ReviewBrainInput {
  securityScore: number
  criticalIssues: SecurityIssue[]
  highIssues: SecurityIssue[]
  performanceScore: number
  consistencyScore: number
  coverageScore: number
  errorHandlingScore: number
  totalFiles: number
  totalLinesOfCode: number
  goal: string
}

export interface ReviewBrainOutput {
  overallScore: number
  summary: string
  strengths: string[]
  improvements: string[]
  readyForProduction: boolean
}

export class ReviewBrain extends Brain<ReviewBrainInput, ReviewBrainOutput> {
  readonly brainName = 'ReviewBrain'
  readonly orchestratorName = 'QualityOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = true
  private _tokensUsed = 0

  protected getTokensUsed(): number { return this._tokensUsed }

  protected async process(input: ReviewBrainInput, _ctx: BrainContext): Promise<ReviewBrainOutput> {
    const { securityScore, performanceScore, consistencyScore, coverageScore, errorHandlingScore } = input
    const overallScore = Math.round((securityScore + performanceScore + consistencyScore + coverageScore + errorHandlingScore) / 5)

    // Build a summary without AI first
    const strengths: string[] = []
    const improvements: string[] = []

    if (securityScore >= 80) strengths.push('Good security posture — no critical vulnerabilities')
    else if (input.criticalIssues.length > 0) improvements.push(`Fix ${input.criticalIssues.length} critical security issue(s): ${input.criticalIssues[0]?.type}`)

    if (performanceScore >= 80) strengths.push('No major performance issues detected')
    else improvements.push('Address performance bottlenecks before deployment')

    if (consistencyScore >= 80) strengths.push('Code is consistent across all files')
    else improvements.push('Fix import/export inconsistencies between files')

    if (coverageScore >= 80) strengths.push(`Requirements coverage is good (${coverageScore}%)`)
    else improvements.push(`${100 - coverageScore}% of requirements may be unaddressed`)

    if (input.totalFiles >= 5) strengths.push(`Generated ${input.totalFiles} files (${input.totalLinesOfCode} lines)`)

    // Try to get AI-generated summary (Groq, fast model, small call)
    try {
      const prompt = `Write a 2-sentence code review summary for this generated codebase.
Goal: ${input.goal.slice(0, 100)}
Scores: Security=${securityScore}, Performance=${performanceScore}, Consistency=${consistencyScore}
Files: ${input.totalFiles} (${input.totalLinesOfCode} lines)
Issues: ${input.criticalIssues.length} critical, ${input.highIssues.length} high

Be direct and specific. Start with the overall quality, then the most important next action.`

      const summary = await callGroq(prompt, { maxTokens: 150, fast: true })
      this._tokensUsed = 150

      return { overallScore, summary, strengths, improvements, readyForProduction: overallScore >= 70 && input.criticalIssues.length === 0 }
    } catch {
      // Fallback summary
      const summary = `Generated ${input.totalFiles} files with overall quality score ${overallScore}/100. ${improvements.length > 0 ? `Key action: ${improvements[0]}` : 'Code looks ready for review.'}`
      return { overallScore, summary, strengths, improvements, readyForProduction: overallScore >= 70 && input.criticalIssues.length === 0 }
    }
  }

  protected fallback(input: ReviewBrainInput): ReviewBrainOutput {
    return { overallScore: 70, summary: 'Code review complete.', strengths: [], improvements: [], readyForProduction: false }
  }
}
