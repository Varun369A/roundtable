/**
 * ErrorOrchestrator — Runs 9 Error brains: Detection → Classification → Diagnostic
 *                     → Recovery → Retry → Fallback → FixGenerator → Escalation → Explainer
 */

import { Orchestrator } from '../base/Orchestrator'
import type { OrchestratorInput } from '../base/Orchestrator'
import type { Brain } from '../../brains/base/Brain'
import {
  ErrorDetectionBrain,
  ErrorClassificationBrain,
  DiagnosticBrain,
  RecoveryBrain,
  RetryBrain,
  FallbackBrain,
  FixGeneratorBrain,
  EscalationBrain,
  ExplainerBrain,
} from '../../brains/intelligence/error'

export class ErrorOrchestrator extends Orchestrator {
  readonly orchestratorName = 'ErrorOrchestrator'
  readonly engineName = 'IntelligenceEngine'

  protected getBrains(): Array<Brain<unknown, unknown>> {
    return [
      new ErrorDetectionBrain(),
      new ErrorClassificationBrain(),
      new DiagnosticBrain(),
      new RecoveryBrain(),
      new RetryBrain(),
      new FallbackBrain(),
      new FixGeneratorBrain(),
      new EscalationBrain(),
      new ExplainerBrain(),
    ]
  }

  protected buildBrainInput(brainName: string, accumulated: Record<string, unknown>, input: OrchestratorInput): unknown {
    const implOutput = input.previousEngineOutputs?.['ImplementationOrchestrator'] as Record<string, unknown> | undefined
    const qualityOutput = input.previousEngineOutputs?.['QualityOrchestrator'] as Record<string, unknown> | undefined
    const intentOutput = input.previousEngineOutputs?.['IntentOrchestrator'] as Record<string, unknown> | undefined
    const archOutput = input.previousEngineOutputs?.['ArchitectureOrchestrator'] as Record<string, unknown> | undefined

    const generatedFiles = (implOutput?.['FileGeneratorBrain'] as { generatedFiles?: unknown[] })?.generatedFiles ?? []
    const overallScore = (qualityOutput?.['ReviewBrain'] as { overallScore?: number })?.overallScore ?? 70
    const mainTechStack = (archOutput?.['DependencyBrain'] as { mainTechStack?: string[] })?.mainTechStack ?? []
    const retryCount = (input.previousEngineOutputs?.['retryCount'] as number) ?? 0

    const detection = accumulated['ErrorDetectionBrain'] as Record<string, unknown> | undefined
    const classification = accumulated['ErrorClassificationBrain'] as Record<string, unknown> | undefined
    const diagnostic = accumulated['DiagnosticBrain'] as Record<string, unknown> | undefined
    const recovery = accumulated['RecoveryBrain'] as Record<string, unknown> | undefined
    const retry = accumulated['RetryBrain'] as Record<string, unknown> | undefined
    const fixGen = accumulated['FixGeneratorBrain'] as Record<string, unknown> | undefined
    const escalation = accumulated['EscalationBrain'] as Record<string, unknown> | undefined

    switch (brainName) {
      case 'ErrorDetectionBrain':
        return { generatedFiles }

      case 'ErrorClassificationBrain':
        return {
          errors: (detection?.['errors'] as unknown[]) ?? [],
          goal: input.goal,
          isCodeTask: (intentOutput?.['IntentBrain'] as { isCodeTask?: boolean })?.isCodeTask ?? true,
        }

      case 'DiagnosticBrain':
        return {
          classified: (classification?.['classified'] as unknown[]) ?? [],
          overallScore,
          totalFiles: generatedFiles.length,
        }

      case 'RecoveryBrain':
        return {
          classified: (classification?.['classified'] as unknown[]) ?? [],
          diagnoses: (diagnostic?.['diagnoses'] as unknown[]) ?? [],
          systemicIssues: (diagnostic?.['systemicIssues'] as string[]) ?? [],
          canRetry: retryCount < 3,
          retryCount,
        }

      case 'RetryBrain':
        return {
          shouldRetry: (recovery?.['shouldRetry'] as boolean) ?? false,
          retryCount,
          retryInstructions: (recovery?.['retryInstructions'] as string[]) ?? [],
          healthScore: (diagnostic?.['healthScore'] as number) ?? overallScore,
          originalGoal: input.goal,
          failedFilePaths: (detection?.['errors'] as { file: string }[])?.map(e => e.file) ?? [],
        }

      case 'FallbackBrain':
        return {
          goal: input.goal,
          mainTechStack,
          projectName: input.goal.split(/\s+/).slice(0, 4).join(' '),
          maxRetriesReached: (retry?.['maxRetriesReached'] as boolean) ?? false,
          healthScore: (diagnostic?.['healthScore'] as number) ?? overallScore,
        }

      case 'FixGeneratorBrain':
        return {
          autoFixable: (recovery?.['autoFixable'] as unknown[]) ?? [],
          generatedFiles,
        }

      case 'EscalationBrain':
        return {
          taskId: input.taskId,
          userId: input.userId,
          goal: input.goal,
          healthScore: (diagnostic?.['healthScore'] as number) ?? overallScore,
          diagnoses: (diagnostic?.['diagnoses'] as unknown[]) ?? [],
          systemicIssues: (diagnostic?.['systemicIssues'] as string[]) ?? [],
          retryCount,
          maxRetriesReached: (retry?.['maxRetriesReached'] as boolean) ?? false,
        }

      case 'ExplainerBrain':
        return {
          errors: (classification?.['classified'] as unknown[]) ?? [],
          diagnoses: (diagnostic?.['diagnoses'] as unknown[]) ?? [],
          healthScore: (diagnostic?.['healthScore'] as number) ?? overallScore,
          fixCount: (fixGen?.['fixCount'] as number) ?? 0,
          escalated: (escalation?.['escalated'] as boolean) ?? false,
          userMessage: (escalation?.['userMessage'] as string) ?? '',
        }

      default:
        return { goal: input.goal, userId: input.userId, taskId: input.taskId, ...accumulated }
    }
  }
}
