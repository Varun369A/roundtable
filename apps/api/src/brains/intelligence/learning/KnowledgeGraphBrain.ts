/**
 * KnowledgeGraphBrain — Builds a relationship graph between tech stacks, patterns, and outcomes.
 * Zero API — in-memory graph construction from DB data.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface KnowledgeGraphBrainInput {
  userId: string
  currentTechStack: string[]
  currentPattern: string
}

export interface KnowledgeEdge {
  from: string
  to: string
  weight: number
  relationship: 'pairs-with' | 'leads-to' | 'conflicts-with'
}

export interface KnowledgeGraphBrainOutput {
  nodes: string[]
  edges: KnowledgeEdge[]
  stackRecommendations: string[]
  conflictWarnings: string[]
}

export class KnowledgeGraphBrain extends Brain<KnowledgeGraphBrainInput, KnowledgeGraphBrainOutput> {
  readonly brainName = 'KnowledgeGraphBrain'
  readonly orchestratorName = 'LearningOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  // Known good pairings
  private readonly goodPairs: Array<[string, string]> = [
    ['nextjs', 'prisma'],
    ['nextjs', 'tailwind'],
    ['fastify', 'prisma'],
    ['express', 'mongoose'],
    ['react', 'react-query'],
    ['nextjs', 'zod'],
    ['nestjs', 'prisma'],
    ['trpc', 'prisma'],
    ['trpc', 'nextjs'],
  ]

  // Known conflicts
  private readonly conflicts: Array<[string, string]> = [
    ['mongoose', 'prisma'],
    ['graphql', 'trpc'],
    ['nextjs', 'express'], // usually one or the other
    ['sqlite', 'production'],
  ]

  protected async process(input: KnowledgeGraphBrainInput, _ctx: BrainContext): Promise<KnowledgeGraphBrainOutput> {
    const { currentTechStack } = input
    const stack = currentTechStack.map(t => t.toLowerCase())

    const nodes = [...new Set([...stack])]
    const edges: KnowledgeEdge[] = []

    // Build edges from known pairings
    for (const [a, b] of this.goodPairs) {
      if (stack.includes(a) || stack.includes(b)) {
        edges.push({ from: a, to: b, weight: 0.9, relationship: 'pairs-with' })
      }
    }

    // Build conflict edges
    const conflictWarnings: string[] = []
    for (const [a, b] of this.conflicts) {
      if (stack.includes(a) && stack.includes(b)) {
        edges.push({ from: a, to: b, weight: -0.8, relationship: 'conflicts-with' })
        conflictWarnings.push(`${a} and ${b} are typically not used together`)
      }
    }

    // Recommend additions based on stack
    const stackRecommendations: string[] = []
    if (stack.includes('nextjs') && !stack.includes('prisma')) {
      stackRecommendations.push('Consider adding Prisma — pairs very well with Next.js')
    }
    if (stack.includes('express') && !stack.includes('zod')) {
      stackRecommendations.push('Consider Zod for runtime validation in your Express app')
    }
    if (stack.includes('react') && !stack.includes('react-query') && !stack.includes('trpc')) {
      stackRecommendations.push('Consider React Query for server state management')
    }

    // Enrich with DB if available
    try {
      const similar = await prisma.codeKnowledge.findMany({
        where: {
          techStack: { hasSome: currentTechStack.slice(0, 3) },
          qualityScore: { gte: 75 },
        },
        select: { techStack: true },
        take: 20,
      })

      const coOccurrence = new Map<string, number>()
      for (const entry of similar) {
        for (const tech of entry.techStack) {
          if (!stack.includes(tech.toLowerCase())) {
            coOccurrence.set(tech, (coOccurrence.get(tech) ?? 0) + 1)
          }
        }
      }

      const topCoOccurrences = [...coOccurrence.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([tech]) => tech)

      for (const tech of topCoOccurrences) {
        stackRecommendations.push(`${tech} often appears in high-quality projects with your stack`)
      }
    } catch {
      // DB enrichment is optional
    }

    return {
      nodes,
      edges,
      stackRecommendations: stackRecommendations.slice(0, 3),
      conflictWarnings,
    }
  }

  protected fallback(_: KnowledgeGraphBrainInput): KnowledgeGraphBrainOutput {
    return { nodes: [], edges: [], stackRecommendations: [], conflictWarnings: [] }
  }
}
