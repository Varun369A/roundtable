/**
 * DownloadBrain — Prepares downloadable archive metadata and file record.
 * Zero API — generates manifest for zip creation by the delivery layer.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../../build/implementation/FileGeneratorBrain'

export interface DownloadBrainInput {
  allFiles: GeneratedFile[]
  projectName: string
  taskId: string
}

export interface DownloadBrainOutput {
  downloadReady: boolean
  archiveName: string
  fileCount: number
  estimatedSizeKb: number
  downloadManifest: DownloadManifest
}

export interface DownloadManifest {
  taskId: string
  projectName: string
  archiveName: string
  files: Array<{ path: string; sizeBytes: number }>
  createdAt: string
}

export class DownloadBrain extends Brain<DownloadBrainInput, DownloadBrainOutput> {
  readonly brainName = 'DownloadBrain'
  readonly orchestratorName = 'DeliveryOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: DownloadBrainInput, _ctx: BrainContext): Promise<DownloadBrainOutput> {
    const { allFiles, projectName, taskId } = input

    const slug = projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const timestamp = new Date().toISOString().slice(0, 10)
    const archiveName = `${slug}-${timestamp}.zip`

    const fileEntries = allFiles.map(f => ({
      path: f.path,
      sizeBytes: Buffer.byteLength(f.content, 'utf8'),
    }))

    const totalBytes = fileEntries.reduce((sum, f) => sum + f.sizeBytes, 0)
    const estimatedSizeKb = Math.ceil(totalBytes / 1024)

    const downloadManifest: DownloadManifest = {
      taskId,
      projectName,
      archiveName,
      files: fileEntries,
      createdAt: new Date().toISOString(),
    }

    return {
      downloadReady: allFiles.length > 0,
      archiveName,
      fileCount: allFiles.length,
      estimatedSizeKb,
      downloadManifest,
    }
  }

  protected fallback(input: DownloadBrainInput): DownloadBrainOutput {
    return {
      downloadReady: false,
      archiveName: 'project.zip',
      fileCount: 0,
      estimatedSizeKb: 0,
      downloadManifest: {
        taskId: input.taskId,
        projectName: input.projectName,
        archiveName: 'project.zip',
        files: [],
        createdAt: new Date().toISOString(),
      },
    }
  }
}
