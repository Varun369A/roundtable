/**
 * PackagingBrain — Assembles final output into a structured package.
 * Zero API — pure file assembly logic.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../../build/implementation/FileGeneratorBrain'

export interface PackagingBrainInput {
  generatedFiles: GeneratedFile[]
  readmeFile: GeneratedFile
  apiDocsFile: GeneratedFile | null
  envExampleFile: GeneratedFile | null
  testFiles: GeneratedFile[]
  seedFile: GeneratedFile | null
  dockerFiles: GeneratedFile[]
  projectName: string
}

export interface PackageBrainOutput {
  allFiles: GeneratedFile[]
  totalFiles: number
  totalLinesOfCode: number
  filesByType: Record<string, number>
  packageManifest: PackageManifest
}

export interface PackageManifest {
  projectName: string
  generatedAt: string
  totalFiles: number
  totalLinesOfCode: number
  hasTests: boolean
  hasDocker: boolean
  hasApiDocs: boolean
  fileList: Array<{ path: string; language: string; lines: number }>
}

export class PackagingBrain extends Brain<PackagingBrainInput, PackageBrainOutput> {
  readonly brainName = 'PackagingBrain'
  readonly orchestratorName = 'DeliveryOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: PackagingBrainInput, _ctx: BrainContext): Promise<PackageBrainOutput> {
    const {
      generatedFiles, readmeFile, apiDocsFile, envExampleFile,
      testFiles, seedFile, dockerFiles, projectName,
    } = input

    // Assemble all files, deduplicating by path (last write wins)
    const fileMap = new Map<string, GeneratedFile>()

    for (const f of generatedFiles) fileMap.set(f.path, f)
    for (const f of testFiles) fileMap.set(f.path, f)
    for (const f of dockerFiles) fileMap.set(f.path, f)
    if (seedFile) fileMap.set(seedFile.path, seedFile)
    if (envExampleFile) fileMap.set(envExampleFile.path, envExampleFile)
    if (apiDocsFile) fileMap.set(apiDocsFile.path, apiDocsFile)
    fileMap.set(readmeFile.path, readmeFile) // README always last (canonical)

    const allFiles = Array.from(fileMap.values())
    const totalLinesOfCode = allFiles.reduce((sum, f) => sum + f.linesOfCode, 0)

    // Count by language
    const filesByType: Record<string, number> = {}
    for (const f of allFiles) {
      filesByType[f.language] = (filesByType[f.language] ?? 0) + 1
    }

    const packageManifest: PackageManifest = {
      projectName,
      generatedAt: new Date().toISOString(),
      totalFiles: allFiles.length,
      totalLinesOfCode,
      hasTests: testFiles.length > 0,
      hasDocker: dockerFiles.length > 0,
      hasApiDocs: apiDocsFile !== null,
      fileList: allFiles.map(f => ({ path: f.path, language: f.language, lines: f.linesOfCode })),
    }

    return {
      allFiles,
      totalFiles: allFiles.length,
      totalLinesOfCode,
      filesByType,
      packageManifest,
    }
  }

  protected fallback(input: PackagingBrainInput): PackageBrainOutput {
    const allFiles = [input.readmeFile, ...input.generatedFiles]
    return {
      allFiles,
      totalFiles: allFiles.length,
      totalLinesOfCode: allFiles.reduce((s, f) => s + f.linesOfCode, 0),
      filesByType: {},
      packageManifest: {
        projectName: input.projectName,
        generatedAt: new Date().toISOString(),
        totalFiles: allFiles.length,
        totalLinesOfCode: 0,
        hasTests: false,
        hasDocker: false,
        hasApiDocs: false,
        fileList: [],
      },
    }
  }
}
