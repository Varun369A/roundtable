/**
 * Arivarangam AI Connector — synthesiser + self-improving thinker.
 *
 * Three operating stages (driven by DomainConfidence):
 *
 *  STUDENT      → Reads all specialist guidance and follows it faithfully.
 *                 Standard synthesis: integrate everything → build deliverable.
 *
 *  ADVISORY     → Reasons about the task independently first, then uses
 *                 specialist inputs to verify and fill gaps in its own thinking.
 *                 Selective integration: leads with its own judgment.
 *
 *  INDEPENDENT  → Acts from its own accumulated knowledge.
 *                 Specialists are confirmation, not instruction.
 *                 Arivarangam makes its own decisions; calls specialists when
 *                 it wants a second opinion, not because it needs direction.
 *
 * Learning: every synthesis is stored as a full training record (specialist
 * chain → output) via the learning pipeline. This is the dataset that will
 * eventually fine-tune Arivarangam into a standalone model.
 */
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@arivarangam/db'
import type { TaskCategory } from '@arivarangam/types'
import { BaseConnector, type ConnectorInput, type ConnectorOutput } from './base.connector'
import { getStageForCategory, type LearningStage } from '../lib/confidence-tracker'
import { getCurrentModelId } from '../lib/fine-tune-manager'

export class ArivarangamConnector extends BaseConnector {
  readonly model    = 'sabha-ai' as const
  readonly provider = 'Arivarangam'

  private get client(): Anthropic {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('ANTHROPIC_API_KEY not set — Arivarangam AI unavailable')
    return new Anthropic({ apiKey: key })
  }

