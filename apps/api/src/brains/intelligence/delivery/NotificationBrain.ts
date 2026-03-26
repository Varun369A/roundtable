/**
 * NotificationBrain — Builds SSE event payloads for live progress updates.
 * Zero API — pure event formatting.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { PackageManifest } from './PackagingBrain'

export interface NotificationBrainInput {
  taskId: string
  userId: string
  projectName: string
  packageManifest: PackageManifest
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  overallScore: number
  decision: 'PASS' | 'WARN' | 'FAIL'
  previewAvailable: boolean
  devCommand: string | null
  port: number
  reviewSummary: string
}

export interface SSEEvent {
  event: string
  data: Record<string, unknown>
}

export interface NotificationBrainOutput {
  completionEvent: SSEEvent
  statsEvent: SSEEvent
  events: SSEEvent[]
}

export class NotificationBrain extends Brain<NotificationBrainInput, NotificationBrainOutput> {
  readonly brainName = 'NotificationBrain'
  readonly orchestratorName = 'DeliveryOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: NotificationBrainInput, _ctx: BrainContext): Promise<NotificationBrainOutput> {
    const {
      taskId, userId, projectName, packageManifest,
      qualityGrade, overallScore, decision, previewAvailable, devCommand, port, reviewSummary,
    } = input

    const completionEvent: SSEEvent = {
      event: 'task:complete',
      data: {
        taskId,
        userId,
        projectName,
        status: decision === 'FAIL' ? 'failed' : 'complete',
        qualityGrade,
        overallScore,
        totalFiles: packageManifest.totalFiles,
        totalLines: packageManifest.totalLinesOfCode,
        previewAvailable,
        devCommand,
        port,
        message: reviewSummary,
        timestamp: new Date().toISOString(),
      },
    }

    const statsEvent: SSEEvent = {
      event: 'task:stats',
      data: {
        taskId,
        filesByType: packageManifest.fileList.reduce<Record<string, number>>((acc, f) => {
          acc[f.language] = (acc[f.language] ?? 0) + 1
          return acc
        }, {}),
        hasTests: packageManifest.hasTests,
        hasDocker: packageManifest.hasDocker,
        hasApiDocs: packageManifest.hasApiDocs,
        generatedAt: packageManifest.generatedAt,
      },
    }

    const gradeEmoji: Record<string, string> = { A: '⭐', B: '✅', C: '👍', D: '⚠️', F: '❌' }
    const gradeMessage = `Quality grade ${qualityGrade} ${gradeEmoji[qualityGrade] ?? ''} — ${overallScore}/100`

    const progressEvent: SSEEvent = {
      event: 'task:progress',
      data: {
        taskId,
        step: 'delivery',
        message: gradeMessage,
        progress: 100,
      },
    }

    return {
      completionEvent,
      statsEvent,
      events: [progressEvent, statsEvent, completionEvent],
    }
  }

  protected fallback(input: NotificationBrainInput): NotificationBrainOutput {
    const ev: SSEEvent = {
      event: 'task:complete',
      data: { taskId: input.taskId, status: 'complete', message: 'Done' },
    }
    return { completionEvent: ev, statsEvent: ev, events: [ev] }
  }
}
