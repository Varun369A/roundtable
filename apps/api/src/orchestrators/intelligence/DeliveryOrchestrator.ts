/**
 * DeliveryOrchestrator — Runs 9 Delivery brains: Documentation → Packaging → Deployment
 *                        → Preview → Notification → Presentation → GitHub → Download → Summary
 */

import { Orchestrator } from '../base/Orchestrator'
import type { OrchestratorInput } from '../base/Orchestrator'
import type { Brain } from '../../brains/base/Brain'
import {
  DocumentationBrain,
  PackagingBrain,
  DeploymentBrain,
  PreviewBrain,
  NotificationBrain,
  PresentationBrain,
  GitHubBrain,
  DownloadBrain,
  SummaryBrain,
} from '../../brains/intelligence/delivery'

export class DeliveryOrchestrator extends Orchestrator {
  readonly orchestratorName = 'DeliveryOrchestrator'
  readonly engineName = 'IntelligenceEngine'

  protected getBrains(): Array<Brain<unknown, unknown>> {
    return [
      new DocumentationBrain(),
      new PackagingBrain(),
      new DeploymentBrain(),
      new PreviewBrain(),
      new NotificationBrain(),
      new PresentationBrain(),
      new GitHubBrain(),
      new DownloadBrain(),
      new SummaryBrain(),
    ]
  }

  protected buildBrainInput(brainName: string, accumulated: Record<string, unknown>, input: OrchestratorInput): unknown {
    // Pull from previous engine outputs
    const implOutput = input.previousEngineOutputs?.['ImplementationOrchestrator'] as Record<string, unknown> | undefined
    const archOutput = input.previousEngineOutputs?.['ArchitectureOrchestrator'] as Record<string, unknown> | undefined
    const qualityOutput = input.previousEngineOutputs?.['QualityOrchestrator'] as Record<string, unknown> | undefined

    const generatedFiles = (implOutput?.['FileGeneratorBrain'] as { generatedFiles?: unknown[] })?.generatedFiles ?? []
    const apiEndpoints = (archOutput?.['APIBrain'] as { endpoints?: unknown[] })?.endpoints ?? []
    const mainTechStack = (archOutput?.['DependencyBrain'] as { mainTechStack?: string[] })?.mainTechStack ?? []
    const envVariables = (implOutput?.['ConfigBrain'] as { envVariables?: string[] })?.envVariables ?? []
    const packageJsonScripts = (archOutput?.['DependencyBrain'] as { scripts?: Record<string, string> })?.scripts ?? {}
    const architecturePattern = (archOutput?.['ArchitectureBrain'] as { pattern?: string })?.pattern ?? 'api-only'
    const hasDatabase = (archOutput?.['PatternBrain'] as { dbPattern?: string })?.dbPattern !== 'none'
    const testFiles = (accumulated['TestingBrain'] as { testFiles?: unknown[] })?.testFiles ?? []
    const seedFile = (implOutput?.['DatabaseBrain'] as { seedFile?: unknown })?.seedFile ?? null
    const envExampleFile = (implOutput?.['ConfigBrain'] as { envExampleFile?: unknown })?.envExampleFile ?? null

    const review = qualityOutput?.['ReviewBrain'] as Record<string, unknown> | undefined
    const gate = qualityOutput?.['GateBrain'] as Record<string, unknown> | undefined
    const overallScore = (review?.['overallScore'] as number) ?? 70
    const qualityGrade = (gate?.['qualityGrade'] as string) ?? 'C'
    const decision = (gate?.['decision'] as string) ?? 'PASS'

    // Accumulated from earlier delivery brains
    const readmeFile = (accumulated['DocumentationBrain'] as { readmeFile?: unknown })?.readmeFile
    const apiDocsFile = (accumulated['DocumentationBrain'] as { apiDocsFile?: unknown })?.apiDocsFile ?? null
    const packageManifest = (accumulated['PackagingBrain'] as { packageManifest?: unknown })?.packageManifest
    const allFiles = (accumulated['PackagingBrain'] as { allFiles?: unknown[] })?.allFiles ?? generatedFiles
    const dockerFiles = (accumulated['DeploymentBrain'] as { dockerFiles?: unknown[] })?.dockerFiles ?? []
    const preview = accumulated['PreviewBrain'] as Record<string, unknown> | undefined
    const projectName = input.goal.split(/\s+/).slice(0, 4).join(' ')

    switch (brainName) {
      case 'DocumentationBrain':
        return {
          generatedFiles,
          goal: input.goal,
          mainTechStack,
          endpoints: apiEndpoints,
          envVariables,
          packageJsonScripts,
        }

      case 'PackagingBrain':
        return {
          generatedFiles,
          readmeFile: readmeFile ?? { path: 'README.md', content: '', language: 'markdown', linesOfCode: 0, purpose: 'README' },
          apiDocsFile,
          envExampleFile,
          testFiles,
          seedFile,
          dockerFiles,
          projectName,
        }

      case 'DeploymentBrain':
        return {
          mainTechStack,
          projectName,
          envVariables,
          hasDatabase,
          architecturePattern,
          packageJsonScripts,
        }

      case 'PreviewBrain':
        return { generatedFiles, architecturePattern, mainTechStack, packageJsonScripts }

      case 'NotificationBrain':
        return {
          taskId: input.taskId,
          userId: input.userId,
          projectName,
          packageManifest: packageManifest ?? {},
          qualityGrade,
          overallScore,
          decision,
          previewAvailable: (preview?.['previewAvailable'] as boolean) ?? false,
          devCommand: (preview?.['devCommand'] as string | null) ?? null,
          port: (preview?.['port'] as number) ?? 3000,
          reviewSummary: (review?.['summary'] as string) ?? '',
        }

      case 'PresentationBrain':
        return {
          allFiles,
          packageManifest: packageManifest ?? { projectName, totalFiles: allFiles.length, totalLinesOfCode: 0, hasTests: false, hasDocker: false, hasApiDocs: false, fileList: [], generatedAt: new Date().toISOString() },
          reviewSummary: (review?.['summary'] as string) ?? '',
          strengths: (review?.['strengths'] as string[]) ?? [],
          improvements: (review?.['improvements'] as string[]) ?? [],
          qualityGrade,
          overallScore,
          decision,
          previewAvailable: (preview?.['previewAvailable'] as boolean) ?? false,
          devCommand: (preview?.['devCommand'] as string | null) ?? null,
          port: (preview?.['port'] as number) ?? 3000,
        }

      case 'GitHubBrain':
        return {
          files: allFiles,
          projectName,
          description: input.goal.slice(0, 255),
          githubToken: undefined,
          githubUsername: undefined,
        }

      case 'DownloadBrain':
        return { allFiles, projectName, taskId: input.taskId }

      case 'SummaryBrain':
        return {
          goal: input.goal,
          packageManifest: packageManifest ?? {},
          qualityGrade,
          overallScore,
          decision,
          strengths: (review?.['strengths'] as string[]) ?? [],
          improvements: (review?.['improvements'] as string[]) ?? [],
          githubUrl: (accumulated['GitHubBrain'] as { repoUrl?: string })?.repoUrl ?? null,
          previewCommand: (preview?.['devCommand'] as string | null) ?? null,
        }

      default:
        return { goal: input.goal, userId: input.userId, taskId: input.taskId, ...accumulated }
    }
  }
}
