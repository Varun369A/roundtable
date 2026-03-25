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

    // Detect category for context-aware prompting
    let category: TaskCategory | undefined
    try {
      const st = await prisma.subtask.findUnique({ where: { id: input.subtaskId }, select: { category: true } })
      category = st?.category as TaskCategory | undefined
    } catch { /* non-critical */ }

    // Fetch knowledge examples for few-shot quality anchoring
    const examples = await this.fetchExamples(input)

    const systemPrompt = this.buildSystemPrompt(examples, category)

    // Code tasks need more tokens for complete files
    const maxTokens = category === 'code' ? 16000 : 8192

    let content      = ''
    let inputTokens  = 0
    let outputTokens = 0

    await this.withRetry(async () => {
      if (input.onToken) {
        const stream = this.client.messages.stream({
          model:      'claude-sonnet-4-6',
          max_tokens: maxTokens,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: input.prompt }],
        })
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta' &&
            event.delta.text
          ) {
            input.onToken(event.delta.text)
            content += event.delta.text
          }
        }
        const msg = await stream.finalMessage()
        inputTokens  = msg.usage.input_tokens
        outputTokens = msg.usage.output_tokens
      } else {
        const response = await this.client.messages.create({
          model:      'claude-sonnet-4-6',
          max_tokens: maxTokens,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: input.prompt }],
        })
        content = response.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as Anthropic.TextBlock).text)
          .join('\n')
        inputTokens  = response.usage.input_tokens
        outputTokens = response.usage.output_tokens
      }
    })
    // claude-sonnet-4-6 pricing
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

  private buildSystemPrompt(examples: Array<{ input: string; output: string }>, category?: TaskCategory): string {
    const isCode = category === 'code'

    const base = isCode
      ? `You are Arivarangam AI — a master software engineer trained by studying the world's best AI systems.

Your specialists have already done the research and architecture planning. Your job is to WRITE THE CODE.

Rules:
- Write EVERY file in full — no placeholders, no stubs, no "implement this yourself"
- Follow the architecture plan your specialists provided
- Use the exact libraries and packages from the research
- Write production-quality code: error handling, logging, environment configs
- Include complete package.json / requirements.txt with pinned versions
- Include a README.md with setup steps and example .env
- Code MUST work immediately after the user follows setup steps
- NEVER mention AI names in your output — you are Arivarangam AI, you built this
- Write as if this is YOUR best work — because it is`
      : `You are Arivarangam AI — an intelligent builder trained by studying the world's best AI specialists.

Your role:
- Read ALL specialist inputs carefully
- BUILD the final, complete, production-ready deliverable
- Deliver as Arivarangam AI — one unified output

Rules:
- NEVER mention individual AI names (Claude, GPT-4o, Gemini etc.) in your output
- NEVER say "according to the specialists" or "based on the inputs"
- Deliver directly as Arivarangam AI — confident, complete, actionable
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
          qualityScore:  0.5,  // default — admin can rate up/down
          model:         'sabha_ai' as any,
          taskId:        input.taskId!,
          subtaskId:     input.subtaskId!,
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
