/**
 * VersioningBrain — Tracks task versions and manages generation history.
 * Zero API — DB versioning logic.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'
import type { GeneratedFile } from '../../build/implementation/FileGeneratorBrain'

export interface VersioningBrainInput {
  taskId: string
  userId: string
  retryCount: number
  overallScore: number
  allFiles: GeneratedFile[]
  qualityGrade: string
}

export interface VersionRecord {
  versionNumber: number
  taskId: string
  score: number
  grade: string
  fileCount: number
  createdAt: string
}

export interface VersioningBrainOutput {
  versionNumber: number
  isImprovedVersion: boolean
  previousBestScore: number
  versionHistory: VersionRecord[]
  savedVersion: boolean
}

export class VersioningBrain extends Brain<VersioningBrainInput, VersioningBrainOutput> {
  readonly brainName = 'VersioningBrain'
  readonly orchestratorName = 'LearningOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: VersioningBrainInput, _ctx: BrainContext): Promise<VersioningBrainOutput> {
    const { taskId, userId, retryCount, overallScore, allFiles, qualityGrade } = input
    const versionNumber = retryCount + 1

    try {
      // Get previous versions of this task
      const previousVersions = await prisma.taskVersion.findMany({
        where: { taskId },
        orderBy: { versionNumber: 'desc' },
        take: 5,
      })

      const previousBestScore = previousVersions.length > 0
        ? Math.max(...previousVersions.map(v => v.qualityScore ?? 0))
        : 0

      const isImprovedVersion = overallScore > previousBestScore

      // Save this version
      await prisma.taskVersion.create({
        data: {
          taskId,
          versionNumber,
          qualityScore: overallScore,
          qualityGrade,
          fileCount: allFiles.length,
          filePaths: allFiles.map(f => f.path),
          isCurrentBest: isImprovedVersion || previousVersions.length === 0,
          snapshot: allFiles as object[],
        },
      })

      // If this is better, mark previous as not current best
      if (isImprovedVersion && previousVersions.length > 0) {
        await prisma.taskVersion.updateMany({
          where: {
            taskId,
            versionNumber: { not: versionNumber },
          },
          data: { isCurrentBest: false },
        })
      }

      const versionHistory: VersionRecord[] = [
        ...previousVersions.map(v => ({
          versionNumber: v.versionNumber,
          taskId: v.taskId,
          score: v.qualityScore ?? 0,
          grade: v.qualityGrade ?? 'C',
          fileCount: v.fileCount ?? 0,
          createdAt: v.createdAt.toISOString(),
        })),
        {
          versionNumber,
          taskId,
          score: overallScore,
          grade: qualityGrade,
          fileCount: allFiles.length,
          createdAt: new Date().toISOString(),
        },
      ]

      return { versionNumber, isImprovedVersion, previousBestScore, versionHistory, savedVersion: true }
    } catch {
      return {
        versionNumber,
        isImprovedVersion: true,
        previousBestScore: 0,
        versionHistory: [{
          versionNumber,
          taskId,
          score: overallScore,
          grade: qualityGrade,
          fileCount: allFiles.length,
          createdAt: new Date().toISOString(),
        }],
        savedVersion: false,
      }
    }
  }

  protected fallback(input: VersioningBrainInput): VersioningBrainOutput {
    return {
      versionNumber: input.retryCount + 1,
      isImprovedVersion: true,
      previousBestScore: 0,
      versionHistory: [],
      savedVersion: false,
    }
  }
}
