/**
 * ArchitectureOrchestrator — Runs 9 Architecture brains: Requirements → Architecture → Knowledge
 *                            → Pattern → DataFlow → API → Schema → Dependency → Research
 */

import { Orchestrator } from '../base/Orchestrator'
import type { OrchestratorInput } from '../base/Orchestrator'
import type { Brain } from '../../brains/base/Brain'
import {
  RequirementsBrain,
  ArchitectureBrain,
  KnowledgeBrain,
  ArchitecturePatternBrain,
  DataFlowBrain,
  APIBrain,
  SchemaBrain,
  DependencyBrain,
  ResearchBrain,
} from '../../brains/build/architecture'

export class ArchitectureOrchestrator extends Orchestrator {
  readonly orchestratorName = 'ArchitectureOrchestrator'
  readonly engineName = 'BuildEngine'

  protected getBrains(): Array<Brain<unknown, unknown>> {
    return [
      new RequirementsBrain(),
      new ArchitectureBrain(),
      new KnowledgeBrain(),
      new ArchitecturePatternBrain(),
      new DataFlowBrain(),
      new APIBrain(),
      new SchemaBrain(),
      new DependencyBrain(),
      new ResearchBrain(),
    ]
  }

  protected buildBrainInput(brainName: string, accumulated: Record<string, unknown>, input: OrchestratorInput): unknown {
    // Extract key outputs from Understanding Engine
    const intentOutput = input.previousEngineOutputs?.['IntentOrchestrator'] as Record<string, unknown> | undefined
    const memoryOutput = input.previousEngineOutputs?.['MemoryOrchestrator'] as Record<string, unknown> | undefined

    const primaryCategory = (intentOutput?.['IntentBrain'] as { primaryCategory?: string })?.primaryCategory ?? 'general'
    const isCodeTask = (intentOutput?.['IntentBrain'] as { isCodeTask?: boolean })?.isCodeTask ?? true
    const complexity = (intentOutput?.['IntentBrain'] as { complexity?: string })?.complexity ?? 'medium'
    const techContext = (intentOutput?.['ContextBrain'] as { detectedTech?: string[] })?.detectedTech ?? []
    const domain = (intentOutput?.['ContextBrain'] as { domain?: string })?.domain ?? 'general'
    const injectedContext = (memoryOutput?.['PersonalizationBrain'] as { injectedContext?: string })?.injectedContext ?? ''
    const constraints = (intentOutput?.['ConstraintBrain'] as { constraints?: object })?.constraints ?? {}

    const reqOutput = accumulated['RequirementsBrain'] as Record<string, unknown> | undefined
    const requirements = (reqOutput?.['requirements'] as unknown[]) ?? []
    const hasAuthRequirement = (reqOutput?.['hasAuthRequirement'] as boolean) ?? false
    const hasDatabaseRequirement = (reqOutput?.['hasDatabaseRequirement'] as boolean) ?? false
    const hasAPIRequirement = (reqOutput?.['hasAPIRequirement'] as boolean) ?? false

    const architecture = accumulated['ArchitectureBrain'] as Record<string, unknown> | undefined
    const archTechStack = (architecture?.['mainTechStack'] as string[]) ?? techContext
    const patterns = accumulated['PatternBrain'] as Record<string, unknown> | undefined

    switch (brainName) {
      case 'RequirementsBrain':
        return { goal: input.goal, primaryCategory, complexity, deliverables: (intentOutput?.['IntentBrain'] as { deliverables?: string[] })?.deliverables ?? [], constraints }

      case 'ArchitectureBrain':
        return {
          goal: input.goal,
          primaryCategory,
          complexity,
          techStack: techContext,
          hasAuthRequirement,
          hasDatabaseRequirement,
          hasAPIRequirement,
          domain,
        }

      case 'KnowledgeBrain':
        return { goal: input.goal, primaryCategory, mainTechStack: archTechStack, domain }

      case 'PatternBrain':
        return {
          pattern: architecture?.['pattern'] ?? 'api-only',
          hasAuthRequirement,
          hasDatabaseRequirement,
          hasAPIRequirement,
          goal: input.goal,
        }

      case 'DataFlowBrain':
        return {
          architecturePattern: architecture?.['pattern'] ?? 'api-only',
          hasAuth: patterns?.['authPattern'] !== 'none',
          hasDatabase: patterns?.['dbPattern'] !== 'none',
          apiPattern: patterns?.['apiPattern'] ?? 'rest',
        }

      case 'APIBrain':
        return {
          goal: input.goal,
          hasAuthRequirement,
          hasDatabaseRequirement,
          apiPattern: patterns?.['apiPattern'] ?? 'rest',
          domain,
          requirements: requirements as Array<{ description: string; type: string }>,
        }

      case 'SchemaBrain':
        return {
          domain,
          requirements,
          hasAuth: patterns?.['authPattern'] !== 'none',
          dbPattern: patterns?.['dbPattern'] ?? 'prisma-orm',
        }

      case 'DependencyBrain':
        return {
          mainTechStack: techContext,
          authPattern: patterns?.['authPattern'] ?? 'none',
          dbPattern: patterns?.['dbPattern'] ?? 'prisma-orm',
          apiPattern: patterns?.['apiPattern'] ?? 'rest',
          cssFramework: 'tailwind',
          language: 'typescript' as const,
          pattern: architecture?.['pattern'] ?? 'api-only',
        }

      case 'ResearchBrain':
        return {
          mainTechStack: (accumulated['DependencyBrain'] as { mainTechStack?: string[] })?.mainTechStack ?? techContext,
          domain,
          architecturePattern: architecture?.['pattern'] ?? 'api-only',
        }

      default:
        return { goal: input.goal, userId: input.userId, taskId: input.taskId, ...accumulated }
    }
  }
}
