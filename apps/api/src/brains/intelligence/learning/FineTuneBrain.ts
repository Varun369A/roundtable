/**
 * FineTuneBrain — Prepares fine-tuning data from high-quality task examples.
 * Zero API — formats task I/O pairs as JSONL training data.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface FineTuneBrainInput {
  batchSize: number
  minQualityScore: number
  format: 'openai' | 'groq' | 'internal'
}

export interface TrainingExample {
  prompt: string
  completion: string
  qualityScore: number
  tags: string[]
}

export interface FineTuneBrainOutput {
  examples: TrainingExample[]
  totalReady: number
  jsonlExport: string
}

export class FineTuneBrain extends Brain<FineTuneBrainInput, FineTuneBrainOutput> {
  readonly brainName = 'FineTuneBrain'
  readonly orchestratorName = 'LearningOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: FineTuneBrainInput, _ctx: BrainContext): Promise<FineTuneBrainOutput> {
    const { batchSize, minQualityScore } = input

    try {
      const entries = await prisma.codeKnowledge.findMany({
        where: { qualityScore: { gte: minQualityScore } },
        orderBy: { qualityScore: 'desc' },
        take: batchSize,
      })

      const examples: TrainingExample[] = entries.map(entry => ({
        prompt: `Build: ${entry.summary}\nStack: ${entry.techStack.join(', ')}\nPattern: ${entry.architecturePattern}`,
        completion: `// Architecture: ${entry.architecturePattern}\n// Files: ${entry.fileCount}\n// Grade: ${entry.qualityGrade}`,
        qualityScore: entry.qualityScore ?? minQualityScore,
        tags: entry.tags,
      }))

      // Format as JSONL
      const jsonlLines = examples.map(ex => JSON.stringify({
        messages: [
          { role: 'user', content: ex.prompt },
          { role: 'assistant', content: ex.completion },
        ],
      }))
      const jsonlExport = jsonlLines.join('\n')

      return {
        examples,
        totalReady: examples.length,
        jsonlExport,
      }
    } catch {
      return { examples: [], totalReady: 0, jsonlExport: '' }
    }
  }

  protected fallback(_: FineTuneBrainInput): FineTuneBrainOutput {
    return { examples: [], totalReady: 0, jsonlExport: '' }
  }
}
