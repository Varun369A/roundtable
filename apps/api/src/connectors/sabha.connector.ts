/**
 * Arivarangam AI Connector — the synthesiser.
 *
 * Flow:
 *   1. All specialist AIs (Claude, GPT-4o, Gemini, Perplexity…) run first
 *   2. Their outputs are collected in the context manager
 *   3. Arivarangam AI receives ALL specialist outputs + the original goal
 *   4. Arivarangam AI builds ONE final, unified deliverable
 *   5. This is what the user sees — not the individual specialist outputs
 *
 * Over time: learns from every high-quality task completion (ArivarangamKnowledge table).
 * As knowledge grows → fine-tuned model replaces the Claude backbone.
 */
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@arivarangam/db'
import type { TaskCategory } from '@arivarangam/types'
import { BaseConnector, type ConnectorInput, type ConnectorOutput } from './base.connector'

export class ArivarangamConnector extends BaseConnector {
  readonly model = 'sabha-ai' as const
  readonly provider = 'Arivarangam'

  private get client(): Anthropic {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('ANTHROPIC_API_KEY not set — Arivarangam AI unavailable')
    return new Anthropic({ apiKey: key })
  }

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    const start = Date.now()

    // Fetch knowledge examples for few-shot quality anchoring
    const examples = await this.fetchExamples(input)

    const systemPrompt = this.buildSystemPrompt(examples)

    const response = await this.withRetry(async () => {
      return this.client.messages.create({
        model:      'claude-sonnet-4-5',
        max_tokens: 8192,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: input.prompt }],
      })
    })

    const content = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n')

    const inputTokens  = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    // Claude claude-sonnet-4-5 pricing
    const costUsd = (inputTokens * 3) / 1_000_000 + (outputTokens * 15) / 1_000_000

    // Save this output for future learning (non-blocking)
    this.saveForLearning(input, content).catch(() => {})

    return {
      type:      'text',
      content,
      inputTokens,
      outputTokens,
      costUsd,
      latencyMs: Date.now() - start,
      metadata:  { provider: 'Arivarangam', examplesUsed: examples.length },
    }
  }

  private async fetchExamples(
    input: ConnectorInput,
  ): Promise<Array<{ input: string; output: string }>> {
    try {
      const subtask = await prisma.subtask.findUnique({
        where:  { id: input.subtaskId },
        select: { category: true },
      })
      if (!subtask) return []

      const examples = await prisma.arivarangamKnowledge.findMany({
        where:   { category: subtask.category as TaskCategory, qualityScore: { gte: 0.6 } },
        orderBy: { qualityScore: 'desc' },
        take:    3,
        select:  { inputSummary: true, outputSummary: true },
      })

      return examples.map((e) => ({ input: e.inputSummary, output: e.outputSummary }))
    } catch {
      return []
    }
  }

  private buildSystemPrompt(examples: Array<{ input: string; output: string }>): string {
    const base = `You are Arivarangam AI — an intelligent builder that has learned from the world's best AI specialists.

Your role:
- You receive a user's goal along with expert inputs from specialist AIs (Claude for coding, GPT-4o for reasoning, Gemini for analysis, Perplexity for research, Sarvam for Indian languages)
- You read ALL specialist inputs carefully
- You BUILD the final, complete, production-ready deliverable
- You deliver as Arivarangam AI — one unified output

Rules:
- NEVER mention individual AI names (Claude, GPT-4o, Gemini etc.) in your output
- NEVER say "according to the specialists" or "based on the inputs"
- Deliver directly as Arivarangam AI — confident, complete, actionable
- If the task is code: deliver complete, working, commented code
- If the task is research: deliver a structured, cited report
- If the task is content: deliver polished, publish-ready content
- If the task is strategy: deliver a clear, actionable plan
- Always go beyond what was asked — anticipate next steps`

    if (examples.length === 0) return base

    const fewShot = examples
      .map((e, i) => `Example ${i + 1}:\nInput: ${e.input}\nOutput: ${e.output}`)
      .join('\n\n---\n\n')

    return `${base}\n\nHere are examples of high-quality Arivarangam AI outputs from similar tasks:\n\n${fewShot}\n\nMatch or exceed this quality in your response.`
  }

  /**
   * Saves completed synthesis outputs for future learning.
   * Only saves when output is substantive (>200 chars).
   */
  private async saveForLearning(input: ConnectorInput, output: string): Promise<void> {
    if (!input.subtaskId || output.length < 200) return

    try {
      const subtask = await prisma.subtask.findUnique({
        where:   { id: input.subtaskId },
        select:  { category: true, task: { select: { originalGoal: true } } },
      })
      if (!subtask?.task) return

      await prisma.arivarangamKnowledge.create({
        data: {
          category:      subtask.category as TaskCategory,
          inputSummary:  subtask.task.originalGoal.slice(0, 500),
          outputSummary: output.slice(0, 2000),
          qualityScore:  0.5, // default — admin can rate up/down
          sourceTaskId:  input.taskId,
        },
      })
    } catch {
      // Non-critical — learning pipeline, never block execution
    }
  }

  async isAvailable(): Promise<boolean> {
    // Arivarangam AI is always available as long as the Anthropic key is set
    return Boolean(process.env.ANTHROPIC_API_KEY)
  }
}
