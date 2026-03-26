import { prisma } from '@arivarangam/db'
import type { AIModel, TemplateAgent, TaskCategory } from '@arivarangam/types'
import { type SubtaskDefinition } from './task-decomposer'
import { appendSubtaskResult, buildPromptWithContext, clearContextCache, getContext } from './context-manager'
import { enqueueCodeGenTask } from '../jobs/queue'
import { detectSkillsAndAwards } from '../jobs/skill-detector'

/** Entry point — routes all tasks through the 3-Engine intelligence pipeline. */
export async function orchestrateTask(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, originalGoal: true, userId: true, templateId: true, status: true, contextObject: true },
  })

  if (!task) throw new Error(`Task ${taskId} not found`)

  // ── All tasks route through the 3-Engine intelligence pipeline ──────────
  console.log(`[Orchestrator] Routing task ${taskId} to 3-Engine code generation pipeline`)
  await enqueueCodeGenTask(taskId)
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

    // Detect skills and award achievements for passport (non-blocking)
    if (task) {
      detectSkillsAndAwards(taskId, task.userId).catch(() => {})
    }
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
 * Kahn's topological sort — detect cycles in the subtask DAG before committing to DB.
 * Returns true if a cycle exists; throws so orchestration aborts cleanly.
 *
 * `defs[i].dependsOn` contains string indices referencing other positions in the array.
 */
function detectCycles(defs: SubtaskDefinition[]): boolean {
  const n = defs.length
  const inDegree = new Array<number>(n).fill(0)
  const adj: number[][] = Array.from({ length: n }, () => [])

  for (let i = 0; i < n; i++) {
    for (const dep of defs[i].dependsOn) {
      const depIdx = parseInt(dep, 10)
      if (!Number.isNaN(depIdx) && depIdx >= 0 && depIdx < n) {
        adj[depIdx].push(i)  // edge: dep → i
        inDegree[i]++
      }
    }
  }

  const queue: number[] = []
  for (let i = 0; i < n; i++) {
    if (inDegree[i] === 0) queue.push(i)
  }

  let processed = 0
  while (queue.length > 0) {
    const node = queue.shift()!
    processed++
    for (const neighbor of adj[node]) {
      if (--inDegree[neighbor] === 0) queue.push(neighbor)
    }
  }

  return processed < n  // true = cycle detected (some nodes never reached)
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
    role: 'INITIAL' as const,
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
