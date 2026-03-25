/**
 * Arivarangam Fine-Tune Dataset Exporter
 *
 * Exports the knowledge base as a JSONL file in Anthropic's fine-tuning format:
 *
 *   {"messages": [
 *     {"role": "user",      "content": "[TASK GOAL]\n\n[SPECIALIST OUTPUTS]"},
 *     {"role": "assistant", "content": "[ARIVARANGAM SYNTHESIS]"}
 *   ]}
 *
 * Each line = one high-quality completed task.
 * The user message = everything the specialists contributed (goal + guidance).
 * The assistant message = what Arivarangam built from that guidance.
 *
 * This is the exact format needed to teach the model:
 * "Given this goal and these specialist inputs, produce output like this."
 */
import fs from 'fs'
import path from 'path'
import { prisma } from '@arivarangam/db'
import type { TaskCategory } from '@arivarangam/types'

export interface ExportOptions {
  minQuality?:  number        // default 0.7
  categories?:  TaskCategory[] // default: all
  outputDir?:   string        // default: /tmp
  triggeredBy?: string        // admin userId
  notes?:       string
}

export interface ExportResult {
  exportId:    string
  filePath:    string
  sampleCount: number
  categories:  string[]
  minQuality:  number
}

const SYSTEM_PROMPT = `You are Arivarangam AI — an intelligent builder trained by studying the world's best AI specialists. You receive a task goal along with expert guidance from specialist AIs. Your job is to synthesize all inputs and produce a complete, production-ready deliverable. Never mention individual AI names. Deliver as Arivarangam AI — confident, complete, and actionable.`

/**
 * Export fine-tuning dataset to JSONL.
 * Returns the file path and sample count.
 */
export async function exportFineTuneDataset(opts: ExportOptions = {}): Promise<ExportResult> {
  const minQuality = opts.minQuality ?? 0.7
  const outputDir  = opts.outputDir  ?? '/tmp'

  const where: any = {
    qualityScore:    { gte: minQuality },
    specialistContext: { not: null },
  }
  if (opts.categories && opts.categories.length > 0) {
    where.category = { in: opts.categories }
  }

  const records = await prisma.arivarangamKnowledge.findMany({
    where,
    orderBy: [{ qualityScore: 'desc' }, { createdAt: 'desc' }],
    select: {
      id:                true,
      category:          true,
      inputSummary:      true,
      outputSummary:     true,
      specialistContext: true,
      complexityLevel:   true,
    },
  })

  const lines: string[] = []
  const validIds: string[] = []

  for (const record of records) {
    const specialists = record.specialistContext as Array<{ model: string; role: string; output: string }> | null
    if (!specialists || specialists.length === 0) continue

    // Build the user message: goal + each specialist's contribution
    const specialistSection = specialists
      .map((s) => `## ${s.role} (${s.model})\n\n${s.output}`)
      .join('\n\n---\n\n')

    const userContent = `TASK GOAL: ${record.inputSummary}\n\nSPECIALIST GUIDANCE:\n\n${specialistSection}`

    const entry = {
      messages: [
        { role: 'system',    content: SYSTEM_PROMPT },
        { role: 'user',      content: userContent },
        { role: 'assistant', content: record.outputSummary },
      ],
    }

    lines.push(JSON.stringify(entry))
    validIds.push(record.id)
  }

  if (lines.length === 0) {
    throw new Error('No records meet the quality threshold for export')
  }

  // Write JSONL file
  const timestamp  = new Date().toISOString().replace(/[:.]/g, '-')
  const filename   = `arivarangam_finetune_${timestamp}.jsonl`
  const filePath   = path.join(outputDir, filename)
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8')

  // Mark exported records
  await prisma.arivarangamKnowledge.updateMany({
    where: { id: { in: validIds } },
    data:  { exportedAt: new Date(), isFineTuneReady: true },
  })

  // Log the export
  const categories = [...new Set(records.map((r) => r.category as string))]
  const exportLog  = await prisma.fineTuneExport.create({
    data: {
      id:          `fte_${Date.now()}`,
      sampleCount: lines.length,
      categories,
      minQuality,
      status:      'completed',
      triggeredBy: opts.triggeredBy,
      notes:       opts.notes,
    },
  })

  return {
    exportId:    exportLog.id,
    filePath,
    sampleCount: lines.length,
    categories,
    minQuality,
  }
}

/**
 * Returns stats about what's available for export.
 */
export async function getExportReadiness(minQuality = 0.7) {
  const [total, byCategory, recentExports] = await Promise.all([
    prisma.arivarangamKnowledge.count({
      where: { qualityScore: { gte: minQuality }, specialistContext: { not: null } },
    }),
    prisma.arivarangamKnowledge.groupBy({
      by:    ['category'],
      where: { qualityScore: { gte: minQuality }, specialistContext: { not: null } },
      _count: { id: true },
    }),
    prisma.fineTuneExport.findMany({
      orderBy: { createdAt: 'desc' },
      take:    5,
      select:  { id: true, createdAt: true, sampleCount: true, categories: true, status: true },
    }),
  ])

  return {
    readySamples: total,
    byCategory:   byCategory.map((r) => ({ category: r.category, count: r._count.id })),
    recentExports,
    recommendation: total >= 500  ? 'Ready for fine-tuning — strong dataset'
                  : total >= 100  ? 'Growing — fine-tune viable but more data recommended'
                  : total >= 50   ? 'Early stage — keep collecting'
                  :                 'Too early — need at least 50 quality samples',
  }
}
