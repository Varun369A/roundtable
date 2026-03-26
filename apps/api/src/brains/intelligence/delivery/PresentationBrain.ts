/**
 * PresentationBrain — Formats the final output for display in the UI.
 * Zero API — pure data transformation.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../../build/implementation/FileGeneratorBrain'
import type { PackageManifest } from './PackagingBrain'

export interface PresentationBrainInput {
  allFiles: GeneratedFile[]
  packageManifest: PackageManifest
  reviewSummary: string
  strengths: string[]
  improvements: string[]
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  overallScore: number
  decision: 'PASS' | 'WARN' | 'FAIL'
  previewAvailable: boolean
  devCommand: string | null
  port: number
}

export interface PresentedFile {
  path: string
  content: string
  language: string
  linesOfCode: number
  purpose: string
}

export interface PresentationBrainOutput {
  headline: string
  subheadline: string
  files: PresentedFile[]
  qualityCard: {
    grade: string
    score: number
    decision: string
    color: 'green' | 'yellow' | 'red'
    strengths: string[]
    improvements: string[]
  }
  previewCard: {
    available: boolean
    command: string | null
    url: string | null
  } | null
  fileTree: string
}

export class PresentationBrain extends Brain<PresentationBrainInput, PresentationBrainOutput> {
  readonly brainName = 'PresentationBrain'
  readonly orchestratorName = 'DeliveryOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: PresentationBrainInput, _ctx: BrainContext): Promise<PresentationBrainOutput> {
    const {
      allFiles, packageManifest, reviewSummary, strengths, improvements,
      qualityGrade, overallScore, decision, previewAvailable, devCommand, port,
    } = input

    const gradeMessages: Record<string, string> = {
      A: 'Production-ready code generated',
      B: 'High quality code — minor improvements possible',
      C: 'Good code — review before deploying',
      D: 'Functional code — several issues to address',
      F: 'Draft code — significant work needed',
    }

    const headline = `${packageManifest.projectName} — ${packageManifest.totalFiles} files generated`
    const subheadline = reviewSummary || gradeMessages[qualityGrade] || 'Code generation complete'

    const decisionColor: Record<string, 'green' | 'yellow' | 'red'> = {
      PASS: 'green',
      WARN: 'yellow',
      FAIL: 'red',
    }

    const files: PresentedFile[] = allFiles.map(f => ({
      path: f.path,
      content: f.content,
      language: f.language,
      linesOfCode: f.linesOfCode,
      purpose: f.purpose,
    }))

    // Build ASCII file tree
    const tree = this.buildFileTree(allFiles.map(f => f.path))

    const previewCard = previewAvailable ? {
      available: true,
      command: devCommand,
      url: `http://localhost:${port}`,
    } : null

    return {
      headline,
      subheadline,
      files,
      qualityCard: {
        grade: qualityGrade,
        score: overallScore,
        decision,
        color: decisionColor[decision] ?? 'yellow',
        strengths: strengths.slice(0, 3),
        improvements: improvements.slice(0, 3),
      },
      previewCard,
      fileTree: tree,
    }
  }

  private buildFileTree(paths: string[]): string {
    const dirs = new Map<string, string[]>()
    for (const p of paths) {
      const parts = p.split('/')
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.'
      const file = parts[parts.length - 1]
      if (!dirs.has(dir)) dirs.set(dir, [])
      dirs.get(dir)!.push(file)
    }

    const lines: string[] = ['.']
    const sorted = [...dirs.entries()].sort(([a], [b]) => a.localeCompare(b))
    for (const [dir, files] of sorted) {
      if (dir !== '.') lines.push(`├── ${dir}/`)
      for (const f of files) {
        const prefix = dir === '.' ? '├── ' : '│   ├── '
        lines.push(`${prefix}${f}`)
      }
    }
    return lines.join('\n')
  }

  protected fallback(input: PresentationBrainInput): PresentationBrainOutput {
    return {
      headline: input.packageManifest.projectName,
      subheadline: 'Generation complete',
      files: input.allFiles,
      qualityCard: { grade: 'C', score: 70, decision: 'WARN', color: 'yellow', strengths: [], improvements: [] },
      previewCard: null,
      fileTree: '',
    }
  }
}
