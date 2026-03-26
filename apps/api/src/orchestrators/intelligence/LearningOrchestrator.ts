/**
 * LearningOrchestrator — Runs 9 Learning brains: KnowledgeExtraction → PatternDiscovery
 *                        → Dataset → FeedbackProcessor → Improvement → KnowledgeGraph
 *                        → FineTune → Metrics → Versioning
 */

import { Orchestrator } from '../base/Orchestrator'
import type { OrchestratorInput } from '../base/Orchestrator'
import type { Brain } from '../../brains/base/Brain'
import {
  KnowledgeExtractionBrain,
  PatternDiscoveryBrain,
  DatasetBrain,
  FeedbackProcessorBrain,
  ImprovementBrain,
  KnowledgeGraphBrain,
  FineTuneBrain,
  MetricsBrain,
  VersioningBrain,
} from '../../brains/intelligence/learning'

export class LearningOrchestrator extends Orchestrator {
  readonly orchestratorName = 'LearningOrchestrator'
  readonly engineName = 'IntelligenceEngine'

  protected getBrains(): Array<Brain<unknown, unknown>> {
    return [
      new KnowledgeExtractionBrain(),
      new PatternDiscoveryBrain(),
      new DatasetBrain(),
      new FeedbackProcessorBrain(),
      new ImprovementBrain(),
      new KnowledgeGraphBrain(),
      new FineTuneBrain(),
      new MetricsBrain(),
      new VersioningBrain(),
    ]
  }

  protected buildBrainInput(brainName: string, accumulated: Record<string, unknown>, input: OrchestratorInput): unknown {
    const implOutput = input.previousEngineOutputs?.['ImplementationOrchestrator'] as Record<string, unknown> | undefined
    const archOutput = input.previousEngineOutputs?.['ArchitectureOrchestrator'] as Record<string, unknown> | undefined
    const qualityOutput = input.previousEngineOutputs?.['QualityOrchestrator'] as Record<string, unknown> | undefined
    const deliveryOutput = input.previousEngineOutputs?.['DeliveryOrchestrator'] as Record<string, unknown> | undefined
    const errorOutput = input.previousEngineOutputs?.['ErrorOrchestrator'] as Record<string, unknown> | undefined

    const generatedFiles = (implOutput?.['FileGeneratorBrain'] as { generatedFiles?: unknown[] })?.generatedFiles ?? []
    const mainTechStack = (archOutput?.['DependencyBrain'] as { mainTechStack?: string[] })?.mainTechStack ?? []
    const architecturePattern = (archOutput?.['ArchitectureBrain'] as { pattern?: string })?.pattern ?? 'api-only'
    const overallScore = (qualityOutput?.['ReviewBrain'] as { overallScore?: number })?.overallScore ?? 70
    const qualityGrade = (qualityOutput?.['GateBrain'] as { qualityGrade?: string })?.qualityGrade ?? 'C'
    const retryCount = (input.previousEngineOutputs?.['retryCount'] as number) ?? 0
    const allFiles = (deliveryOutput?.['PackagingBrain'] as { allFiles?: unknown[] })?.allFiles ?? generatedFiles

    const extraction = accumulated['KnowledgeExtractionBrain'] as Record<string, unknown> | undefined
    const patterns = accumulated['PatternDiscoveryBrain'] as Record<string, unknown> | undefined

    switch (brainName) {
      case 'KnowledgeExtractionBrain':
        return {
          taskId: input.taskId,
          goal: input.goal,
          generatedFiles,
          mainTechStack,
          architecturePattern,
          qualityGrade,
          overallScore,
        }

      case 'PatternDiscoveryBrain':
        return {
          userId: input.userId,
          currentTechStack: mainTechStack,
          currentPattern: architecturePattern,
          windowDays: 30,
        }

      case 'DatasetBrain':
        return {
          taskId: input.taskId,
          userId: input.userId,
          goal: input.goal,
          knowledge: extraction?.['knowledge'] ?? {},
          shouldStore: (extraction?.['shouldStore'] as boolean) ?? false,
          keywords: (extraction?.['keywords'] as string[]) ?? [],
          overallScore,
        }

      case 'FeedbackProcessorBrain':
        // FeedbackProcessor runs passively — no active feedback in code generation flow
        return {
          taskId: input.taskId,
          userId: input.userId,
          feedbackType: 'positive' as const,
          rating: Math.round(overallScore / 20),
        }

      case 'ImprovementBrain':
        return {
          userId: input.userId,
          currentScore: overallScore,
          currentGrade: qualityGrade,
          topPatterns: (patterns?.['topPatterns'] as unknown[]) ?? [],
          systemicIssues: (errorOutput?.['DiagnosticBrain'] as { systemicIssues?: string[] })?.systemicIssues ?? [],
        }

      case 'KnowledgeGraphBrain':
        return {
          userId: input.userId,
          currentTechStack: mainTechStack,
          currentPattern: architecturePattern,
        }

      case 'FineTuneBrain':
        return { batchSize: 20, minQualityScore: 75, format: 'internal' as const }

      case 'MetricsBrain':
        return {
          taskId: input.taskId,
          userId: input.userId,
          overallScore,
          totalFiles: allFiles.length,
          totalLinesOfCode: (allFiles as { linesOfCode?: number }[]).reduce((s, f) => s + (f.linesOfCode ?? 0), 0),
          processingTimeMs: 0, // will be computed by engine
          brainExecutions: 81,
          tokensUsed: (input.previousEngineOutputs?.['totalTokensUsed'] as number) ?? 0,
          retryCount,
        }

      case 'VersioningBrain':
        return {
          taskId: input.taskId,
          userId: input.userId,
          retryCount,
          overallScore,
          allFiles,
          qualityGrade,
        }

      default:
        return { goal: input.goal, userId: input.userId, taskId: input.taskId, ...accumulated }
    }
  }
}
