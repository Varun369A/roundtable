import { prisma } from '@sabha/db'
import type { AIModel, TemplateAgent, TaskCategory } from '@sabha/types'
import { parseIntent } from './intent-parser'
import { decomposeTask, type SubtaskDefinition } from './task-decomposer'
import { initializeContext, appendSubtaskResult, buildPromptWithContext, clearContextCache, getContext } from './context-manager'
import { enqueueTask } from '../jobs/queue'
import { processInputLanguage, getUserLanguagePreference } from './language-layer'
import { generateClarifications, saveClarifications, buildClarificationContext } from '../lib/clarification-generator'
import { getMemoryContext } from '../lib/memory-manager'
import { detectSkillsAndAwards } from '../jobs/skill-detector'

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
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, originalGoal: true, userId: true, templateId: true, status: true },
  })

  if (!task) throw new Error(`Task ${taskId} not found`)

  // If task is resuming after clarification, skip the clarification phase
  const isResuming = task.status === 'WAITING_CLARIFICATION'

  if (!isResuming) {
    // ── Phase 0: Clarification round (only for new tasks) ──────────────────
    const memoryCtx = await getMemoryContext(task.userId)

    // Load template category for better question generation
    let templateCategory: string | undefined
    if (task.templateId) {
      const tmpl = await prisma.roundtableTemplate.findUnique({
        where: { id: task.templateId },
        select: { category: true },
      })
      templateCategory = tmpl?.category
    }

    const questions = await generateClarifications({
      taskId:           task.id,
      goal:             task.originalGoal,
      userId:           task.userId,
      templateCategory,
      memoryContext:    memoryCtx,
    })

    if (questions.length > 0) {
      await saveClarifications(task.id, questions)
      // Pause here — orchestration will resume when user submits answers
      // via POST /api/v1/tasks/:id/clarifications/answer
      return
    }
  }

  // Mark as routing
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'ROUTING' },
  })

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
    let intent: Awaited<ReturnType<typeof parseIntent>> | undefined

    if (task.templateId) {
      // ── Template mode: use prescribed agent lineup ────────────────────────
      const template = await prisma.roundtableTemplate.findUnique({
        where: { id: task.templateId },
      })

      if (!template) throw new Error(`Template ${task.templateId} not found`)

      const agents = template.agents as unknown as TemplateAgent[]
      subtaskDefinitions = decomposeFromTemplate(agents, goalForProcessing)

      // Increment template usage counter (non-blocking)
      prisma.roundtableTemplate.update({
        where: { id: task.templateId },
        data: { useCount: { increment: 1 } },
      }).catch(() => {})

    } else {
      // ── Auto mode: AI intent parsing + smart decomposition ───────────────
      intent = await parseIntent(goalForProcessing)
      subtaskDefinitions = decomposeTask(intent)
    }

    // Override models with user's routing preferences
    const userPrefs = await prisma.userRoutingPreference.findMany({
      where: { userId: task.userId },
    })
    const prefMap = new Map(userPrefs.map((p) => [p.taskCategory, p.preferredModel]))

    for (const def of subtaskDefinitions) {
      const override = prefMap.get(def.category)
      if (override) def.assignedModel = override as any
    }

    // Guard: reject DAGs with cycles before touching the DB
    if (detectCycles(subtaskDefinitions)) {
      throw new Error('Cycle detected in subtask dependency graph — task aborted')
    }

    // Step 3: Initialize context — inject user memory + clarification answers
    const [memoryContext, clarificationContext] = await Promise.all([
      getMemoryContext(task.userId),
      buildClarificationContext(task.id),
    ])

    const enrichedGoal = [
      goalForProcessing,
      memoryContext     ? `\n${memoryContext}` : '',
      clarificationContext ? `\n${clarificationContext}` : '',
    ].join('')

    await initializeContext({
      taskId: task.id,
      originalGoal: enrichedGoal,
      userId: task.userId,
      language: langContext.originalLanguage.code,
      constraints: intent?.constraints ?? [],
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
            assignedModel: def.assignedModel as any,
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
