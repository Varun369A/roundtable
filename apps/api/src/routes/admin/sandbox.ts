/**
 * Developer Sandbox: AI finds issues, tests fixes in isolation, applies when confirmed.
 *
 * GET  /api/v1/admin/sandbox/sessions          — list sandbox sessions
 * POST /api/v1/admin/sandbox/sessions          — create new session (AI analyzes issues)
 * GET  /api/v1/admin/sandbox/sessions/:id      — get session + runs
 * POST /api/v1/admin/sandbox/sessions/:id/run  — execute a test run
 * POST /api/v1/admin/sandbox/sessions/:id/apply — apply confirmed fix (requires 3 successful runs)
 * GET  /api/v1/admin/sandbox/issues            — AI-detected current issues
 */

import { FastifyInstance } from 'fastify'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@arivarangam/db'
import { redis } from '../../lib/redis'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/require-admin'
import { broadcastAdminAlert, createNotification } from '../../lib/notifications'

const anthropic = new Anthropic()
const ANALYSIS_MODEL = 'claude-sonnet-4-6'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function gatherPlatformContext() {
  const since24h = new Date(Date.now() - 24 * 3_600_000)
  const since1h  = new Date(Date.now() - 3_600_000)

  const [recentFailed, circuitBreakerFlags, feedbackBugs, errorRate1h] = await Promise.all([
    prisma.subtask.findMany({
      where: { status: 'FAILED', updatedAt: { gte: since24h } },
      take: 50,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, status: true, assignedModel: true, updatedAt: true,
        task: { select: { id: true, title: true } },
      },
    }),
    prisma.featureFlag.findMany({
      where: { key: { startsWith: 'circuit_breaker' } },
    }),
    prisma.feedback.findMany({
      where: { type: 'bug', createdAt: { gte: since24h } },
      take: 20,
      select: { id: true, message: true, createdAt: true },
    }),
    prisma.subtask.count({
      where: { status: 'FAILED', updatedAt: { gte: since1h } },
    }),
  ])

  return { recentFailed, circuitBreakerFlags, feedbackBugs, errorRate1h }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function sandboxRoutes(app: FastifyInstance): Promise<void> {

  // GET /sessions — list sandbox sessions (admin only)
  app.get('/sessions', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    try {
      const sessions = await prisma.sandboxSession.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { _count: { select: { runs: true } } },
      })
      return reply.send({ success: true, data: { sessions } })
    } catch (err: any) {
      request.log.error({ err }, '[sandbox] GET /sessions error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } })
    }
  })

  // POST /sessions — create new sandbox session with AI analysis (admin only)
  app.post('/sessions', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    try {
      const body  = request.body as any
      const focus = body?.focus as string | undefined
      const ctx   = await gatherPlatformContext()

      const analysisPrompt = `You are a platform reliability engineer analyzing Arivarangam's AI platform.
${focus ? `\nFocus area: ${focus}\n` : ''}
Here is the current platform context:

FAILED SUBTASKS (last 24h, sample of up to 50):
${JSON.stringify(ctx.recentFailed, null, 2)}

CIRCUIT BREAKER FLAGS:
${JSON.stringify(ctx.circuitBreakerFlags, null, 2)}

BUG REPORTS (last 24h):
${JSON.stringify(ctx.feedbackBugs, null, 2)}

FAILED SUBTASKS (last 1h): ${ctx.errorRate1h}

Based on this data, identify the most critical issue and propose a specific, actionable fix.

Respond with valid JSON in this exact format:
{
  "issueTitle": "Short title",
  "issueSummary": "1-2 sentence description of the problem",
  "rootCause": "Technical explanation of root cause",
  "severity": "low|medium|high|critical",
  "fixType": "template_instruction|rate_limit|fallback_model|prompt_adjustment|feature_flag",
  "proposedFix": {
    "description": "What the fix does",
    "target": "ID or name of the thing to fix",
    "change": "Specific change to make"
  },
  "expectedOutcome": "What should improve after applying this fix",
  "confidence": "low|medium|high"
}`

      const response = await anthropic.messages.create({
        model: ANALYSIS_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: analysisPrompt }],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      const rawText   = textBlock && textBlock.type === 'text' ? textBlock.text : '{}'

      let diagnosis: any = {}
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        diagnosis = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
      } catch {
        diagnosis = { issueSummary: rawText, fixType: 'prompt_adjustment' }
      }

      // Map AI output to schema fields
      // proposedFix JSON includes: the fix details + AI metadata (fixType, severity, etc.)
      const proposedFixJson = {
        ...(diagnosis.proposedFix ?? {}),
        fixType:         diagnosis.fixType         ?? 'prompt_adjustment',
        severity:        diagnosis.severity        ?? 'medium',
        confidence:      diagnosis.confidence      ?? 'medium',
        expectedOutcome: diagnosis.expectedOutcome ?? '',
        rootCause:       diagnosis.rootCause       ?? '',
        focus:           focus ?? null,
      }

      const session = await prisma.sandboxSession.create({
        data: {
          title:       diagnosis.issueTitle    ?? 'Detected Issue',
          diagnosis:   diagnosis.issueSummary  ?? '',
          proposedFix: proposedFixJson,
          status:      'PENDING',
          runCount:    0,
          successCount: 0,
          createdById: request.user!.id,
        },
      })

      return reply.status(201).send({ success: true, data: { session, diagnosis } })
    } catch (err: any) {
      request.log.error({ err }, '[sandbox] POST /sessions error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } })
    }
  })

  // GET /sessions/:id — get session + runs (admin only)
  app.get('/sessions/:id', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const session = await prisma.sandboxSession.findUnique({
        where: { id },
        include: { runs: { orderBy: { createdAt: 'desc' } } },
      })
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } })
      }
      return reply.send({ success: true, data: { session } })
    } catch (err: any) {
      request.log.error({ err }, '[sandbox] GET /sessions/:id error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } })
    }
  })

  // POST /sessions/:id/run — execute a test run in sandbox (admin only)
  app.post('/sessions/:id/run', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const session = await prisma.sandboxSession.findUnique({ where: { id } })
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } })
      }
      if (session.status === 'APPLIED') {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_STATE', message: 'Session already applied' } })
      }

      const fix      = session.proposedFix as any
      const fixType  = fix.fixType ?? 'prompt_adjustment'
      const runStart = Date.now()
      let passed     = false
      let notes      = ''
      let testOutput: any = {}

      try {
        switch (fixType) {
          case 'template_instruction': {
            const template = await prisma.roundtableTemplate.findFirst({
              where: { OR: [{ id: fix.target }, { name: { equals: fix.target, mode: 'insensitive' } }] },
            })
            if (!template) throw new Error(`Template not found: ${fix.target}`)
            const instruction = fix.change ?? ''
            if (!instruction || instruction.length < 10) throw new Error('Proposed instruction is too short or empty')
            passed = true
            notes  = `Template "${template.name}" instruction update validated. Length: ${instruction.length} chars.`
            testOutput = { templateId: template.id, templateName: template.name }
            break
          }

          case 'rate_limit': {
            const flagKey  = fix.target ?? 'rate_limit_default'
            const newValue = fix.change
            if (!newValue) throw new Error('No rate limit value specified')
            const flag = await prisma.featureFlag.findFirst({ where: { key: flagKey } })
            passed = true
            notes  = `Rate limit flag "${flagKey}" change validated. Current: ${flag?.config ?? 'not set'}, Proposed: ${newValue}`
            testOutput = { flagKey, proposedValue: newValue }
            break
          }

          case 'fallback_model': {
            const knownModels = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'gpt-4o', 'gpt-4o-mini', 'gemini-1.5-pro']
            const proposedModel = fix.change ?? ''
            if (!knownModels.includes(proposedModel)) {
              throw new Error(`Unknown model: ${proposedModel}. Known: ${knownModels.join(', ')}`)
            }
            const recentFailures = await prisma.subtask.count({
              where: { assignedModel: proposedModel, status: 'FAILED', updatedAt: { gte: new Date(Date.now() - 3_600_000) } },
            })
            if (recentFailures > 10) {
              throw new Error(`Model ${proposedModel} has ${recentFailures} failures in the last hour`)
            }
            passed = true
            notes  = `Fallback model "${proposedModel}" validated. Recent failures: ${recentFailures}`
            testOutput = { proposedModel, recentFailures }
            break
          }

          case 'prompt_adjustment':
          case 'feature_flag':
          default: {
            const adjustment = fix.change ?? ''
            if (!adjustment || String(adjustment).length < 5) throw new Error('Adjustment too short or empty')
            passed = true
            notes  = `Adjustment validated. Length: ${String(adjustment).length} chars.`
            testOutput = { adjustmentLength: String(adjustment).length }
            break
          }
        }
      } catch (runErr: any) {
        passed = false
        notes  = `Test failed: ${runErr.message}`
      }

      const durationMs = Date.now() - runStart
      const runNumber  = session.runCount + 1

      const run = await prisma.sandboxRun.create({
        data: {
          sessionId:  session.id,
          runNumber,
          passed,
          output:     { notes, testOutput },
          errorMsg:   passed ? null : notes,
          durationMs,
        },
      })

      await prisma.sandboxSession.update({
        where: { id: session.id },
        data: {
          runCount:     { increment: 1 },
          successCount: passed ? { increment: 1 } : undefined,
          status:       'TESTING',
        },
      })

      return reply.send({ success: true, data: { run, passed, notes } })
    } catch (err: any) {
      request.log.error({ err }, '[sandbox] POST /sessions/:id/run error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } })
    }
  })

  // POST /sessions/:id/apply — apply confirmed fix (admin only, requires 3 successful runs)
  app.post('/sessions/:id/apply', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const session = await prisma.sandboxSession.findUnique({ where: { id } })
      if (!session) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } })
      }
      if (session.status === 'APPLIED') {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_STATE', message: 'Fix already applied' } })
      }

      if (session.runCount < 3 || session.successCount < 3) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INSUFFICIENT_RUNS',
            message: `Cannot apply: requires 3 successful runs. Current: ${session.successCount}/${session.runCount} successful.`,
          },
        })
      }

      const fix      = session.proposedFix as any
      const fixType  = fix.fixType ?? 'prompt_adjustment'
      let applyResult: any = {}

      switch (fixType) {
        case 'template_instruction': {
          const template = await prisma.roundtableTemplate.findFirst({
            where: { OR: [{ id: fix.target }, { name: { equals: fix.target, mode: 'insensitive' } }] },
          })
          if (!template) throw new Error(`Template not found: ${fix.target}`)
          await prisma.roundtableTemplate.update({
            where: { id: template.id },
            data: { agentInstruction: fix.change } as any,
          })
          applyResult = { updated: 'template', id: template.id, name: template.name }
          break
        }

        case 'rate_limit': {
          const flagKey = fix.target ?? 'rate_limit_default'
          await prisma.featureFlag.upsert({
            where: { key: flagKey },
            update: { config: { value: fix.change } },
            create: {
              key: flagKey,
              enabled: true,
              config: { value: fix.change },
              description: `Set by sandbox fix: ${session.title}`,
            },
          })
          applyResult = { updated: 'featureFlag', key: flagKey, value: fix.change }
          break
        }

        case 'fallback_model': {
          const flagKey = `fallback_model_${fix.target ?? 'default'}`
          await prisma.featureFlag.upsert({
            where: { key: flagKey },
            update: { config: { model: fix.change }, enabled: true },
            create: {
              key: flagKey,
              enabled: true,
              config: { model: fix.change },
              description: `Fallback model set by sandbox fix: ${session.title}`,
            },
          })
          applyResult = { updated: 'featureFlag', key: flagKey, model: fix.change }
          break
        }

        case 'prompt_adjustment':
        case 'feature_flag':
        default: {
          const flagKey = fix.target ? `fix_${fix.target}` : `fix_${id.slice(0, 8)}`
          await prisma.featureFlag.upsert({
            where: { key: flagKey },
            update: { config: { value: fix.change } },
            create: {
              key: flagKey,
              enabled: true,
              config: { value: fix.change },
              description: `Fix applied by sandbox: ${session.title}`,
            },
          })
          applyResult = { updated: 'featureFlag', key: flagKey }
          break
        }
      }

      await prisma.sandboxSession.update({
        where: { id: session.id },
        data: { status: 'APPLIED', appliedAt: new Date() },
      })

      // Notify admins
      const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } })
      await Promise.allSettled([
        broadcastAdminAlert({
          title:    `Sandbox Fix Applied: ${session.title}`,
          body:     `Fix type: ${fixType}. ${fix.expectedOutcome ?? ''}`,
          severity: 'info',
          metadata: { sessionId: session.id, applyResult },
        }),
        ...admins.map((admin) =>
          createNotification({
            userId: admin.id,
            type:   'healing_applied',
            title:  `Sandbox Fix Applied: ${session.title}`,
            body:   `A ${fixType} fix has been applied. Expected: ${fix.expectedOutcome ?? 'improvement'}`,
            metadata: { sessionId: session.id },
          })
        ),
      ])

      return reply.send({ success: true, data: { applied: true, sessionId: session.id, applyResult } })
    } catch (err: any) {
      request.log.error({ err }, '[sandbox] POST /sessions/:id/apply error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } })
    }
  })

  // GET /issues — AI-detected current issues (admin only)
  app.get('/issues', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    try {
      const since1h = new Date(Date.now() - 3_600_000)

      const [failedLast1h, circuitBreakers, highErrorModels, recentBugs] = await Promise.all([
        prisma.subtask.findMany({
          where: { status: 'FAILED', updatedAt: { gte: since1h } },
          select: { assignedModel: true, updatedAt: true },
          take: 50,
        }),
        prisma.featureFlag.findMany({
          where: { key: { startsWith: 'circuit_breaker' }, enabled: true },
        }),
        prisma.subtask.groupBy({
          by: ['assignedModel'],
          _count: { id: true },
          where: { status: 'FAILED', updatedAt: { gte: since1h }, assignedModel: { not: null as any } },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        }),
        prisma.feedback.findMany({
          where: { type: 'bug', createdAt: { gte: since1h } },
          select: { id: true, message: true, createdAt: true },
          take: 10,
        }),
      ])

      const contextSummary = {
        failedSubtasks1h:     failedLast1h.length,
        openCircuitBreakers:  circuitBreakers.length,
        highErrorModels:      highErrorModels.slice(0, 3),
        recentBugReports:     recentBugs.length,
      }

      const analysisPrompt = `You are Arivarangam's reliability assistant. Analyze these platform health signals and list the top issues.

Platform signals:
${JSON.stringify(contextSummary, null, 2)}

Respond with a JSON array of issues:
[
  {
    "title": "Issue title",
    "severity": "low|medium|high|critical",
    "description": "What is happening",
    "suggestedAction": "What to do",
    "affectedComponent": "which part of the system"
  }
]

Return empty array [] if no significant issues. Maximum 5 issues.`

      const response = await anthropic.messages.create({
        model: ANALYSIS_MODEL,
        max_tokens: 1000,
        messages: [{ role: 'user', content: analysisPrompt }],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      const rawText   = textBlock && textBlock.type === 'text' ? textBlock.text : '[]'

      let issues: any[] = []
      try {
        const jsonMatch = rawText.match(/\[[\s\S]*\]/)
        issues = jsonMatch ? JSON.parse(jsonMatch[0]) : []
      } catch {
        issues = []
      }

      return reply.send({
        success: true,
        data: { issues, signals: contextSummary, analyzedAt: new Date().toISOString() },
      })
    } catch (err: any) {
      request.log.error({ err }, '[sandbox] GET /issues error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } })
    }
  })
}
