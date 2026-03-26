/**
 * MetricsBrain — Computes and stores system-wide performance metrics.
 * Zero API — DB aggregates.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface MetricsBrainInput {
  taskId: string
  userId: string
  overallScore: number
  totalFiles: number
  totalLinesOfCode: number
  processingTimeMs: number
  brainExecutions: number
  tokensUsed: number
  retryCount: number
}

export interface SystemMetrics {
  averageQualityScore: number
  averageFilesPerTask: number
  averageProcessingTimeMs: number
  totalTasksToday: number
  successRate: number
  averageRetries: number
}

export interface MetricsBrainOutput {
  recorded: boolean
  systemMetrics: SystemMetrics
  userRank: 'top10' | 'top25' | 'average' | 'below'
}

export class MetricsBrain extends Brain<MetricsBrainInput, MetricsBrainOutput> {
  readonly brainName = 'MetricsBrain'
  readonly orchestratorName = 'LearningOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: MetricsBrainInput, _ctx: BrainContext): Promise<MetricsBrainOutput> {
    const {
      taskId, userId, overallScore, totalFiles, totalLinesOfCode,
      processingTimeMs, brainExecutions, tokensUsed, retryCount,
    } = input

    try {
      // Record brain execution metrics
      await prisma.brainExecution.create({
        data: {
          taskId,
          userId,
          engineName: 'IntelligenceEngine',
          orchestratorName: 'MetricsBrain',
          brainName: 'MetricsBrain',
          inputHash: `${taskId}-metrics`,
          outputSummary: `score:${overallScore},files:${totalFiles}`,
          durationMs: processingTimeMs,
          tokensUsed,
          retryCount,
          success: true,
        },
      })

      // Aggregate system metrics (last 24h)
      const since = new Date(Date.now() - 86400000)
      const recentTasks = await prisma.task.findMany({
        where: { createdAt: { gte: since }, status: 'completed' },
        select: { qualityScore: true, metadata: true },
        take: 100,
      })

      const scores = recentTasks.map(t => t.qualityScore ?? 70)
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 70

      const systemMetrics: SystemMetrics = {
        averageQualityScore: Math.round(avgScore),
        averageFilesPerTask: Math.round(totalFiles),
        averageProcessingTimeMs: processingTimeMs,
        totalTasksToday: recentTasks.length,
        successRate: scores.filter(s => s >= 65).length / Math.max(scores.length, 1),
        averageRetries: retryCount,
      }

      // Determine user rank
      const userRank: MetricsBrainOutput['userRank'] =
        overallScore >= avgScore + 15 ? 'top10' :
          overallScore >= avgScore + 5 ? 'top25' :
            overallScore >= avgScore - 10 ? 'average' : 'below'

      return { recorded: true, systemMetrics, userRank }
    } catch {
      return {
        recorded: false,
        systemMetrics: {
          averageQualityScore: 70,
          averageFilesPerTask: totalFiles,
          averageProcessingTimeMs: processingTimeMs,
          totalTasksToday: 0,
          successRate: overallScore >= 65 ? 1 : 0,
          averageRetries: retryCount,
        },
        userRank: 'average',
      }
    }
  }

  protected fallback(_: MetricsBrainInput): MetricsBrainOutput {
    return {
      recorded: false,
      systemMetrics: { averageQualityScore: 70, averageFilesPerTask: 0, averageProcessingTimeMs: 0, totalTasksToday: 0, successRate: 0, averageRetries: 0 },
      userRank: 'average',
    }
  }
}
