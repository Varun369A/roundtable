/**
 * Enterprise Output Quality Verification
 * Uses Claude (claude-3-5-sonnet) to verify every SYNTHESIS subtask output.
 * Scores factual accuracy, completeness, and extracts citations.
 */
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@sabha/db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface VerificationResult {
  confidenceScore: number     // 0.0–1.0 overall
  factualScore: number        // factual accuracy estimate
  completenessScore: number   // covers all requirements
  citationsFound: number
  issues: Array<{
    type: 'factual' | 'completeness' | 'citation' | 'coherence' | 'hallucination'
    severity: 'low' | 'medium' | 'high'
    description: string
    suggestion?: string
  }>
  citations: Array<{
    text: string
    source: string
    url?: string
    confidence: number
  }>
}

// ─── Determine status from confidence score ────────────────────────────────────

function scoreToStatus(confidenceScore: number): 'PASSED' | 'PARTIAL' | 'FAILED' {
  if (confidenceScore >= 0.75) return 'PASSED'
  if (confidenceScore >= 0.5) return 'PARTIAL'
  return 'FAILED'
}

// ─── Verify a single subtask output ───────────────────────────────────────────

export async function verifySubtaskOutput(subtaskId: string): Promise<VerificationResult | null> {
  let verificationId: string | null = null

  try {
    // 1. Fetch subtask + output + task (for originalGoal)
    const subtask = await prisma.subtask.findUnique({
      where: { id: subtaskId },
      include: {
        output: true,
        task: { select: { originalGoal: true } },
      },
    })

    if (!subtask) return null

    // 2. Only verify text outputs
    if (!subtask.output || subtask.output.type !== 'text' || !subtask.output.content) {
      return null
    }

    const originalGoal = subtask.task.originalGoal
    const outputText = subtask.output.content

    // 3. Create/update SubtaskVerification record with status='RUNNING'
    const verificationRecord = await prisma.subtaskVerification.upsert({
      where: { subtaskId },
      update: {
        status: 'RUNNING',
        confidenceScore: 0,
        factualScore: 0,
        completenessScore: 0,
        citationsFound: 0,
        issues: [],
        citations: [],
        verifiedAt: null,
        verifiedBy: 'claude-3-5-sonnet-20241022',
      },
      create: {
        subtaskId,
        status: 'RUNNING',
        confidenceScore: 0,
        factualScore: 0,
        completenessScore: 0,
        citationsFound: 0,
        issues: [],
        citations: [],
        verifiedBy: 'claude-3-5-sonnet-20241022',
      },
    })
    verificationId = verificationRecord.id

    // 4. Build verification prompt
    const verificationPrompt = `You are an expert quality verification system. Analyze the following AI-generated output for quality, factual accuracy, completeness, and citations.

## Original Task Goal
${originalGoal}

## Subtask Title
${subtask.title}

## Output to Verify
${outputText.slice(0, 8000)}

## Instructions
Evaluate the output and respond with ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "confidenceScore": 0.85,
  "factualScore": 0.9,
  "completenessScore": 0.8,
  "issues": [
    {
      "type": "completeness",
      "severity": "low",
      "description": "Missing discussion of X",
      "suggestion": "Add a section covering X"
    }
  ],
  "citations": [
    {
      "text": "specific claim made in the output",
      "source": "source name or description",
      "url": "https://optional-url.com",
      "confidence": 0.9
    }
  ]
}

Scoring guidelines:
- confidenceScore: overall quality (0.0–1.0). Below 0.5 = FAILED, 0.5–0.75 = PARTIAL, above 0.75 = PASSED
- factualScore: factual accuracy (0.0–1.0)
- completenessScore: how well the output addresses the original goal (0.0–1.0)
- issues: identify problems found. Types: factual, completeness, citation, coherence, hallucination
- citations: extract verifiable claims with their sources. Only include real, specific claims.

Be rigorous but fair. Return ONLY the JSON object.`

    // 5. Call Claude
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{ role: 'user', content: verificationPrompt }],
    })

    // Parse Claude's response
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    // Strip potential markdown code fences
    const jsonStr = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    let parsed: {
      confidenceScore?: number
      factualScore?: number
      completenessScore?: number
      issues?: unknown[]
      citations?: unknown[]
    }

    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      // If parsing fails, create a minimal result
      parsed = {
        confidenceScore: 0.5,
        factualScore: 0.5,
        completenessScore: 0.5,
        issues: [{ type: 'coherence', severity: 'low', description: 'Verification parsing failed' }],
        citations: [],
      }
    }

    // Clamp scores to [0, 1]
    const clamp = (n: unknown): number => Math.max(0, Math.min(1, Number(n) || 0))

    const result: VerificationResult = {
      confidenceScore: clamp(parsed.confidenceScore),
      factualScore: clamp(parsed.factualScore),
      completenessScore: clamp(parsed.completenessScore),
      citationsFound: Array.isArray(parsed.citations) ? parsed.citations.length : 0,
      issues: Array.isArray(parsed.issues) ? (parsed.issues as VerificationResult['issues']) : [],
      citations: Array.isArray(parsed.citations) ? (parsed.citations as VerificationResult['citations']) : [],
    }

    const status = scoreToStatus(result.confidenceScore)

    // 5. Upsert SubtaskVerification with results
    await prisma.subtaskVerification.update({
      where: { id: verificationId },
      data: {
        status,
        confidenceScore: result.confidenceScore,
        factualScore: result.factualScore,
        completenessScore: result.completenessScore,
        citationsFound: result.citationsFound,
        issues: result.issues,
        citations: result.citations,
        verifiedAt: new Date(),
        verifiedBy: 'claude-3-5-sonnet-20241022',
      },
    })

    return result
  } catch (err) {
    // 7. On error: set status='FAILED' with confidenceScore=0
    console.error(`[QualityVerifier] Failed to verify subtask ${subtaskId}:`, err)

    try {
      if (verificationId) {
        await prisma.subtaskVerification.update({
          where: { id: verificationId },
          data: {
            status: 'FAILED',
            confidenceScore: 0,
            factualScore: 0,
            completenessScore: 0,
            citationsFound: 0,
            issues: [{
              type: 'coherence',
              severity: 'high',
              description: `Verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            }],
            citations: [],
            verifiedAt: new Date(),
          },
        })
      } else {
        await prisma.subtaskVerification.upsert({
          where: { subtaskId },
          update: {
            status: 'FAILED',
            confidenceScore: 0,
            factualScore: 0,
            completenessScore: 0,
            citationsFound: 0,
            issues: [{
              type: 'coherence',
              severity: 'high',
              description: `Verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            }],
            citations: [],
            verifiedAt: new Date(),
          },
          create: {
            subtaskId,
            status: 'FAILED',
            confidenceScore: 0,
            factualScore: 0,
            completenessScore: 0,
            citationsFound: 0,
            issues: [{
              type: 'coherence',
              severity: 'high',
              description: `Verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            }],
            citations: [],
            verifiedAt: new Date(),
            verifiedBy: 'claude-3-5-sonnet-20241022',
          },
        })
      }
    } catch {
      // Best-effort — do not throw
    }

    return null
  }
}

// ─── Verify all SYNTHESIS subtasks for a completed task ───────────────────────

export async function verifyTaskOutputs(taskId: string): Promise<void> {
  try {
    const synthesisSubtasks = await prisma.subtask.findMany({
      where: {
        taskId,
        status: 'COMPLETED',
        role: 'SYNTHESIS',
      },
      select: { id: true },
    })

    if (synthesisSubtasks.length === 0) return

    // Verify each synthesis subtask (sequentially to avoid API rate limits)
    for (const subtask of synthesisSubtasks) {
      await verifySubtaskOutput(subtask.id).catch(() => {})
    }
  } catch (err) {
    console.error(`[QualityVerifier] verifyTaskOutputs failed for task ${taskId}:`, err)
  }
}
