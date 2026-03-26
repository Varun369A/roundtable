/**
 * LongTermBrain — Reads user's structured long-term memory from PostgreSQL.
 * Zero external API — DB read only.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface LongTermBrainInput { userId: string }
export interface LongTermBrainOutput {
  memories: MemoryEntry[]
  memoryContext: string   // formatted string ready to inject into prompts
  totalMemories: number
}

export interface MemoryEntry {
  key: string
  value: string
  category: string
  confidence: number
  source: string
}

export class LongTermBrain extends Brain<LongTermBrainInput, LongTermBrainOutput> {
  readonly brainName = 'LongTermBrain'
  readonly orchestratorName = 'MemoryOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: LongTermBrainInput, _ctx: BrainContext): Promise<LongTermBrainOutput> {
    const memories = await prisma.userMemory.findMany({
      where: { userId: input.userId, isActive: true, confidence: { gte: 0.4 } },
      orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }],
      take: 30,
    })

    const entries: MemoryEntry[] = memories.map(m => ({
      key: m.key,
      value: m.value,
      category: m.category,
      confidence: m.confidence,
      source: m.source,
    }))

    // Format into prompt-injectable string
    const grouped: Record<string, MemoryEntry[]> = {}
    for (const entry of entries) {
      if (!grouped[entry.category]) grouped[entry.category] = []
      grouped[entry.category].push(entry)
    }

    const lines: string[] = ['## User Context']
    for (const [category, items] of Object.entries(grouped)) {
      lines.push(`### ${category}`)
      for (const item of items) {
        lines.push(`- ${item.key}: ${item.value}`)
      }
    }
    const memoryContext = lines.join('\n')

    return { memories: entries, memoryContext, totalMemories: entries.length }
  }

  protected fallback(_: LongTermBrainInput): LongTermBrainOutput {
    return { memories: [], memoryContext: '', totalMemories: 0 }
  }
}
