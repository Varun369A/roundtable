import { FastifyInstance } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/require-admin'

export async function adminAnalyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireAdmin)

  // ─── GET /admin/analytics/overview ──────────────────────────────────────────
  app.get('/overview', async (_request, reply) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 86400000)
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

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
      revenueThisMonth,
      apiCostThisMonth,
      tierBreakdown,
      topLanguages,
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
      // Revenue = subscription charges this month
      prisma.billingEvent.aggregate({
        _sum: { costUsd: true },
        where: { eventType: 'subscription_charge', createdAt: { gte: thisMonth } },
      }),
      // API cost = all api_call events this month
      prisma.billingEvent.aggregate({
        _sum: { costUsd: true },
        where: { eventType: 'api_call', createdAt: { gte: thisMonth } },
      }),
      // Users by tier
      prisma.user.groupBy({
        by: ['tier'],
        _count: { id: true },
      }),
      // Top languages (from context objects)
      prisma.$queryRaw<Array<{ language: string; count: bigint }>>`
        SELECT
          context_object->>'detectedLanguage' as language,
          COUNT(*) as count
        FROM tasks
        WHERE context_object->>'detectedLanguage' IS NOT NULL
        GROUP BY context_object->>'detectedLanguage'
        ORDER BY count DESC
        LIMIT 10
      `,
    ])

    const revenueUsd   = Number(revenueThisMonth._sum.costUsd  || 0)
    const apiCostUsd   = Number(apiCostThisMonth._sum.costUsd  || 0)
    const marginUsd    = revenueUsd - apiCostUsd
    const marginPct    = revenueUsd > 0 ? Math.round((marginUsd / revenueUsd) * 100) : 0
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
          // Approximate INR (1 USD ≈ 84 INR)
          thisMonthInr: Math.round(revenueUsd * 84),
        },
        tiers: tierBreakdown.map((t) => ({
          tier: t.tier,
          count: t._count.id,
        })),
        languages: topLanguages.map((l) => ({
          language: l.language || 'en',
          count: Number(l.count),
        })),
      },
    })
  })

  // ─── GET /admin/analytics/daily?days=30 ─────────────────────────────────────
  app.get<{ Querystring: { days?: string } }>('/daily', async (request, reply) => {
    const days = Math.min(parseInt(request.query.days || '30', 10), 90)
    const since = new Date(Date.now() - days * 86400000)

    const [dailyUsers, dailyTasks, dailyCosts] = await Promise.all([
      // New users per day
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM users
        WHERE created_at >= ${since}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      // Tasks per day
      prisma.$queryRaw<Array<{ date: string; count: bigint; completed: bigint }>>`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed
        FROM tasks
        WHERE created_at >= ${since}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      // API costs per day
      prisma.$queryRaw<Array<{ date: string; cost: number }>>`
        SELECT
          DATE(created_at) as date,
          SUM(cost_usd)::float as cost
        FROM billing_events
        WHERE created_at >= ${since}
          AND event_type = 'api_call'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
    ])

    return reply.send({
      success: true,
      data: {
        dailyUsers:  dailyUsers.map((r) => ({ date: r.date, count: Number(r.count) })),
        dailyTasks:  dailyTasks.map((r) => ({ date: r.date, count: Number(r.count), completed: Number(r.completed) })),
        dailyCosts:  dailyCosts.map((r) => ({ date: r.date, cost: Number(r.cost || 0) })),
      },
    })
  })

  // ─── GET /admin/analytics/models ────────────────────────────────────────────
  app.get('/models', async (_request, reply) => {
    const since = new Date(Date.now() - 30 * 86400000)

    const modelStats = await prisma.$queryRaw<Array<{
      model: string
      calls: bigint
      cost: number
      avg_latency: number
      failures: bigint
    }>>`
      SELECT
        ai_model as model,
        COUNT(*) as calls,
        SUM(cost_usd)::float as cost,
        AVG((metadata->>'latencyMs')::float) as avg_latency,
        COUNT(*) FILTER (WHERE event_type = 'api_call_failed') as failures
      FROM billing_events
      WHERE created_at >= ${since}
        AND ai_model IS NOT NULL
      GROUP BY ai_model
      ORDER BY calls DESC
    `

    return reply.send({
      success: true,
      data: {
        models: modelStats.map((m) => ({
          model: m.model,
          calls: Number(m.calls),
          costUsd: Number(m.cost || 0),
          avgLatencyMs: Math.round(Number(m.avg_latency || 0)),
          failures: Number(m.failures),
          successRate: Number(m.calls) > 0
            ? Math.round(((Number(m.calls) - Number(m.failures)) / Number(m.calls)) * 100)
            : 100,
        })),
      },
    })
  })
}
