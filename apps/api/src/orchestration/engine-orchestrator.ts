/**
 * engine-orchestrator.ts — Entry point for the 3-Engine intelligence pipeline.
 *
 * This runs in parallel to the existing roundtable orchestrator (orchestrator.ts).
 * Routes: UnderstandingEngine → BuildEngine → IntelligenceEngine
 *
 * Called by: jobs/code-gen-worker.ts (via codeGenQueue)
 * Used for: Code generation tasks (isCodeTask = true from IntentBrain)
 */

import { prisma } from '@arivarangam/db'
import { redis } from '../lib/redis'
import { UnderstandingEngine } from '../engines/UnderstandingEngine'
import { BuildEngine } from '../engines/BuildEngine'
import { IntelligenceEngine } from '../engines/IntelligenceEngine'
import type { IntelligenceEngineOutput } from '../engines/IntelligenceEngine'
import { calculateTaskCredits, debitWallet, InsufficientCreditsError } from '../lib/credit-manager'
import { generateSuggestions } from '../lib/suggestion-engine'

const MAX_RETRIES = 3
const UNDERSTANDING_TTL = 7200 // 2 hours

/** Redis key for saved understanding output (plan pause flow) */
export const understandingKey = (taskId: string) => `sabha:understanding:${taskId}`

/**
 * Full 3-Engine pipeline for code generation tasks.
 * Handles retry loop internally (Gate FAIL → rebuild with fix instructions).
 *
 * Options:
 *   skipUnderstanding — load saved understanding output from Redis (plan was pre-approved)
 *   planModification  — user's custom instruction added at approval time
 */
