/**
 * KnowledgeExtractionBrain — Extracts reusable knowledge from completed tasks.
 * Zero API — extracts patterns, tech choices, and solutions from task output.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../../build/implementation/FileGeneratorBrain'

export interface KnowledgeExtractionBrainInput {
  taskId: string
  goal: string
  generatedFiles: GeneratedFile[]
  mainTechStack: string[]
  architecturePattern: string
  qualityGrade: string
  overallScore: number
}

export interface ExtractedKnowledge {
  topic: string
  summary: string
  techStack: string[]
  pattern: string
  qualityGrade: string
  fileCount: number
  exampleFilePath: string | null
  tags: string[]
}

export interface KnowledgeExtractionBrainOutput {
  knowledge: ExtractedKnowledge
  shouldStore: boolean
  keywords: string[]
}

export class KnowledgeExtractionBrain extends Brain<KnowledgeExtractionBrainInput, KnowledgeExtractionBrainOutput> {
  readonly brainName = 'KnowledgeExtractionBrain'
  readonly orchestratorName = 'LearningOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: KnowledgeExtractionBrainInput, _ctx: BrainContext): Promise<KnowledgeExtractionBrainOutput> {
    const { taskId, goal, generatedFiles, mainTechStack, architecturePattern, qualityGrade, overallScore } = input

    // Only store knowledge from passing builds
    const shouldStore = overallScore >= 65 && !['F', 'D'].includes(qualityGrade)

    // Extract topic from goal (first 5 words, normalized)
    const topic = goal.split(/\s+/).slice(0, 5).join(' ').toLowerCase()

    // Extract tags from goal + stack
    const tags = [
      ...mainTechStack.map(t => t.toLowerCase()),
      architecturePattern,
      ...this.extractDomainTags(goal),
    ].filter(Boolean)

    const keywords = [
      ...goal.toLowerCase().split(/\W+/).filter(w => w.length > 4),
      ...mainTechStack.map(t => t.toLowerCase()),
    ].slice(0, 20)

    // Find most representative file
    const exampleFile = generatedFiles.find(f =>
      f.path.includes('service') || f.path.includes('controller') || f.path.includes('route')
    ) ?? generatedFiles[0] ?? null

    const knowledge: ExtractedKnowledge = {
      topic,
      summary: goal.slice(0, 200),
      techStack: mainTechStack,
      pattern: architecturePattern,
      qualityGrade,
      fileCount: generatedFiles.length,
      exampleFilePath: exampleFile?.path ?? null,
      tags: [...new Set(tags)],
    }

    return { knowledge, shouldStore, keywords }
  }

  private extractDomainTags(goal: string): string[] {
    const domains: Record<string, string[]> = {
      ecommerce: ['shop', 'cart', 'product', 'checkout', 'order', 'payment'],
      auth: ['login', 'register', 'auth', 'jwt', 'session', 'oauth'],
      api: ['api', 'rest', 'endpoint', 'route', 'graphql'],
      dashboard: ['dashboard', 'admin', 'analytics', 'chart', 'report'],
      database: ['database', 'crud', 'prisma', 'schema', 'migration'],
      realtime: ['realtime', 'websocket', 'socket', 'live', 'chat'],
    }
    const lower = goal.toLowerCase()
    return Object.entries(domains)
      .filter(([, keywords]) => keywords.some(k => lower.includes(k)))
      .map(([domain]) => domain)
  }

  protected fallback(input: KnowledgeExtractionBrainInput): KnowledgeExtractionBrainOutput {
    return {
      knowledge: {
        topic: input.goal.slice(0, 50),
        summary: input.goal,
        techStack: input.mainTechStack,
        pattern: input.architecturePattern,
        qualityGrade: input.qualityGrade,
        fileCount: input.generatedFiles.length,
        exampleFilePath: null,
        tags: [],
      },
      shouldStore: false,
      keywords: [],
    }
  }
}