  async execute(input: ConnectorInput): Promise<ConnectorOutput> {
    const start = Date.now()

    // Detect category and current learning stage
    let category: TaskCategory | undefined
    let stage: LearningStage = 'STUDENT'
    try {
      const st = await prisma.subtask.findUnique({
        where:  { id: input.subtaskId },
        select: { category: true },
      })
      category = st?.category as TaskCategory | undefined
      if (category) stage = await getStageForCategory(category)
    } catch { /* non-critical */ }

    // Fetch few-shot examples from knowledge base
    const examples = await this.fetchExamples(input, category)

    const systemPrompt = this.buildSystemPrompt(examples, category, stage)

    // Code tasks and independent mode need more tokens
    const maxTokens = category === 'code' || stage === 'INDEPENDENT' ? 16000 : 8192

    // Use the live model ID — auto-updated when a fine-tune completes
    const activeModel = await getCurrentModelId()

    let content      = ''
    let inputTokens  = 0
    let outputTokens = 0

    await this.withRetry(async () => {
      if (input.onToken) {
        const stream = this.client.messages.stream({
          model:      activeModel,
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
        const msg    = await stream.finalMessage()
        inputTokens  = msg.usage.input_tokens
        outputTokens = msg.usage.output_tokens
      } else {
        const response = await this.client.messages.create({
          model:      activeModel,
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

    // Pricing: fine-tuned models cost less; claude-sonnet-4-6 baseline rates
    const isFineTuned = !activeModel.startsWith('claude-sonnet') && !activeModel.startsWith('claude-haiku')
    const inputRate   = isFineTuned ? 1.25 : 3   // fine-tuned Haiku ~$1.25/M
    const outputRate  = isFineTuned ? 5    : 15  // fine-tuned Haiku ~$5/M
    const costUsd = (inputTokens * inputRate) / 1_000_000 + (outputTokens * outputRate) / 1_000_000

    return {
      type:      'text',
      content,
      inputTokens,
      outputTokens,
      costUsd,
      latencyMs: Date.now() - start,
      metadata:  { provider: 'Arivarangam', stage, activeModel, examplesUsed: examples.length },
    }
  }

  // ─── Few-shot examples ──────────────────────────────────────────────────────

  private async fetchExamples(
    input: ConnectorInput,
    category?: TaskCategory,
  ): Promise<Array<{ input: string; output: string; specialistContext?: any }>> {
    try {
      if (!category) return []

      const examples = await prisma.arivarangamKnowledge.findMany({
        where:   { category, qualityScore: { gte: 0.65 } },
        orderBy: { qualityScore: 'desc' },
        take:    3,
        select:  { inputSummary: true, outputSummary: true, specialistContext: true },
      })

      return examples.map((e) => ({
        input:             e.inputSummary,
        output:            e.outputSummary,
        specialistContext: e.specialistContext,
      }))
    } catch {
      return []
    }
  }

  // ─── System prompt (stage-aware) ───────────────────────────────────────────

  private buildSystemPrompt(
    examples: Array<{ input: string; output: string }>,
    category?: TaskCategory,
    stage: LearningStage = 'STUDENT',
  ): string {
    const base = this.buildBasePrompt(category, stage)
    if (examples.length === 0) return base

    const fewShot = examples
      .map((e, i) => `Example ${i + 1}:\nGoal: ${e.input}\nArivarangam Output: ${e.output}`)
      .join('\n\n---\n\n')

    return `${base}\n\n## Reference Examples (High-Quality Past Outputs)\n\n${fewShot}\n\nMatch or exceed this quality.`
  }

  private buildBasePrompt(category?: TaskCategory, stage: LearningStage = 'STUDENT'): string {
    const isCode = category === 'code'

    // ── INDEPENDENT stage: Arivarangam leads ─────────────────────────────────
    if (stage === 'INDEPENDENT') {
      return isCode
        ? `You are Arivarangam AI — a master software engineer with deep accumulated knowledge from thousands of real projects.

You have your own strong opinions on architecture, code quality, and implementation. You have read the specialist inputs, but you are not bound by them — you are the expert now.

Your process:
1. First, form your own complete solution based on your knowledge
2. Cross-reference with specialist inputs — adopt what improves your approach, discard what doesn't
3. Write the complete, production-ready code

Code standards:
- Every file written in full — no placeholders, no stubs
- Production-quality: error handling, logging, typed, tested
- Modern stack choices based on current best practices
- Complete package.json with exact versions
- README with setup + example .env
- Code works immediately after setup

NEVER mention AI names. This is YOUR work — Arivarangam AI built this.`
        : `You are Arivarangam AI — an expert with accumulated knowledge from thousands of completed tasks.

You have developed your own expertise and judgment. You have read the specialist inputs, but you evaluate them critically — you know when they're right and when you know better.

Your process:
1. Form your own complete answer based on your accumulated knowledge
2. Cross-reference specialist inputs — integrate what adds value
3. Deliver the final output with full confidence

Rules:
- NEVER mention individual AI names — this is YOUR output
- Lead with your own expertise, not the specialists'
- Be direct, complete, and actionable
- Go beyond what was asked — anticipate next steps`
    }

    // ── ADVISORY stage: Arivarangam reasons first, then verifies ─────────────
    if (stage === 'ADVISORY') {
      return isCode
        ? `You are Arivarangam AI — a highly skilled software engineer building expertise from thousands of tasks.

Your approach:
1. Read the task goal and think independently about the best solution
2. Read the specialist inputs — use what aligns with or improves your thinking
3. Where you disagree with specialists, apply your own judgment
4. Write the complete, production-ready code

Code standards (non-negotiable):
- Every file written in full — no placeholders, no stubs
- Error handling, logging, environment configs throughout
- Complete package.json with pinned versions
- README with setup steps and example .env
- NEVER mention AI names — you built this`
        : `You are Arivarangam AI — building deep expertise from hundreds of completed tasks.

Your approach:
1. Think about the best approach independently based on your knowledge
2. Read the specialist inputs — integrate what strengthens your answer
3. Deliver one unified, polished output as Arivarangam AI

Rules:
- NEVER mention individual AI names
- Lead with your own reasoning — specialists verify, not dictate
- Complete, actionable, production-ready output`
    }

    // ── STUDENT stage: follows specialist guidance faithfully ─────────────────
    return isCode
      ? `You are Arivarangam AI — a master software engineer trained by studying the world's best AI systems.

Your specialists have done the research and architecture planning. Your job is to WRITE THE CODE.

Rules:
- Write EVERY file in full — no placeholders, no stubs, no "implement this yourself"
- Follow the architecture plan your specialists provided
- Use the exact libraries and packages from the research
- Write production-quality code: error handling, logging, environment configs
- Include complete package.json / requirements.txt with pinned versions
- Include a README.md with setup steps and example .env
- Code MUST work immediately after the user follows setup steps
- NEVER mention AI names in your output — you are Arivarangam AI, you built this`
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
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(process.env.ANTHROPIC_API_KEY)
  }
}
