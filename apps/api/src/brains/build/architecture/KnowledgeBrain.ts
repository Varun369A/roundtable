/**
 * KnowledgeBrain — Finds similar past solutions in the knowledge base.
 * Zero external API — PostgreSQL + semantic pattern matching.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'
import type { TaskCategory } from '../../understanding/intent/IntentBrain'

export interface KnowledgeBrainInput {
  goal: string
  primaryCategory: TaskCategory
  mainTechStack: string[]
  domain: string
}

export interface KnowledgeItem {
  id: string
  summary: string
  category: string
  qualityScore: number
  relevance: number
}

export interface KnowledgeBrainOutput {
  similarSolutions: KnowledgeItem[]
  coverageScore: number      // 0-100 how much we already know
  knowledgeGaps: string[]    // what we don't have in knowledge base
  hasHighQualityMatch: boolean
}

export class KnowledgeBrain extends Brain<KnowledgeBrainInput, KnowledgeBrainOutput> {
  readonly brainName = 'KnowledgeBrain'
  readonly orchestratorName = 'ArchitectureOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: KnowledgeBrainInput, _ctx: BrainContext): Promise<KnowledgeBrainOutput> {
    const { primaryCategory, mainTechStack } = input

    // Find high-quality past solutions from code knowledge base
    const knowledgeItems = await prisma.codeKnowledge.findMany({
      where: {
        qualityScore: { gte: 70 },
      },
      orderBy: { qualityScore: 'desc' },
      take: 10,
      select: { id: true, summary: true, tags: true, qualityScore: true, techStack: true },
    })

    // Simple keyword relevance scoring
    const goalWords = input.goal.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const similarSolutions: KnowledgeItem[] = knowledgeItems.map(item => {
      const summaryWords = item.summary.toLowerCase()
      const matchingWords = goalWords.filter(w => summaryWords.includes(w)).length
      const relevance = Math.min(100, (matchingWords / Math.max(1, goalWords.length)) * 100)

      return {
        id: item.id,
        summary: item.summary.slice(0, 200),
        category: item.tags[0] ?? 'general',
        qualityScore: item.qualityScore / 100, // normalize to 0-1
        relevance: Math.round(relevance),
      }
    }).filter(s => s.relevance > 20)
      .sort((a, b) => b.relevance - a.relevance)

    const coverageScore = similarSolutions.length > 0
      ? Math.round(similarSolutions[0].relevance * similarSolutions[0].qualityScore * 100)
      : 0

    const hasHighQualityMatch = similarSolutions.some(s => s.relevance > 60 && s.qualityScore >= 0.8)

    // Identify knowledge gaps (what stack elements we haven't seen before)
    const knowledgeGaps: string[] = []
    if (primaryCategory === 'code' && mainTechStack.length > 0) {
      // Check if we have knowledge for this stack
      const stackStr = mainTechStack.join(' ').toLowerCase()
      if (!stackStr.includes('react') && !stackStr.includes('next')) {
        knowledgeGaps.push('Limited examples for this specific tech stack')
      }
    }

    return { similarSolutions, coverageScore, knowledgeGaps, hasHighQualityMatch }
  }

  protected fallback(_: KnowledgeBrainInput): KnowledgeBrainOutput {
    return { similarSolutions: [], coverageScore: 0, knowledgeGaps: [], hasHighQualityMatch: false }
  }
}
