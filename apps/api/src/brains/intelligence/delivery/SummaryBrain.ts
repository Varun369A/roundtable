/**
 * SummaryBrain — Generates a plain-language delivery summary.
 * Uses Groq fast model (small, 200 tokens). Falls back to template.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { callGroq } from '../../../connectors/groq.connector'
import type { PackageManifest } from './PackagingBrain'

export interface SummaryBrainInput {
  goal: string
  packageManifest: PackageManifest
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  overallScore: number
  decision: 'PASS' | 'WARN' | 'FAIL'
  strengths: string[]
  improvements: string[]
  githubUrl: string | null
  previewCommand: string | null
}

export interface SummaryBrainOutput {
  summary: string
  bulletPoints: string[]
  nextSteps: string[]
  readyForProduction: boolean
}

export class SummaryBrain extends Brain<SummaryBrainInput, SummaryBrainOutput> {
  readonly brainName = 'SummaryBrain'
  readonly orchestratorName = 'DeliveryOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = true
  private _tokensUsed = 0

  protected getTokensUsed(): number { return this._tokensUsed }

  protected async process(input: SummaryBrainInput, _ctx: BrainContext): Promise<SummaryBrainOutput> {
    const { goal, packageManifest, qualityGrade, overallScore, decision, strengths, improvements, githubUrl, previewCommand } = input

    const bulletPoints = [
      `${packageManifest.totalFiles} files generated (${packageManifest.totalLinesOfCode} lines of code)`,
      `Quality grade: ${qualityGrade} — ${overallScore}/100`,
      ...(packageManifest.hasTests ? ['Unit tests included'] : []),
      ...(packageManifest.hasDocker ? ['Docker configuration included'] : []),
      ...(githubUrl ? [`Pushed to GitHub: ${githubUrl}`] : []),
    ]

    const nextSteps: string[] = []
    if (previewCommand) nextSteps.push(`Run \`${previewCommand}\` to start locally`)
    if (improvements.length > 0) nextSteps.push(`Address: ${improvements[0]}`)
    if (!packageManifest.hasTests) nextSteps.push('Add tests before going to production')
    nextSteps.push('Review the generated code before deploying')

    const readyForProduction = decision === 'PASS' && qualityGrade !== 'F'

    // Try Groq for a friendly summary
    try {
      const prompt = `Write a 2-3 sentence friendly summary for a user who just had their app built by AI.
Goal: ${goal.slice(0, 120)}
Files: ${packageManifest.totalFiles} (${packageManifest.totalLinesOfCode} lines), Grade: ${qualityGrade} (${overallScore}/100)
Status: ${decision}
Top strength: ${strengths[0] ?? 'Good structure'}
Top improvement: ${improvements[0] ?? 'None critical'}

Be encouraging and specific. Mention what was built and the quality.`

      const summary = await callGroq(prompt, { maxTokens: 200, fast: true })
      this._tokensUsed = 200

      return { summary, bulletPoints, nextSteps, readyForProduction }
    } catch {
      const fallbackSummary = this.buildFallbackSummary(input)
      return { summary: fallbackSummary, bulletPoints, nextSteps, readyForProduction }
    }
  }

  private buildFallbackSummary(input: SummaryBrainInput): string {
    const { packageManifest, qualityGrade, overallScore, decision } = input
    const statusMsg = decision === 'PASS'
      ? 'ready for review'
      : decision === 'WARN'
        ? 'ready with some improvements suggested'
        : 'needs some fixes before deployment'

    return `Generated ${packageManifest.totalFiles} files (${packageManifest.totalLinesOfCode} lines) with quality grade ${qualityGrade} (${overallScore}/100) — ${statusMsg}. Check the quality report for details and follow the next steps to get it running.`
  }

  protected fallback(input: SummaryBrainInput): SummaryBrainOutput {
    return {
      summary: `Generated ${input.packageManifest.totalFiles} files. Grade: ${input.qualityGrade}.`,
      bulletPoints: [],
      nextSteps: ['Review generated code'],
      readyForProduction: false,
    }
  }
}
