/**
 * Workflow Executor — Enterprise Grade
 *
 * Executes multi-step Arivarangam workflows where each step is a Task.
 * Supports sequential and parallel step execution, output interpolation,
 * error recovery, and webhook triggers.
 *
 * Flow:
 *   1. runWorkflow() creates a WorkflowRun + WorkflowStepRun for each step
 *   2. Steps without dependsOn execute immediately (parallel)
 *   3. After each step's Task completes, dependent steps are triggered
 *   4. Output mapping extracts named values from task output for {{variable}} injection
 *   5. On completion: WorkflowRun marked COMPLETED, notifications sent
 */
import { prisma } from '@arivarangam/db'
import { enqueueTask } from '../jobs/queue'
import { createNotification } from './notifications'
import crypto from 'node:crypto'

// ─── Output extraction ────────────────────────────────────────────────────────

/**
 * Extract named values from a task's completed subtask outputs.
 * outputMapping: { "research_summary": "summarise key findings in 2 sentences" }
 * This runs a lightweight Claude call to extract each mapped field.
 * For performance: uses a single combined extraction prompt.
 */
async function extractOutputValues(
  taskId: string,
  outputMapping: Record<string, string>,
): Promise<Record<string, string>> {
  if (Object.keys(outputMapping).length === 0) return {}

  const subtasks = await prisma.subtask.findMany({
    where:   { taskId, status: 'COMPLETED', role: 'SYNTHESIS' },
    include: { output: true },
    orderBy: { executionOrder: 'asc' },
    take:    1,
  })

  // Fall back to last INITIAL subtask if no synthesis exists
  const lastSubtask = subtasks[0] ?? (
    await prisma.subtask.findFirst({
      where:   { taskId, status: 'COMPLETED', role: 'INITIAL' },
      include: { output: true },
      orderBy: { executionOrder: 'desc' },
    })
  )

  if (!lastSubtask?.output?.content) return {}

  const content = lastSubtask.output.content.slice(0, 6000)
  const result: Record<string, string> = {}

  // Simple extraction — find each mapped key using Claude
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const extractionList = Object.entries(outputMapping)
      .map(([key, instruction]) => `"${key}": ${instruction}`)
      .join('\n')

    const response = await anthropic.messages.create({
      model:      'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      system:     'Extract specific values from the provided text. Return ONLY valid JSON with the requested keys.',
      messages:   [{
        role:    'user',
        content: `Text:\n${content}\n\nExtract these values:\n${extractionList}\n\nReturn JSON: { "key": "extracted value", ... }`,
      }],
    })

    const text = response.content.filter((b) => b.type === 'text').map((b) => (b as any).text).join('')
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      Object.assign(result, parsed)
    }
  } catch {
    // Non-critical — workflow continues without extracted values
  }

  return result
}

/**
 * Interpolate {{variable}} placeholders in a goal template.
 * Variables come from previous step outputs and trigger payload.
 * e.g. "Write a blog post about {{step1.research_summary}}"
 */
export function interpolateGoal(
  template:        string,
  stepOutputs:     Record<string, Record<string, string>>,
  triggerPayload:  Record<string, string> = {},
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const parts = path.trim().split('.')
    if (parts[0] === 'trigger') {
      return triggerPayload[parts.slice(1).join('.')] ?? match
    }
    if (parts.length >= 2) {
      const [stepKey, ...valuePath] = parts
      const stepValues = stepOutputs[stepKey] ?? {}
      return stepValues[valuePath.join('.')] ?? match
    }
    return match
  })
}

// ─── Core execution ───────────────────────────────────────────────────────────

export interface WorkflowRunResult {
  runId:   string
  status:  'started' | 'failed'
  message: string
}

/**
 * Start a workflow run. Creates WorkflowRun + initial step runs + Tasks for ready steps.
 */
export async function runWorkflow(
  workflowId:     string,
  triggerType:    'manual' | 'scheduled' | 'webhook' = 'manual',
  triggerPayload: Record<string, string> = {},
): Promise<WorkflowRunResult> {
  const workflow = await prisma.workflow.findUnique({
    where:   { id: workflowId },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  })

  if (!workflow) throw new Error(`Workflow ${workflowId} not found`)
  if (workflow.status !== 'ACTIVE') throw new Error(`Workflow is not active`)
  if (workflow.steps.length === 0) throw new Error(`Workflow has no steps`)

  const run = await prisma.workflowRun.create({
    data: {
      workflowId,
      status:         'RUNNING',
      triggerType,
      triggerPayload: triggerPayload as any,
    },
  })

  // Create step runs for all steps (all start as 'pending')
  await Promise.all(
    workflow.steps.map((step) =>
      prisma.workflowStepRun.create({
        data: { runId: run.id, stepId: step.id, status: 'pending' },
      })
    )
  )

  // Find steps with no dependencies — execute them immediately
  const readySteps = workflow.steps.filter((s) => !s.dependsOnStepId)

  for (const step of readySteps) {
    await executeWorkflowStep(run.id, step.id, workflow.userId, triggerPayload, {})
  }

  return {
    runId:   run.id,
    status:  'started',
    message: `Workflow started — ${readySteps.length} step(s) running`,
  }
}

