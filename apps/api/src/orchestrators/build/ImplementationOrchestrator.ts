/**
 * ImplementationOrchestrator — Runs 9 Implementation brains: FileGenerator → Consistency
 *                              → Import → CodeStyle → Database → Auth → ErrorHandling
 *                              → Config → Integration
 */

import { Orchestrator } from '../base/Orchestrator'
import type { OrchestratorInput } from '../base/Orchestrator'
import type { Brain } from '../../brains/base/Brain'
import {
  FileGeneratorBrain,
  ConsistencyBrain,
  ImportBrain,
  CodeStyleBrain,
  DatabaseBrain,
  AuthBrain,
  ErrorHandlingBrain,
  ConfigBrain,
  IntegrationBrain,
} from '../../brains/build/implementation'

export class ImplementationOrchestrator extends Orchestrator {
  readonly orchestratorName = 'ImplementationOrchestrator'
  readonly engineName = 'BuildEngine'

  protected getBrains(): Array<Brain<unknown, unknown>> {
    return [
      new FileGeneratorBrain(),
      new ConsistencyBrain(),
      new ImportBrain(),
      new CodeStyleBrain(),
      new DatabaseBrain(),
      new AuthBrain(),
      new ErrorHandlingBrain(),
      new ConfigBrain(),
      new IntegrationBrain(),
    ]
  }

  protected buildBrainInput(brainName: string, accumulated: Record<string, unknown>, input: OrchestratorInput): unknown {
    const archOutput = input.previousEngineOutputs?.['ArchitectureOrchestrator'] as Record<string, unknown> | undefined
    const intentOutput = input.previousEngineOutputs?.['IntentOrchestrator'] as Record<string, unknown> | undefined
    const memoryOutput = input.previousEngineOutputs?.['MemoryOrchestrator'] as Record<string, unknown> | undefined

    const architecture = archOutput?.['ArchitectureBrain'] as Record<string, unknown> | undefined
    const patterns = archOutput?.['PatternBrain'] as Record<string, unknown> | undefined
    const apiEndpoints = (archOutput?.['APIBrain'] as { endpoints?: unknown[] })?.endpoints ?? []
    const prismaSchema = (archOutput?.['SchemaBrain'] as { prismaSchema?: string })?.prismaSchema ?? ''
    const dependencies = archOutput?.['DependencyBrain'] as Record<string, unknown> | undefined
    const injectedContext = (memoryOutput?.['PersonalizationBrain'] as { injectedContext?: string })?.injectedContext ?? ''
    const retryAddition = (input.previousEngineOutputs?.['retryPromptAddition'] as string | undefined) ?? ''

    const generatedFiles = (accumulated['FileGeneratorBrain'] as { generatedFiles?: unknown[] })?.generatedFiles ?? []
    const mainTechStack = (dependencies?.['mainTechStack'] as string[]) ?? []
    const hasAuth = patterns?.['authPattern'] !== 'none'

    switch (brainName) {
      case 'FileGeneratorBrain':
        return {
          goal: input.goal,
          taskId: input.taskId,
          architecturePattern: architecture?.['pattern'] ?? 'api-only',
          folderStructure: architecture?.['folderStructure'] ?? [],
          fileManifest: architecture?.['fileManifest'] ?? [],
          mainTechStack,
          prismaSchema,
          apiEndpoints,
          authPattern: patterns?.['authPattern'] ?? 'none',
          dbPattern: patterns?.['dbPattern'] ?? 'none',
          bestPractices: (archOutput?.['ResearchBrain'] as { bestPractices?: string[] })?.bestPractices ?? [],
          injectedContext,
          retryPromptAddition: retryAddition,
        }

      case 'ConsistencyBrain':
        return { generatedFiles }

      case 'ImportBrain':
        return {
          generatedFiles,
          declaredDependencies: Object.keys((dependencies?.['dependencies'] as object) ?? {}),
        }

      case 'CodeStyleBrain':
        return { generatedFiles }

      case 'DatabaseBrain':
        return { generatedFiles, prismaSchema, dbPattern: patterns?.['dbPattern'] ?? 'none' }

      case 'AuthBrain':
        return { generatedFiles, hasAuth, authPattern: patterns?.['authPattern'] ?? 'none' }

      case 'ErrorHandlingBrain':
        return { generatedFiles, architecturePattern: architecture?.['pattern'] ?? 'api-only' }

      case 'ConfigBrain':
        return { generatedFiles, mainTechStack, hasDatabase: patterns?.['dbPattern'] !== 'none' }

      case 'IntegrationBrain':
        return {
          generatedFiles,
          packageJson: dependencies?.['packageJson'],
          architecturePattern: architecture?.['pattern'] ?? 'api-only',
        }

      default:
        return { goal: input.goal, userId: input.userId, taskId: input.taskId, ...accumulated }
    }
  }
}
