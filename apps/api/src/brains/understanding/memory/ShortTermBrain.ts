/**
 * ShortTermBrain — Reads this session's context from Redis.
 * Zero external API — Redis read only.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { redis } from '../../../lib/redis'

export interface ShortTermBrainInput { taskId: string; userId: string }
export interface ShortTermBrainOutput {
  sessionContext: Record<string, unknown>
  hasPreviousContext: boolean
  previousSubtaskOutputs: string[]
}

export class ShortTermBrain extends Brain<ShortTermBrainInput, ShortTermBrainOutput> {
  readonly brainName = 'ShortTermBrain'
  readonly orchestratorName = 'MemoryOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: ShortTermBrainInput, _ctx: BrainContext): Promise<ShortTermBrainOutput> {
    const contextKey = `arivarangam:ctx:${input.taskId}`
    const raw = await redis.get(contextKey)

    if (!raw) return { sessionContext: {}, hasPreviousContext: false, previousSubtaskOutputs: [] }

    try {
      const sessionContext = JSON.parse(raw)
      const previousSubtaskOutputs = Array.isArray(sessionContext.outputs)
        ? sessionContext.outputs.map((o: { content?: string }) => o.content || '').filter(Boolean)
        : []
      return { sessionContext, hasPreviousContext: true, previousSubtaskOutputs }
    } catch {
      return { sessionContext: {}, hasPreviousContext: false, previousSubtaskOutputs: [] }
    }
  }

  protected fallback(_: ShortTermBrainInput): ShortTermBrainOutput {
    return { sessionContext: {}, hasPreviousContext: false, previousSubtaskOutputs: [] }
  }
}
