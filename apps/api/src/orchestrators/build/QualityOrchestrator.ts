/**
 * QualityOrchestrator — Runs 9 Quality brains: Security → Testing → Performance
 *                       → Accessibility → Compliance → Coverage → EdgeCase → Review → Gate
 */

import { Orchestrator } from '../base/Orchestrator'
import type { OrchestratorInput } from '../base/Orchestrator'
import type { Brain } from '../../brains/base/Brain'
import {
  SecurityBrain,
  TestingBrain,
  PerformanceBrain,
  AccessibilityBrain,
  ComplianceBrain,
  CoverageBrain,
  EdgeCaseBrain,
  ReviewBrain,
  GateBrain,
} from '../../brains/build/quality'

export class QualityOrchestrator extends Orchestrator {
  readonly orchestratorName = 'QualityOrchestrator'
  readonly engineName = 'BuildEngine'

  protected getBrains(): Array<Brain<unknown, unknown>> {
    return [
      new SecurityBrain(),
      new TestingBrain(),
      new PerformanceBrain(),
      new AccessibilityBrain(),
      new ComplianceBrain(),
      new CoverageBrain(),
      new EdgeCaseBrain(),
      new ReviewBrain(),
      new GateBrain(),
    ]
  }

  protected buildBrainInput(brainName: string, accumulated: Record<string, unknown>, input: OrchestratorInput): unknown {
    const implOutput = input.previousEngineOutputs?.['ImplementationOrchestrator'] as Record<string, unknown> | undefined
    const archOutput = input.previousEngineOutputs?.['ArchitectureOrchestrator'] as Record<string, unknown> | undefined
    const intentOutput = input.previousEngineOutputs?.['IntentOrchestrator'] as Record<string, unknown> | undefined

    const generatedFiles = (implOutput?.['FileGeneratorBrain'] as { generatedFiles?: unknown[] })?.generatedFiles ?? []
    const apiEndpoints = (archOutput?.['APIBrain'] as { endpoints?: unknown[] })?.endpoints ?? []
    const requirements = (archOutput?.['RequirementsBrain'] as { requirements?: unknown[] })?.requirements ?? []
    const hasAuth = (archOutput?.['PatternBrain'] as { authPattern?: string })?.authPattern !== 'none'
    const domain = (intentOutput?.['ContextBrain'] as { domain?: string })?.domain ?? 'general'

    const security = accumulated['SecurityBrain'] as Record<string, unknown> | undefined
    const performance = accumulated['PerformanceBrain'] as Record<string, unknown> | undefined
    const consistency = (implOutput?.['ConsistencyBrain'] as { consistencyScore?: number })?.consistencyScore ?? 80
    const coverage = accumulated['CoverageBrain'] as Record<string, unknown> | undefined
    const auth = accumulated['ReviewBrain'] as Record<string, unknown> | undefined // placeholder
    const edgeCase = accumulated['EdgeCaseBrain'] as Record<string, unknown> | undefined
    const integration = (implOutput?.['IntegrationBrain'] as { integrationPassed?: boolean })?.integrationPassed ?? true

    switch (brainName) {
      case 'SecurityBrain':
        return { generatedFiles, hasAuth }

      case 'TestingBrain':
        return { endpoints: apiEndpoints, projectName: input.goal.split(' ').slice(0, 3).join('-') }

      case 'PerformanceBrain':
        return { generatedFiles }

      case 'AccessibilityBrain':
        return { generatedFiles }

      case 'ComplianceBrain':
        return { generatedFiles, domain, hasAuth }

      case 'CoverageBrain':
        return { generatedFiles, requirements }

      case 'EdgeCaseBrain':
        return { generatedFiles }

      case 'ReviewBrain':
        return {
          securityScore: (security?.['securityScore'] as number) ?? 80,
          criticalIssues: (security?.['criticalIssues'] as unknown[]) ?? [],
          highIssues: (security?.['highIssues'] as unknown[]) ?? [],
          performanceScore: (performance?.['performanceScore'] as number) ?? 80,
          consistencyScore: consistency,
          coverageScore: (coverage?.['coverageScore'] as number) ?? 75,
          errorHandlingScore: (implOutput?.['ErrorHandlingBrain'] as { errorHandlingScore?: number })?.errorHandlingScore ?? 75,
          totalFiles: generatedFiles.length,
          totalLinesOfCode: (generatedFiles as { linesOfCode?: number }[]).reduce((s, f) => s + (f.linesOfCode ?? 0), 0),
          goal: input.goal,
        }

      case 'GateBrain': {
        const review = accumulated['ReviewBrain'] as Record<string, unknown> | undefined
        return {
          overallScore: (review?.['overallScore'] as number) ?? 70,
          securityScore: (security?.['securityScore'] as number) ?? 80,
          criticalIssues: (security?.['criticalIssues'] as unknown[]) ?? [],
          coverageScore: (coverage?.['coverageScore'] as number) ?? 75,
          consistencyScore: consistency,
          integrationPassed: integration,
          authScore: hasAuth ? 80 : 100,
          hasAuthRequirement: hasAuth,
        }
      }

      default:
        return { goal: input.goal, userId: input.userId, taskId: input.taskId, ...accumulated }
    }
  }
}
