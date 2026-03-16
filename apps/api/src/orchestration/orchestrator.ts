import { prisma } from '@sabha/db'
import type { AIModel, TemplateAgent, TaskCategory } from '@sabha/types'
import { parseIntent } from './intent-parser'
import { decomposeTask, type SubtaskDefinition } from './task-decomposer'
import { initializeContext, appendSubtaskResult, buildPromptWithContext, clearContextCache, getContext } from './context-manager'
import { enqueueTask } from '../jobs/queue'
import { processInputLanguage, getUserLanguagePreference } from './language-layer'

/**
 * Entry point — called when user triggers a task.
 *
 * If the task has a templateId, use the template's agent list as the DAG
 * instead of running the AI intent parser → decomposer flow.
 *
 * Template mode:
 *   1. Load template agents
 *   2. Map agents to subtask definitions (sequential or parallel per dependsOnPrevious)
 *
 * Auto mode (no template):
 *   1. Parse intent
 *   2. Decompose into subtask DAG via task-decomposer
 */
export async function orchestrateTask(taskId: string): Promise<void> {
  // Mark as routing
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'ROUTING' },
  })

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, originalGoal: true, userId: true, templateId: true },
  })

  if (!task) throw new Error(`Task ${taskId} not found`)

  try {
    // Process language — detect and translate if needed
    const preferredLanguage = await getUserLanguagePreference(task.userId)
    const langContext = await processInputLanguage({
      taskId: task.id,
      userId: task.userId,
      originalGoal: task.originalGoal,
      preferredLanguage,
    })

    // Use translated goal for intent parsing (all AIs work in English)
    const goalForProcessing = langContext.translatedGoal

    let subtaskDefinitions: SubtaskDefinition[]

    if (task.templateId) {
      // ── Template mode: use prescribed agent lineup ────────────────────────
      const template = await prisma.roundtableTemplate.findUnique({
        where: { id: task.templateId },
      })

      if (!template) throw new Error(`Template ${task.templateId} not found`)

      const agents = template.agents as TemplateAgent[]
      subtaskDefinitions = decomposeFromTemplate(agents, goalForProcessing)

      // Increment template usage counter (non-blocking)
      prisma.roundtableTemplate.update({
        where: { id: task.templateId },
        data: { useCount: { increment: 1 } },
      }).catch(() => {})

    } else {
      // ── Auto mode: AI intent parsing + smart decomposition ───────────────
      const intent = await parseIntent(goalForProcessing)
      subtaskDefinitions = decomposeTask(intent)
    }

    // Step 3: Initialize context
    await initializeContext({
      taskId: task.id,
      originalGoal: goalForProcessing,
      userId: task.userId,
      language: langContext.originalLanguage.code,
      constraints: intent.constraints,
    })

    // Step 4: Save subtasks to DB
    // We create them with temp IDs first to resolve dependsOn references
    const createdSubtasks = await Promise.all(
      subtaskDefinitions.map((def) =>
        prisma.subtask.create({
          data: {
            taskId: task.id,
            title: def.title,
            category: def.category,
            assignedModel: def.assignedModel,
            status: 'PENDING',
            executionOrder: def.executionOrder,
            dependsOn: [], // resolved below
            inputPrompt: def.inputInstruction,
          },
        })
      )
    )

    // Resolve dependsOn: map index-based deps to actual subtask IDs
    await Promise.all(
      createdSubtasks.map((subtask, i) => {
        const def = subtaskDefinitions[i]
        const resolvedDeps = def.dependsOn
          .map((depIndex) => createdSubtasks[parseInt(depIndex)]?.id)
          .filter(Boolean) as string[]

        return prisma.subtask.update({
          where: { id: subtask.id },
          data: { dependsOn: resolvedDeps },
        })
      })
    )

    // Step 5: Update task to IN_PROGRESS
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'IN_PROGRESS',
        title: goalForProcessing.slice(0, 60) + (goalForProcessing.length > 60 ? '...' : ''),
      },
    })

    // Kick off the job queue
    await enqueueTask(taskId)

  } catch (err) {
    console.error(`[Orchestrator] Failed for task ${taskId}:`, err)
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'FAILED' },
    })
    throw err
  }
}

