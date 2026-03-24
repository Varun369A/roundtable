/**
 * Arivarangam Connector
 *
 * A meta-AI that has learned from all tasks processed on the Arivarangam platform.
 * Uses Claude as its backbone with RAG-style few-shot examples drawn from
 * the ArivarangamKnowledge table — outputs that real users rated highly across
 * all categories.
 *
 * During LEARNING phase: silent (not routed to)
 * After admin enables: replaces general/text tasks with Arivarangam
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

    // Fetch top relevant examples from knowledge base
    const examples = await this.fetchExamples(input)

    // Build system prompt with Arivarangam's knowledge
    const systemPrompt = this.buildSystemPrompt(examples)

    const response = await this.withRetry(async () => {
      return this.client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: input.prompt }],
      })
    })

    const content = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n')

    const inputTokens  = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    // Claude 3.5 Sonnet pricing
    const costUsd = (inputTokens * 3) / 1_000_000 + (outputTokens * 15) / 1_000_000

    return {
      type: 'text',
      content,
      inputTokens,
      outputTokens,
      costUsd,
      latencyMs: Date.now() - start,
      metadata: { provider: 'Arivarangam', examplesUsed: examples.length },
    }
  }

  private async fetchExamples(input: ConnectorInput): Promise<Array<{ input: string; output: string }>> {
    try {
      // Extract category from subtask context
      const subtask = await prisma.subtask.findUnique({
        where: { id: input.subtaskId },
        select: { category: true },
      })
      if (!subtask) return []

      const examples = await prisma.arivarangamKnowledge.findMany({
        where: { category: subtask.category as TaskCategory, qualityScore: { gte: 0.6 } },
        orderBy: { qualityScore: 'desc' },
        take: 5,
        select: { inputSummary: true, outputSummary: true },
      })

      return examples.map((e) => ({ input: e.inputSummary, output: e.outputSummary }))
    } catch {
      return []
    }
  }

  private buildSystemPrompt(examples: Array<{ input: string; output: string }>): string {
    const base = `You are Arivarangam, an intelligent assistant trained on thousands of real-world tasks completed on the Arivarangam platform. You have deep knowledge of strategy, research, content creation, business analysis, and software development. You produce outputs that are structured, actionable, and high-quality.`

    if (examples.length === 0) return base

    const fewShot = examples
      .map((e, i) => `Example ${i + 1}:\nInput: ${e.input}\nOutput: ${e.output}`)
      .join('\n\n---\n\n')

    return `${base}\n\nHere are examples of high-quality outputs from similar tasks on Arivarangam:\n\n${fewShot}\n\nMatch or exceed this quality in your response.`
  }

  async isAvailable(): Promise<boolean> {
    try {
      const state = await prisma.arivarangamAIState.findUnique({ where: { id: 'singleton' } })
      return state?.status === 'ENABLED'
    } catch {
      return false
    }
  }
}
