/**
 * FeedbackProcessorBrain — Processes explicit user feedback (thumbs/corrections) into memory.
 * Zero API — DB read/write for TaskCorrection records.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface FeedbackProcessorBrainInput {
  taskId: string
  userId: string
  feedbackType: 'positive' | 'negative' | 'correction'
  feedbackText?: string
  rating?: number
}

export interface ProcessedFeedback {
  avoidPattern: string | null
  preferPattern: string | null
  sentiment: 'positive' | 'negative' | 'neutral'
  weight: number
}

export interface FeedbackProcessorBrainOutput {
  processed: boolean
  feedback: ProcessedFeedback
  memoryUpdated: boolean
}

export class FeedbackProcessorBrain extends Brain<FeedbackProcessorBrainInput, FeedbackProcessorBrainOutput> {
  readonly brainName = 'FeedbackProcessorBrain'
  readonly orchestratorName = 'LearningOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: FeedbackProcessorBrainInput, _ctx: BrainContext): Promise<FeedbackProcessorBrainOutput> {
    const { taskId, userId, feedbackType, feedbackText, rating } = input

    const sentiment = feedbackType === 'positive' ? 'positive'
      : feedbackType === 'negative' ? 'negative'
        : 'neutral'

    const weight = rating ? rating / 5 : feedbackType === 'positive' ? 0.8 : 0.3

    // Extract avoid/prefer patterns from correction text
    let avoidPattern: string | null = null
    let preferPattern: string | null = null

    if (feedbackText) {
      if (/don't|avoid|stop|no more/.test(feedbackText.toLowerCase())) {
        avoidPattern = feedbackText.slice(0, 100)
      }
      if (/prefer|use|want|like/.test(feedbackText.toLowerCase())) {
        preferPattern = feedbackText.slice(0, 100)
      }
    }

    const feedback: ProcessedFeedback = { avoidPattern, preferPattern, sentiment, weight }

    let memoryUpdated = false
    try {
      await prisma.taskCorrection.create({
        data: {
          taskId,
          userId,
          correctionType: feedbackType,
          correctionText: feedbackText ?? '',
          avoidPattern,
          preferPattern,
          sentiment,
          weight,
        },
      })

      // Update user memory if there's a strong preference
      if ((avoidPattern || preferPattern) && weight >= 0.6) {
        await prisma.userMemory.upsert({
          where: { userId_key: { userId, key: `feedback_${Date.now()}` } },
          create: {
            userId,
            key: `feedback_${Date.now()}`,
            value: feedbackText ?? '',
            type: avoidPattern ? 'avoid_pattern' : 'prefer_pattern',
            confidence: weight,
            source: 'explicit_feedback',
          },
          update: { confidence: weight },
        })
        memoryUpdated = true
      }
    } catch {
      // Non-critical — continue without memory update
    }

    return { processed: true, feedback, memoryUpdated }
  }

  protected fallback(_: FeedbackProcessorBrainInput): FeedbackProcessorBrainOutput {
    return {
      processed: false,
      feedback: { avoidPattern: null, preferPattern: null, sentiment: 'neutral', weight: 0 },
      memoryUpdated: false,
    }
  }
}