/**
 * Execute a single subtask.
 * Called by the job queue (Month 3) after dependencies complete.
 * For now, accepts a connector function and runs it.
 */
export async function executeSubtask(
  subtaskId: string,
  connectorFn: (prompt: string) => Promise<string>
): Promise<void> {
  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    include: { task: true },
  })

  if (!subtask) throw new Error(`Subtask ${subtaskId} not found`)

  // Mark as in progress
  await prisma.subtask.update({
    where: { id: subtaskId },
    data: { status: 'IN_PROGRESS', startedAt: new Date() },
  })

  const startTime = Date.now()

  try {
    // Get current context
    const context = await getContext(subtask.taskId)
    if (!context) throw new Error(`Context not found for task ${subtask.taskId}`)

    // Build full prompt with context
    const fullPrompt = buildPromptWithContext(context, subtask.inputPrompt)

    // Execute via connector
    const output = await connectorFn(fullPrompt)
    const durationMs = Date.now() - startTime

    // Save output
    await prisma.subtaskOutput.create({
      data: {
        subtaskId: subtask.id,
        type: 'text',
        content: output,
        metadata: { durationMs },
      },
    })

    // Mark subtask complete
    await prisma.subtask.update({
      where: { id: subtaskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })

    // Update context with this subtask's output
    await appendSubtaskResult({
      taskId: subtask.taskId,
      subtaskId: subtask.id,
      title: subtask.title,
      executor: subtask.assignedModel as AIModel,
      outputContent: output,
    })

    // Check if all subtasks are done — if so, complete the task
    await maybeCompleteTask(subtask.taskId)

  } catch (err) {
    console.error(`[Orchestrator] Subtask ${subtaskId} failed:`, err)

    await prisma.subtask.update({
      where: { id: subtaskId },
      data: { status: 'FAILED', completedAt: new Date() },
    })

    // Mark task as failed
    await prisma.task.update({
      where: { id: subtask.taskId },
      data: { status: 'FAILED' },
    })

    throw err
  }
}

async function maybeCompleteTask(taskId: string): Promise<void> {
  const allSubtasks = await prisma.subtask.findMany({
    where: { taskId },
    select: { status: true },
  })

  const allDone = allSubtasks.every(
    (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED'
  )

  if (allDone) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    await clearContextCache(taskId)

    // Update usage stats
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { userId: true } })
    if (task) {
      await prisma.usageStats.upsert({
        where: { userId: task.userId },
        update: {
          totalTasksCompleted: { increment: 1 },
          totalSubtasksRun: { increment: allSubtasks.length },
        },
        create: {
          userId: task.userId,
          totalTasksCompleted: 1,
          totalSubtasksRun: allSubtasks.length,
        },
      })
    }
  }
}

/**
 * Converts a template's agent list into SubtaskDefinitions.
 *
 * Dependency model:
 *   - agent.dependsOnPrevious = true  → depends on the immediately preceding agent
 *   - agent.dependsOnPrevious = false → runs in parallel with other non-dependent agents
 *
 * This allows templates to express:
 *   parallel research phase → sequential implementation chain
 */
function decomposeFromTemplate(
  agents: TemplateAgent[],
  goal: string
): SubtaskDefinition[] {
  return agents.map((agent, i) => ({
    title: `${agent.role}: ${goal.slice(0, 40)}${goal.length > 40 ? '...' : ''}`,
    category: agent.category as TaskCategory,
    assignedModel: agent.model as AIModel,
    executionOrder: i,
    dependsOn: agent.dependsOnPrevious && i > 0 ? [String(i - 1)] : [],
    inputInstruction: agent.instruction,
  }))
}

/**
 * Get subtasks that are ready to execute:
 * status is PENDING and all dependencies are COMPLETED.
 */
export async function getReadySubtasks(taskId: string): Promise<string[]> {
  const subtasks = await prisma.subtask.findMany({
    where: { taskId },
    select: { id: true, status: true, dependsOn: true },
  })

  const completedIds = new Set(
    subtasks.filter((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED').map((s) => s.id)
  )

  const ready = subtasks.filter((s) => {
    if (s.status !== 'PENDING') return false
    return s.dependsOn.every((depId) => completedIds.has(depId))
  })

  return ready.map((s) => s.id)
}
