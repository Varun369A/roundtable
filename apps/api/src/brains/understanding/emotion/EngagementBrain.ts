/**
 * EngagementBrain — Is the user actively engaged or losing interest?
 * Zero API — DB session + task frequency analysis.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface EngagementBrainInput { userId: string }
export interface EngagementBrainOutput {
  engagementLevel: 'low' | 'medium' | 'high'
  daysSinceLastTask: number
  tasksThisWeek: number
  isReturningUser: boolean
}

export class EngagementBrain extends Brain<EngagementBrainInput, EngagementBrainOutput> {
  readonly brainName = 'EngagementBrain'
  readonly orchestratorName = 'EmotionOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: SatisfactionBrainInput, _ctx: BrainContext): Promise<EngagementBrainOutput> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [lastTask, tasksThisWeek] = await Promise.all([
      prisma.task.findFirst({ where: { userId: input.userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.task.count({ where: { userId: input.userId, createdAt: { gte: oneWeekAgo } } }),
    ])

    const daysSinceLastTask = lastTask
      ? Math.floor((Date.now() - lastTask.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 999

    let engagementLevel: 'low' | 'medium' | 'high' = 'medium'
    if (tasksThisWeek >= 5 || daysSinceLastTask === 0) engagementLevel = 'high'
    else if (daysSinceLastTask > 14 || tasksThisWeek === 0) engagementLevel = 'low'

    return { engagementLevel, daysSinceLastTask, tasksThisWeek, isReturningUser: daysSinceLastTask < 30 }
  }

  protected fallback(_: EngagementBrainInput): EngagementBrainOutput {
    return { engagementLevel: 'medium', daysSinceLastTask: 0, tasksThisWeek: 1, isReturningUser: true }
  }
}

// Fix type reference
interface SatisfactionBrainInput { userId: string }