/**
 * Execute a single workflow step by creating and enqueuing a Arivarangam Task.
 */
async function executeWorkflowStep(
  runId:          string,
  stepId:         string,
  userId:         string,
  triggerPayload: Record<string, string>,
  previousOutputs: Record<string, Record<string, string>>,
): Promise<void> {
  const step = await prisma.workflowStep.findUnique({
    where:   { id: stepId },
    include: { workflow: { select: { workspaceId: true } } },
  })
  if (!step) return

  // Interpolate goal with previous step outputs
  const goal = interpolateGoal(step.goalTemplate, previousOutputs, triggerPayload)

  // Create Arivarangam task for this step (skip clarification for workflow tasks)
  const task = await prisma.task.create({
    data: {
      userId,
      workspaceId: step.workflow.workspaceId ?? undefined,
      originalGoal: goal,
      title:        step.name,
      status:       'PENDING',
      templateId:   step.templateId ?? undefined,
    },
  })

  // Update step run with taskId and set to running
  await prisma.workflowStepRun.updateMany({
    where: { runId, stepId },
    data:  { taskId: task.id, status: 'running', startedAt: new Date() },
  })

  // Enqueue — bypasses clarification (automated workflow)
  await enqueueTask(task.id)
}

/**
 * Called after a workflow step's Task completes.
 * Extracts outputs, triggers dependent steps, or marks workflow complete.
 * Call this from queue.ts after task_completed event.
 */
export async function onWorkflowStepComplete(taskId: string): Promise<void> {
  // Find which step run this task belongs to
  const stepRun = await prisma.workflowStepRun.findFirst({
    where:   { taskId },
    include: {
      run: {
        include: {
          workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
          stepRuns: true,
        },
      },
    },
  })

  if (!stepRun || stepRun.status === 'completed') return

  const { run } = stepRun
  const step = run.workflow.steps.find((s) => s.id === stepRun.stepId)
  if (!step) return

  // Extract output values from this step's task
  const outputMapping = (step.outputMapping ?? {}) as Record<string, string>
  const extractedOutput = await extractOutputValues(taskId, outputMapping)

  // Mark step run as completed with extracted output
  await prisma.workflowStepRun.update({
    where: { id: stepRun.id },
    data:  { status: 'completed', completedAt: new Date(), output: extractedOutput as any },
  })

  // Build all previous step outputs for interpolation (step key = "step{order}")
  const allStepRuns = await prisma.workflowStepRun.findMany({
    where: { runId: run.id },
  })

  const previousOutputs: Record<string, Record<string, string>> = {}
  for (const sr of allStepRuns) {
    const s = run.workflow.steps.find((ws) => ws.id === sr.stepId)
    if (s && sr.output) {
      previousOutputs[`step${s.stepOrder}`] = sr.output as Record<string, string>
    }
  }

  // Find steps that depend on this step and are still pending
  const dependentSteps = run.workflow.steps.filter(
    (s) => s.dependsOnStepId === stepRun.stepId
  )

  for (const dep of dependentSteps) {
    const depRun = allStepRuns.find((sr) => sr.stepId === dep.id)
    if (depRun?.status === 'pending') {
      await executeWorkflowStep(
        run.id,
        dep.id,
        run.workflow.userId,
        (run.triggerPayload ?? {}) as Record<string, string>,
        previousOutputs,
      )
    }
  }

  // Check if all steps are done
  const updatedStepRuns = await prisma.workflowStepRun.findMany({
    where: { runId: run.id },
  })

  const allDone = updatedStepRuns.every(
    (sr) => sr.status === 'completed' || sr.status === 'failed' || sr.status === 'skipped'
  )
  const anyFailed = updatedStepRuns.some((sr) => sr.status === 'failed')

  if (allDone) {
    const finalStatus: 'COMPLETED' | 'FAILED' = anyFailed ? 'FAILED' : 'COMPLETED'

    await prisma.workflowRun.update({
      where: { id: run.id },
      data:  { status: finalStatus, completedAt: new Date() },
    })

    await createNotification({
      userId: run.workflow.userId,
      type:   finalStatus === 'COMPLETED' ? 'task_completed' : 'task_failed',
      title:  finalStatus === 'COMPLETED' ? 'Workflow complete' : 'Workflow failed',
      body:   finalStatus === 'COMPLETED'
        ? `"${run.workflow.name}" completed all ${updatedStepRuns.length} steps successfully.`
        : `"${run.workflow.name}" encountered errors. Check the run details.`,
      link:     `/workflows/${run.workflowId}/runs/${run.id}`,
      metadata: { workflowId: run.workflowId, runId: run.id },
    })
  }
}

/**
 * Generate a secure webhook secret for a workflow.
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Validate a webhook request signature.
 * HMAC-SHA256 of the raw body with the workflow's webhook secret.
 */
export function validateWebhookSignature(
  rawBody:    string,
  signature:  string,
  secret:     string,
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  const expectedBuffer = Buffer.from(`sha256=${expected}`)
  const signatureBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== signatureBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
}