export async function orchestrateWithEngines(
  taskId: string,
  options: { skipUnderstanding?: boolean; planModification?: string } = {},
): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, originalGoal: true, userId: true, status: true },
  })
  if (!task) throw new Error(`Task ${taskId} not found`)

  const processingStart = Date.now()

  await prisma.task.update({ where: { id: taskId }, data: { status: 'IN_PROGRESS' } })

  // Emit start event
  redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
    event: 'engine_started',
    taskId,
    pipeline: ['UnderstandingEngine', 'BuildEngine', 'IntelligenceEngine'],
  })).catch(() => {})

  try {
    let understandingOutput: Awaited<ReturnType<InstanceType<typeof UnderstandingEngine>['run']>>

    if (options.skipUnderstanding) {
      // ── Load pre-computed understanding output (plan was already approved) ─
      const saved = await redis.get(understandingKey(taskId))
      if (!saved) throw new Error(`No saved understanding output for task ${taskId} — plan may have expired`)
      understandingOutput = JSON.parse(saved) as typeof understandingOutput
      await redis.del(understandingKey(taskId)) // clean up

      redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
        event: 'task:progress', taskId, step: 'architecture', message: 'Plan approved — designing architecture…', progress: 25,
      })).catch(() => {})
    } else {
      // ── Engine 1: Understanding ──────────────────────────────────────────
      redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
        event: 'task:progress', taskId, step: 'understanding', message: 'Understanding your request…', progress: 10,
      })).catch(() => {})

      const understanding = new UnderstandingEngine()
      understandingOutput = await understanding.run({
        taskId,
        userId: task.userId,
        goal: task.originalGoal,
      })

      // Check if clarification is needed
      const clarification = (understandingOutput.orchestratorOutputs?.['IntentOrchestrator'] as Record<string, unknown>)?.['ClarificationBrain'] as Record<string, unknown> | undefined
      if (clarification?.['needsClarification']) {
        const questions = clarification?.['clarificationQuestions'] as string[] | undefined
        if (questions && questions.length > 0) {
          redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
            event: 'clarification_needed',
            taskId,
            questions: questions.map((q, i) => ({ id: `q_${i}`, question: q, orderIndex: i })),
          })).catch(() => {})
          await prisma.task.update({ where: { id: taskId }, data: { status: 'WAITING_CLARIFICATION' } })
          return
        }
      }

      // ── Pause for plan confirmation ──────────────────────────────────────
      // Extract key intent signals for the plan card
      const intentOrch = understandingOutput.orchestratorOutputs?.['IntentOrchestrator'] as Record<string, unknown> | undefined
      const intentBrain = intentOrch?.['IntentBrain'] as Record<string, unknown> | undefined
      const contextBrain = intentOrch?.['ContextBrain'] as Record<string, unknown> | undefined
      const complexity = (intentBrain?.['complexity'] as string) ?? 'medium'
      const detectedTech = (contextBrain?.['detectedTech'] as string[]) ?? []
      const domain = (contextBrain?.['domain'] as string) ?? 'general'

      // Save understanding output to Redis (TTL: 2h)
      await redis.set(understandingKey(taskId), JSON.stringify(understandingOutput), 'EX', UNDERSTANDING_TTL)

      // Update task status to awaiting plan approval
      await prisma.task.update({ where: { id: taskId }, data: { status: 'AWAITING_PLAN_APPROVAL' } })

      // Emit plan_ready — frontend shows approval card
      redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
        event: 'plan_ready',
        taskId,
        plan: {
          goal: task.originalGoal.slice(0, 120),
          complexity,
          domain,
          detectedTech,
          estimatedFiles: complexity === 'low' ? 6 : complexity === 'high' ? 20 : 12,
          estimatedMinutes: complexity === 'low' ? 1 : complexity === 'high' ? 3 : 2,
        },
      })).catch(() => {})

      return  // Job exits — approval endpoint will re-queue with skipUnderstanding: true
    }

    redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
      event: 'task:progress', taskId, step: 'architecture', message: 'Designing architecture…', progress: 25,
    })).catch(() => {})

    // ── Engine 2: Build (with retry loop) ─────────────────────────────────
    let buildOutput
    let intelligenceOutput: IntelligenceEngineOutput | undefined
    let retryCount = 0
    // Prepend any user modification from plan approval stage
    let retryPromptAddition = options.planModification
      ? `User modification request at plan approval: ${options.planModification}`
      : ''

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      retryCount = attempt

      if (attempt > 0) {
        redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
          event: 'task:progress', taskId, step: 'rebuild',
          message: `Quality check failed — rebuilding (attempt ${attempt + 1}/${MAX_RETRIES})…`,
          progress: 30 + attempt * 10,
        })).catch(() => {})
      } else {
        redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
          event: 'task:progress', taskId, step: 'generating',
          message: 'Generating code files…', progress: 35,
        })).catch(() => {})
      }

      const build = new BuildEngine()
      buildOutput = await build.run({
        taskId,
        userId: task.userId,
        goal: task.originalGoal,
        understandingOutputs: understandingOutput.orchestratorOutputs,
        retryPromptAddition,
        retryCount,
      })

      redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
        event: 'task:progress', taskId, step: 'quality',
        message: 'Running quality checks…', progress: 70,
      })).catch(() => {})

      // ── Engine 3: Intelligence ─────────────────────────────────────────
      const intelligence = new IntelligenceEngine()
      intelligenceOutput = await intelligence.run({
        taskId,
        userId: task.userId,
        goal: task.originalGoal,
        previousOutputs: {
          ...understandingOutput.orchestratorOutputs,
          ...buildOutput.orchestratorOutputs,
          totalTokensUsed: buildOutput.totalTokensUsed + understandingOutput.totalTokensUsed,
          retryCount,
        },
        retryCount,
        processingStartTime: processingStart,
      })

      // If gate passed or max retries, exit loop
      if (!intelligenceOutput.shouldRetry || attempt >= MAX_RETRIES - 1) break
      retryPromptAddition = intelligenceOutput.retryInstructions.join('\n')
    }

    if (!intelligenceOutput) throw new Error('Intelligence engine produced no output')

    // ── Persist final files to DB ──────────────────────────────────────────
    const finalFiles = intelligenceOutput.finalFiles as Array<{
      path: string
      content: string
      language: string
      linesOfCode: number
      purpose: string
    }>

    if (finalFiles.length > 0) {
      await prisma.codeProject.upsert({
        where: { taskId },
        create: {
          taskId,
          userId: task.userId,
          name: task.originalGoal.slice(0, 60),
          files: finalFiles as object[],
          qualityScore: intelligenceOutput.overallScore,
          qualityGrade: intelligenceOutput.qualityGrade,
          status: intelligenceOutput.qualityGrade === 'F' ? 'DRAFT' : 'COMPLETE',
        },
        update: {
          files: finalFiles as object[],
          qualityScore: intelligenceOutput.overallScore,
          qualityGrade: intelligenceOutput.qualityGrade,
        },
      })
    }

    // ── Complete task ──────────────────────────────────────────────────────
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        qualityScore: intelligenceOutput.overallScore,
        title: task.originalGoal.slice(0, 60) + (task.originalGoal.length > 60 ? '…' : ''),
      },
    })

    await prisma.usageStats.upsert({
      where: { userId: task.userId },
      update: { totalTasksCompleted: { increment: 1 } },
      create: { userId: task.userId, totalTasksCompleted: 1, totalSubtasksRun: 0 },
    })

    // ── Debit credits ──────────────────────────────────────────────────────
    ;(async () => {
      try {
        const isAdmin = await prisma.user.findUnique({ where: { id: task.userId }, select: { isAdmin: true } })
        if (isAdmin?.isAdmin) return

        const alreadyCharged = await prisma.creditTransaction.findFirst({
          where: { userId: task.userId, taskId, type: 'TASK_USAGE' }, select: { id: true },
        })
        if (alreadyCharged) return

        const credits = calculateTaskCredits(1, false, false)
        await debitWallet(task.userId, credits, 'TASK_USAGE', `Code generation: ${task.originalGoal.slice(0, 50)}`, { taskId })
      } catch (err) {
        if (!(err instanceof InsufficientCreditsError)) {
          console.error(`[CreditManager] Failed to debit for task ${taskId}:`, err)
        }
      }
    })().catch(() => {})

    // ── Final SSE events ───────────────────────────────────────────────────
    redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
      event: 'task_completed',
      taskId,
      hasCodeWorkspace: true,
      qualityGrade: intelligenceOutput.qualityGrade,
      overallScore: intelligenceOutput.overallScore,
      summary: intelligenceOutput.qualitySummary,
      fileCount: finalFiles.length,
    })).catch(() => {})

    // Emit edit_mode_enabled — tells the workspace UI to show the Edit tab
    redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
      event: 'edit_mode_enabled',
      taskId,
    })).catch(() => {})

    // Generate proactive suggestions in background (Phase 3)
    if (finalFiles.length > 0) {
      const codeProject = await prisma.codeProject.findUnique({ where: { taskId }, select: { id: true } })
      if (codeProject) {
        generateSuggestions(codeProject.id, finalFiles as Array<{ path: string; content: string; language: string }>)
          .catch((err) => console.error('[SuggestionEngine] Failed:', err))
      }
    }

  } catch (err) {
    console.error(`[EngineOrchestrator] Failed for task ${taskId}:`, err)
    await prisma.task.update({ where: { id: taskId }, data: { status: 'FAILED' } })
    redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
      event: 'task_failed', taskId, error: err instanceof Error ? err.message : 'Unknown error',
    })).catch(() => {})
    throw err
  }
}
