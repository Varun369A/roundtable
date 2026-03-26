/**
 * DatasetBrain — Saves high-quality task outputs as training examples.
 * Zero API — DB write only, builds internal training corpus.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'
import type { ExtractedKnowledge } from './KnowledgeExtractionBrain'

export interface DatasetBrainInput {
  taskId: string
  userId: string
  goal: string
  knowledge: ExtractedKnowledge
  shouldStore: boolean
  keywords: string[]
  overallScore: number
}

export interface DatasetBrainOutput {
  stored: boolean
  datasetEntryId: string | null
  reason: string
}

export class DatasetBrain extends Brain<DatasetBrainInput, DatasetBrainOutput> {
  readonly brainName = 'DatasetBrain'
  readonly orchestratorName = 'LearningOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: DatasetBrainInput, _ctx: BrainContext): Promise<DatasetBrainOutput> {
    const { taskId, userId, goal, knowledge, shouldStore, keywords, overallScore } = input

    if (!shouldStore) {
      return { stored: false, datasetEntryId: null, reason: `Score ${overallScore} below threshold or low grade` }
    }

    try {
      const entry = await prisma.codeKnowledge.upsert({
        where: { taskId },
        create: {
          taskId,
          userId,
          topic: knowledge.topic,
          summary: knowledge.summary,
          techStack: knowledge.techStack,
          architecturePattern: knowledge.pattern,
          qualityGrade: knowledge.qualityGrade,
          qualityScore: overallScore,
          fileCount: knowledge.fileCount,
          exampleFilePath: knowledge.exampleFilePath,
          tags: knowledge.tags,
          keywords,
          usageCount: 0,
        },
        update: {
          usageCount: { increment: 1 },
          qualityScore: overallScore,
        },
      })

      return { stored: true, datasetEntryId: entry.id, reason: 'Stored as training example' }
    } catch {
      return { stored: false, datasetEntryId: null, reason: 'DB write failed' }
    }
  }

  protected fallback(_: DatasetBrainInput): DatasetBrainOutput {
    return { stored: false, datasetEntryId: null, reason: 'Fallback — not stored' }
  }
}
