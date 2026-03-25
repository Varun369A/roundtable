/**
 * Arivarangam Learning Pipeline
 *
 * After every task completes, this module collects the full specialist chain
 * and stores it as a structured training record in ArivarangamKnowledge.
 *
 * Each record = one fine-tuning example:
 *   INPUT:  task goal + every specialist output (with role labels)
 *   OUTPUT: Arivarangam's final synthesis
 *
 * Over thousands of tasks this becomes the brain Arivarangam is fine-tuned on.
 */
import { prisma } from '@arivarangam/db'
import type { TaskCategory } from '@arivarangam/types'
import { updateDomainConfidence } from './confidence-tracker'
import { checkMilestoneAndTrigger } from './fine-tune-manager'

export interface SpecialistRecord {
  model:   string
  role:    string
  output:  string
}

/**
 * Called after a task fully completes.
 * Collects all subtask outputs and saves a complete training record.
 */
export async function recordTaskLearning(taskId: string): Promise<void> {
  try {
    const task = await prisma.task.findUnique({
      where:  { id: taskId },
      select: {
        id:           true,
        originalGoal: true,
        subtasks: {
          orderBy: { executionOrder: 'asc' },
          select: {
            id:             true,
            role:           true,
            category:       true,
            assignedModel:  true,
            status:         true,
            executionOrder: true,
            output:         { select: { content: true, type: true } },
          },
        },
      },
    })

    if (!task) return

    // Find the synthesis subtask (Arivarangam's final output)
    const synthesisSubtask = task.subtasks.find((s) => s.role === 'SYNTHESIS' && s.status === 'COMPLETED')
    if (!synthesisSubtask?.output?.content) return

    const synthesisOutput = synthesisSubtask.output.content
    if (synthesisOutput.length < 200) return  // too short to be useful

    // Collect specialist outputs (INITIAL subtasks that completed)
    const specialists: SpecialistRecord[] = task.subtasks
      .filter((s) => s.role === 'INITIAL' && s.status === 'COMPLETED' && s.output?.content)
      .map((s) => ({
        model:  (s.assignedModel as string).replace(/_/g, '-'),
        role:   inferRoleLabel(s.assignedModel as string, s.category as string),
        output: (s.output!.content as string).slice(0, 3000),
      }))

    if (specialists.length === 0) return

    const category = synthesisSubtask.category as TaskCategory
    const complexity = inferComplexity(specialists.length)

    // Check for existing record for this synthesis subtask (idempotent)
    const existing = await prisma.arivarangamKnowledge.findUnique({
      where: { subtaskId: synthesisSubtask.id },
    })
    if (existing) return

    // Save the complete training record
    await prisma.arivarangamKnowledge.create({
      data: {
        category,
        inputSummary:     task.originalGoal.slice(0, 500),
        outputSummary:    synthesisOutput.slice(0, 3000),
        specialistContext: specialists as any,
        specialistsUsed:  specialists.map((s) => s.model),
        complexityLevel:  complexity,
        qualityScore:     0.5,          // neutral default; admin or user feedback adjusts this
        isFineTuneReady:  false,        // admin marks ready after quality review
        model:            'sabha_ai' as any,
        taskId:           task.id,
        subtaskId:        synthesisSubtask.id,
      },
    })

    // Update per-domain confidence metrics (non-blocking)
    updateDomainConfidence(category).catch(() => {})

    // Increment global knowledge count + get new total
    const updatedState = await prisma.arivarangamAIState.upsert({
      where:  { id: 'singleton' },
      update: { knowledgeCount: { increment: 1 }, lastLearnedAt: new Date() },
      create: { id: 'singleton', knowledgeCount: 1, lastLearnedAt: new Date() },
      select: { knowledgeCount: true },
    }).catch(() => null)

    // Check if we've hit a milestone → auto fine-tune (non-blocking)
    if (updatedState) {
      checkMilestoneAndTrigger(updatedState.knowledgeCount).catch(() => {})
    }

  } catch {
    // Learning pipeline must never block task completion
  }
}

/**
 * Update quality score for a knowledge record.
 * Called by admin rating or user feedback.
 */
export async function rateKnowledgeRecord(
  knowledgeId: string,
  score: number,            // 0.0 – 1.0
  isFineTuneReady?: boolean,
): Promise<void> {
  const clamped = Math.max(0, Math.min(1, score))

  await prisma.arivarangamKnowledge.update({
    where: { id: knowledgeId },
    data:  {
      qualityScore:    clamped,
      isFineTuneReady: isFineTuneReady ?? clamped >= 0.7,
    },
  })

  // Refresh domain confidence after rating change
  const record = await prisma.arivarangamKnowledge.findUnique({
    where:  { id: knowledgeId },
    select: { category: true },
  })
  if (record) {
    updateDomainConfidence(record.category as TaskCategory).catch(() => {})
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferComplexity(specialistCount: number): string {
  if (specialistCount >= 3) return 'complex'
  if (specialistCount === 2) return 'standard'
  return 'simple'
}

function inferRoleLabel(model: string, category: string): string {
  const m = model.replace(/_/g, '-').toLowerCase()
  if (m.includes('gpt-4o'))            return category === 'code' ? 'Architect'   : 'Strategist'
  if (m.includes('perplexity'))        return category === 'code' ? 'Researcher'  : 'Researcher'
  if (m.includes('claude'))            return category === 'code' ? 'Implementer' : 'Writer'
  if (m.includes('gemini'))            return 'Analyst'
  if (m.includes('sarvam'))            return 'Translator'
  if (m.includes('elevenlabs'))        return 'Voice'
  if (m.includes('gpt-image') || m.includes('gpt_image')) return 'Image'
  return 'Specialist'
}
