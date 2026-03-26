/**
 * FeedbackMemoryBrain — Reads what the user criticized or praised before.
 * Zero API — DB read of TaskCorrection records.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface FeedbackMemoryBrainInput { userId: string }
export interface FeedbackMemoryBrainOutput {
  commonComplaints: string[]
  avoidPatterns: string[]
  preferredApproaches: string[]
  totalFeedbackGiven: number
}

export class FeedbackMemoryBrain extends Brain<FeedbackMemoryBrainInput, FeedbackMemoryBrainOutput> {
  readonly brainName = 'FeedbackMemoryBrain'
  readonly orchestratorName = 'MemoryOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: FeedbackMemoryBrainInput, _ctx: BrainContext): Promise<FeedbackMemoryBrainOutput> {
    const corrections = await prisma.taskCorrection.findMany({
      where: { task: { userId: input.userId } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { description: true },
    })

    const instructions = corrections.map(c => c.description.toLowerCase())
    const totalFeedbackGiven = corrections.length

    // Pattern detection in correction messages
    const avoidPatterns: string[] = []
    const preferredApproaches: string[] = []
    const commonComplaints: string[] = []

    for (const instruction of instructions) {
      if (/don't|avoid|no |remove|without/i.test(instruction)) {
        avoidPatterns.push(instruction.slice(0, 80))
      } else if (/use|prefer|always|should|need/i.test(instruction)) {
        preferredApproaches.push(instruction.slice(0, 80))
      } else {
        commonComplaints.push(instruction.slice(0, 80))
      }
    }

    return {
      commonComplaints: [...new Set(commonComplaints)].slice(0, 5),
      avoidPatterns: [...new Set(avoidPatterns)].slice(0, 5),
      preferredApproaches: [...new Set(preferredApproaches)].slice(0, 5),
      totalFeedbackGiven,
    }
  }

  protected fallback(_: FeedbackMemoryBrainInput): FeedbackMemoryBrainOutput {
    return { commonComplaints: [], avoidPatterns: [], preferredApproaches: [], totalFeedbackGiven: 0 }
  }
}
