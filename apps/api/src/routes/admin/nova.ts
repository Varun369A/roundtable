/**
 * NOVA: Admin AI Assistant
 * POST /api/v1/admin/nova/chat
 *
 * Accepts: { messages: [{role, content}], sessionId?: string }
 * Returns: { success: true, data: { message, toolsUsed, sessionId } }
 *
 * NOVA tools:
 * - get_overview, get_daily_stats, get_model_stats, search_users
 * - get_feedback_summary, get_system_health, list_feature_flags
 * - update_feature_flag, get_beta_stats, get_template_insights
 * - create_admin_alert, get_error_logs
 */

import { FastifyInstance } from 'fastify'
import Anthropic from 'anthropic'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@sabha/db'
import { redis } from '../../lib/redis'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/require-admin'
import { broadcastAdminAlert } from '../../lib/notifications'

const anthropic = new Anthropic()

const NOVA_MODEL = 'claude-opus-4-6'
const SESSION_TTL = 60 * 60 * 2 // 2 hours
const MAX_SESSION_MESSAGES = 20

const NOVA_SYSTEM_PROMPT = `You are NOVA, the AI assistant for Sabha's admin dashboard. You have direct access to live platform data via tools. Be concise and data-driven. When admins ask questions, call the appropriate tool to get real data before answering. When you detect issues, proactively suggest fixes. You can modify feature flags and broadcast alerts. Always confirm before destructive actions.`

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const NOVA_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_overview',
    description: 'Fetch the platform analytics overview: active users, task counts, revenue, error rate.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_daily_stats',
    description: 'Fetch daily analytics for the past N days (default 7).',
    input_schema: {
      type: 'object' as const,
      properties: { days: { type: 'number', description: 'Number of days to fetch (default 7)' } },
      required: [],
    },
  },
  {
    name: 'get_model_stats',
    description: 'Fetch usage and performance statistics per AI model.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'search_users',
    description: 'Search for users by email address or subscription tier.',
    input_schema: {
      type: 'object' as const,
      properties: {
        email: { type: 'string', description: 'Partial or full email address' },
        tier: {
          type: 'string',
          enum: ['FREE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE'],
          description: 'Subscription tier filter',
        },
        limit: { type: 'number', description: 'Max results (default 10, max 50)' },
        page:  { type: 'number', description: 'Page number (default 1)' },
      },
      required: [],
    },
  },
  {
    name: 'get_feedback_summary',
    description: 'Fetch aggregated user feedback stats: ratings, sentiment, bug reports.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_system_health',
    description: 'Fetch deep system health check: queue depths, circuit breakers, Valkey, DB latency.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'list_feature_flags',
    description: 'List all feature flags with their current enabled/disabled state.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'update_feature_flag',
    description: 'Enable or disable a feature flag by key.',
    input_schema: {
      type: 'object' as const,
      properties: {
        key:     { type: 'string',  description: 'The feature flag key' },
        enabled: { type: 'boolean', description: 'New state for the flag' },
      },
      required: ['key', 'enabled'],
    },
  },
  {
    name: 'get_beta_stats',
    description: 'Fetch beta launch statistics: sign-ups, activation rate, feature usage.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_template_insights',
    description: 'Fetch template analytics: usage counts, completion rates, performance scores.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'create_admin_alert',
    description: 'Broadcast a system alert notification to all admin users.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title:    { type: 'string', description: 'Alert title' },
        body:     { type: 'string', description: 'Alert message body' },
        severity: { type: 'string', enum: ['info', 'warning', 'critical'], description: 'Alert severity' },
      },
      required: ['title', 'body', 'severity'],
    },
  },
  {
    name: 'get_error_logs',
    description: 'Get recent failed subtasks with error details from the last N hours.',
    input_schema: {
      type: 'object' as const,
      properties: {
        hours: { type: 'number', description: 'Look back window in hours (default 1)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeTool(name: string, input: Record<string, any>): Promise<unknown> {
  switch (name) {
    case 'get_overview': {
      const [totalUsers, activeTasks, completedToday, failedToday] = await Promise.all([
        prisma.user.count(),
        prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.task.count({ where: { status: 'COMPLETED', updatedAt: { gte: new Date(Date.now() - 86_400_000) } } }),
        prisma.task.count({ where: { status: 'FAILED',    updatedAt: { gte: new Date(Date.now() - 86_400_000) } } }),
      ])
      const errorRate =
        completedToday + failedToday > 0
          ? ((failedToday / (completedToday + failedToday)) * 100).toFixed(2)
          : '0.00'
      return { totalUsers, activeTasks, completedToday, failedToday, errorRate: `${errorRate}%` }
    }

    case 'get_daily_stats': {
      const days = input.days ?? 7
      const since = new Date(Date.now() - days * 86_400_000)
      const tasks = await (prisma as any).task.groupBy({
        by: ['createdAt'],
        _count: { id: true },
        where: { createdAt: { gte: since } },
      })
      return { days, stats: tasks }
    }

    case 'get_model_stats': {
      const subtasks = await (prisma as any).subtask.groupBy({
        by: ['assignedModel'],
        _count: { id: true },
        where: { assignedModel: { not: null } },
      })
      return { modelStats: subtasks }
    }

    case 'search_users': {
      const limit = Math.min(input.limit ?? 10, 50)
      const page  = Math.max(input.page ?? 1, 1)
      const where: any = {}
      if (input.email) where.email = { contains: input.email, mode: 'insensitive' }
      if (input.tier)  where.tier  = input.tier
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, email: true, tier: true, status: true,
            isBeta: true, createdAt: true, lastActiveAt: true,
          },
        }),
        prisma.user.count({ where }),
      ])
      return { users, count: users.length, total, page }
    }

    case 'get_feedback_summary': {
      const [total, bugs, aggRating] = await Promise.all([
        prisma.feedback.count(),
        prisma.feedback.count({ where: { type: 'bug' } }),
        (prisma as any).feedback.aggregate({ _avg: { rating: true } }),
      ])
      return { total, bugs, avgRating: aggRating._avg?.rating ?? null }
    }

    case 'get_system_health': {
      const dbStart = Date.now()
      await prisma.$queryRaw`SELECT 1`
      const dbLatency = Date.now() - dbStart

      let valkeyLatency = -1
      try {
        const start = Date.now()
        await redis.ping()
        valkeyLatency = Date.now() - start
      } catch {}

      const queueDepth = await redis.llen('bull:subtask-queue:wait').catch(() => -1)
      return {
        db:     { status: 'ok', latencyMs: dbLatency },
        valkey: { status: valkeyLatency >= 0 ? 'ok' : 'error', latencyMs: valkeyLatency },
        subtaskQueueDepth: queueDepth,
        timestamp: new Date().toISOString(),
      }
    }

    case 'list_feature_flags': {
      const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } })
      return { flags }
    }

    case 'update_feature_flag': {
      const flag = await prisma.featureFlag.upsert({
        where: { key: input.key },
        update: { enabled: input.enabled },
        create: { key: input.key, enabled: input.enabled, description: 'Created by NOVA' },
      })
      return { updated: true, flag }
    }

    case 'get_beta_stats': {
      const betaUsers  = await prisma.user.count({ where: { isBeta: true } })
      const activeBeta = await prisma.user.count({
        where: { isBeta: true, lastActiveAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      })
      return {
        totalBetaUsers: betaUsers,
        activeLast7Days: activeBeta,
        activationRate: betaUsers > 0 ? `${((activeBeta / betaUsers) * 100).toFixed(1)}%` : '0%',
      }
    }

    case 'get_template_insights': {
      const analytics = await (prisma as any).templateAnalytics.findMany({
        include: { template: { select: { name: true, category: true } } },
        orderBy: { performanceScore: 'desc' },
        take: 20,
      })
      return { templates: analytics }
    }

    case 'create_admin_alert': {
      await broadcastAdminAlert({
        title: input.title,
        body: input.body,
        severity: input.severity,
        metadata: { createdBy: 'NOVA' },
      })
      return { sent: true, title: input.title, severity: input.severity }
    }

    case 'get_error_logs': {
      const hours = input.hours ?? 1
      const limit = input.limit ?? 20
      const since = new Date(Date.now() - hours * 3_600_000)
      const failed = await (prisma as any).subtask.findMany({
        where: { status: 'FAILED', updatedAt: { gte: since } },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, status: true, assignedModel: true, updatedAt: true,
          task: { select: { id: true, title: true } },
        },
      })
      return { failedSubtasks: failed, count: failed.length, windowHours: hours }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

async function getSession(sessionId: string): Promise<Anthropic.MessageParam[]> {
  try {
    const raw = await redis.get(`nova:session:${sessionId}`)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function saveSession(sessionId: string, messages: Anthropic.MessageParam[]): Promise<void> {
  const trimmed = messages.slice(-MAX_SESSION_MESSAGES)
  await redis.setex(`nova:session:${sessionId}`, SESSION_TTL, JSON.stringify(trimmed))
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function novaRoutes(app: FastifyInstance): Promise<void> {
  // POST /chat — NOVA agentic chat (admin only)
  app.post('/chat', { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    try {
      const body = request.body as any
      const { messages: incomingMessages, sessionId: existingSessionId } = body

      if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'messages array is required' },
        })
      }

      const sessionId = existingSessionId ?? uuidv4()
      const history   = await getSession(sessionId)

      const allMessages: Anthropic.MessageParam[] = [
        ...history,
        ...incomingMessages.map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ]

      const toolsUsed: string[] = []
      let messages = [...allMessages]
      let finalMessage = ''

      // Agentic loop — run until no more tool calls
      while (true) {
        const response = await anthropic.messages.create({
          model: NOVA_MODEL,
          max_tokens: 4096,
          system: NOVA_SYSTEM_PROMPT,
          tools: NOVA_TOOLS,
          messages,
        })

        if (response.stop_reason === 'tool_use') {
          const assistantContent = response.content
          messages.push({ role: 'assistant', content: assistantContent })

          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const block of assistantContent) {
            if (block.type === 'tool_use') {
              toolsUsed.push(block.name)
              const result = await executeTool(block.name, (block.input as Record<string, any>) ?? {})
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
            }
          }
          messages.push({ role: 'user', content: toolResults })
        } else {
          const textBlock = response.content.find((b) => b.type === 'text')
          finalMessage = textBlock && textBlock.type === 'text' ? textBlock.text : ''
          messages.push({ role: 'assistant', content: response.content })
          break
        }
      }

      await saveSession(sessionId, messages)

      return reply.send({
        success: true,
        data: {
          message: finalMessage,
          toolsUsed: [...new Set(toolsUsed)],
          sessionId,
        },
      })
    } catch (err: any) {
      request.log.error({ err }, '[nova] POST /chat error')
      return reply.status(500).send({
        success: false,
        error: { code: 'NOVA_ERROR', message: err.message ?? 'NOVA encountered an error' },
      })
    }
  })
}
