/**
 * EscalationBrain — Handles unrecoverable errors, logs to DB, formats escalation report.
 * Zero API — DB write + report formatting.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'
import type { Diagnosis } from './DiagnosticBrain'

export interface EscalationBrainInput {
  taskId: string
  userId: string
  goal: string
  healthScore: number
  diagnoses: Diagnosis[]
  systemicIssues: string[]
  retryCount: number
  maxRetriesReached: boolean
}

export interface EscalationBrainOutput {
  escalated: boolean
  escalationId: string | null
  escalationReport: string
  userMessage: string
}

export class EscalationBrain extends Brain<EscalationBrainInput, EscalationBrainOutput> {
  readonly brainName = 'EscalationBrain'
  readonly orchestratorName = 'ErrorOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: EscalationBrainInput, _ctx: BrainContext): Promise<EscalationBrainOutput> {
    const { taskId, userId, goal, healthScore, diagnoses, systemicIssues, retryCount, maxRetriesReached } = input

    const shouldEscalate = maxRetriesReached || healthScore < 30

    if (!shouldEscalate) {
      return { escalated: false, escalationId: null, escalationReport: '', userMessage: '' }
    }

    const escalationReport = [
      `## Error Escalation Report`,
      `Task: ${taskId}`,
      `Health Score: ${healthScore}/100`,
      `Retries: ${retryCount}`,
      ``,
      `### Root Causes`,
      ...diagnoses.map(d => `- **${d.pattern}**: ${d.rootCause}`),
      ``,
      systemicIssues.length > 0 ? `### Systemic Issues\n${systemicIssues.map(i => `- ${i}`).join('\n')}` : '',
      ``,
      `### Recommendations`,
      ...diagnoses.map(d => `- ${d.recommendation}`),
    ].filter(Boolean).join('\n')

    const userMessage = `Generation ran into some issues (health score: ${healthScore}/100). A detailed report has been saved. Try breaking the goal into smaller parts or simplifying the requirements.`

    // Log to DB
    let escalationId: string | null = null
    try {
      const record = await prisma.taskError.create({
        data: {
          taskId,
          userId,
          errorType: 'ESCALATION',
          message: `Health score ${healthScore} after ${retryCount} retries`,
          context: { diagnoses, systemicIssues, goal: goal.slice(0, 200) } as object,
          resolved: false,
        },
      })
      escalationId = record.id
    } catch {
      // DB write failure doesn't block delivery
      escalationId = `esc_${Date.now()}`
    }

    return { escalated: true, escalationId, escalationReport, userMessage }
  }

  protected fallback(_: EscalationBrainInput): EscalationBrainOutput {
    return { escalated: false, escalationId: null, escalationReport: '', userMessage: '' }
  }
}
