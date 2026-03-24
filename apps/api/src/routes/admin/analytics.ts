import { FastifyInstance } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/require-admin'

export async function adminAnalyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireAdmin)

  // ─── GET /admin/analytics/overview ──────────────────────────────────────────
  app.get('/overview', async (_request, reply) => {
    try {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterday = new Date(today.getTime() - 86400000)
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // Core user/task queries — these tables always exist
      const [
        totalUsers,
        usersToday,
        usersYesterday,
        usersThisMonth,
        totalTasks,
        tasksToday,
        tasksThisMonth,
        completedTasksTotal,
        failedTasksTotal,
        activeTasksNow,
        tierBreakdown,
      ] = await Promise.all([
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count({ where: { createdAt: { gte: today } } }),
        prisma.user.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
        prisma.user.count({ where: { createdAt: { gte: thisMonth } } }),
        prisma.task.count(),
        prisma.task.count({ where: { createdAt: { gte: today } } }),
        prisma.task.count({ where: { createdAt: { gte: thisMonth } } }),
        prisma.task.count({ where: { status: 'COMPLETED' } }),
        prisma.task.count({ where: { status: 'FAILED' } }),
        prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.user.groupBy({ by: ['tier'], _count: { id: true } }),
      ])

      // Billing queries — may fail if table has schema issues; default to 0
      let revenueUsd = 0
      let apiCostUsd = 0
      try {
        const [revenueThisMonth, apiCostThisMonth] = await Promise.all([
          prisma.billingEvent.aggregate({
            _sum: { costUsd: true },
            where: { eventType: 'subscription_charge', createdAt: { gte: thisMonth } },
          }),
          prisma.billingEvent.aggregate({
            _sum: { costUsd: true },
            where: { eventType: 'api_call', createdAt: { gte: thisMonth } },
          }),
        ])
        revenueUsd = Number(revenueThisMonth._sum.costUsd || 0)
        apiCostUsd = Number(apiCostThisMonth._sum.costUsd || 0)
      } catch {
        // billing_events table may be empty or missing columns — use zeros
      }

      // Language detection query — may fail if context_object column missing
      let topLanguages: Array<{ language: string; count: number }> = []
      try {
        const rows = await prisma.$queryRaw<Array<{ language: string; count: bigint }>>`
          SELECT
            context_object->>'detectedLanguage' as language,
            COUNT(*) as count
          FROM tasks
          WHERE context_object->>'detectedLanguage' IS NOT NULL
          GROUP BY context_object->>'detectedLanguage'
          ORDER BY count DESC
          LIMIT 10
        `
        topLanguages = rows.map((l) => ({ language: l.language || 'en', count: Number(l.count) }))
      } catch {
        // context_object column may not exist or have no data
      }

      const marginUsd = revenueUsd - apiCostUsd
      const marginPct = revenueUsd > 0 ? Math.round((marginUsd / revenueUsd) * 100) : 0
      const completionRate = totalTasks > 0
        ? Math.round((completedTasksTotal / totalTasks) * 100)
        : 0

      return reply.send({
        success: true,
        data: {
          users: {
            total: totalUsers,
            today: usersToday,
            yesterday: usersYesterday,
            thisMonth: usersThisMonth,
            growth: usersYesterday > 0
              ? Math.round(((usersToday - usersYesterday) / usersYesterday) * 100)
              : 0,
          },
          tasks: {
            total: totalTasks,
            today: tasksToday,
            thisMonth: tasksThisMonth,
            activeNow: activeTasksNow,
            completionRate,
            failureRate: totalTasks > 0
              ? Math.round((failedTasksTotal / totalTasks) * 100)
              : 0,
          },
          revenue: {
            thisMonthUsd: revenueUsd,
            apiCostUsd,
            marginUsd,
            marginPercent: marginPct,
            thisMonthInr: Math.round(revenueUsd * 84),
          },
          tiers: tierBreakdown.map((t) => ({ tier: t.tier, count: t._count.id })),
          languages: topLanguages,
        },
      })
    } catch (err: any) {
      _request.log.error({ err }, '[analytics] GET /overview error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } })
    }
  })

  // ─── GET /admin/analytics/daily?days=30 ─────────────────────────────────────
  app.get<{ Querystring: { days?: string } }>('/daily', async (request, reply) => {
    try {
      const days = Math.min(parseInt(request.query.days || '30', 10), 90)
      const since = new Date(Date.now() - days * 86400000)

      let dailyUsers: Array<{ date: string; count: number }> = []
      let dailyTasks: Array<{ date: string; count: number; completed: number }> = []
      let dailyCosts: Array<{ date: string; cost: number }> = []

      try {
        const rows = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
          SELECT DATE(created_at) as date, COUNT(*) as count
          FROM users
          WHERE created_at >= ${since}
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `
        dailyUsers = rows.map((r) => ({ date: r.date, count: Number(r.count) }))
      } catch { /* ignore */ }

      try {
        const rows = await prisma.$queryRaw<Array<{ date: string; count: bigint; completed: bigint }>>`
          SELECT
            DATE(created_at) as date,
            COUNT(*) as count,
            COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed
          FROM tasks
          WHERE created_at >= ${since}
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `
        dailyTasks = rows.map((r) => ({ date: r.date, count: Number(r.count), completed: Number(r.completed) }))
      } catch { /* ignore */ }

      try {
        const rows = await prisma.$queryRaw<Array<{ date: string; cost: number }>>`
          SELECT DATE(created_at) as date, SUM(cost_usd)::float as cost
          FROM billing_events
          WHERE created_at >= ${since} AND event_type = 'api_call'
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `
        dailyCosts = rows.map((r) => ({ date: r.date, cost: Number(r.cost || 0) }))
      } catch { /* billing_events may be empty */ }

      return reply.send({ success: true, data: { dailyUsers, dailyTasks, dailyCosts } })
    } catch (err: any) {
      request.log.error({ err }, '[analytics] GET /daily error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } })
    }
  })

  // ─── GET /admin/analytics/models ────────────────────────────────────────────
  app.get('/models', async (_request, reply) => {
    try {
      const since = new Date(Date.now() - 30 * 86400000)

      let models: any[] = []
      try {
        const modelStats = await prisma.$queryRaw<Array<{
          model: string; calls: bigint; cost: number; avg_latency: number; failures: bigint
        }>>`
          SELECT
            ai_model as model,
            COUNT(*) as calls,
            SUM(cost_usd)::float as cost,
            AVG((metadata->>'latencyMs')::float) as avg_latency,
            COUNT(*) FILTER (WHERE event_type = 'api_call_failed') as failures
          FROM billing_events
          WHERE created_at >= ${since} AND ai_model IS NOT NULL
          GROUP BY ai_model
          ORDER BY calls DESC
        `
        models = modelStats.map((m) => ({
          model: m.model,
          calls: Number(m.calls),
          costUsd: Number(m.cost || 0),
          avgLatencyMs: Math.round(Number(m.avg_latency || 0)),
          failures: Number(m.failures),
          successRate: Number(m.calls) > 0
            ? Math.round(((Number(m.calls) - Number(m.failures)) / Number(m.calls)) * 100)
            : 100,
        }))
      } catch { /* billing_events may be empty or missing columns */ }

      return reply.send({ success: true, data: { models } })
    } catch (err: any) {
      _request.log.error({ err }, '[analytics] GET /models error')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } })
    }
  })
}
