import { FastifyInstance } from 'fastify'
import { prisma as db } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { getConnector } from '../lib/social-connectors'
import { encryptToken } from '../lib/social-crypto'
import { runContentGeneration } from '../jobs/content-generator'

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

async function assertAdmin(userId: string, reply: any): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  if (!user?.isAdmin) { await reply.status(403).send({ success: false, message: 'Admin only' }); return false }
  return true
}

export async function marketingRoutes(app: FastifyInstance): Promise<void> {

  // GET /admin/marketing/today
  app.get('/admin/marketing/today', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    const posts = await (db as any).contentCalendar.findMany({
      where: { date: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } },
      orderBy: { scheduledAt: 'asc' }
    })
    return reply.send({ success: true, data: posts })
  })

  // PATCH /admin/marketing/content/:id/approve
  app.patch<{ Params: { id: string } }>('/admin/marketing/content/:id/approve', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    const post = await (db as any).contentCalendar.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', approvedAt: new Date() }
    })
    return reply.send({ success: true, data: post })
  })

  // PATCH /admin/marketing/content/:id/edit
  app.patch<{ Params: { id: string } }>('/admin/marketing/content/:id/edit', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    const { body, hashtags } = req.body as any
    const post = await (db as any).contentCalendar.update({
      where: { id: req.params.id },
      data: { body, hashtags: hashtags ?? [], status: 'EDITED_AND_APPROVED', approvedAt: new Date() }
    })
    return reply.send({ success: true, data: post })
  })

  // PATCH /admin/marketing/content/:id/skip
  app.patch<{ Params: { id: string } }>('/admin/marketing/content/:id/skip', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    await (db as any).contentCalendar.update({ where: { id: req.params.id }, data: { status: 'SKIPPED' } })
    return reply.send({ success: true })
  })

  // POST /admin/marketing/content/approve-all
  app.post('/admin/marketing/content/approve-all', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    const today = await (db as any).contentCalendar.findMany({
      where: { date: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) }, status: 'PENDING_APPROVAL' }
    })
    for (const post of today) {
      await (db as any).contentCalendar.update({ where: { id: post.id }, data: { status: 'APPROVED', approvedAt: new Date() } })
    }
    return reply.send({ success: true, approved: today.length })
  })

  // GET /admin/marketing/engagement
  app.get('/admin/marketing/engagement', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    const { status = 'PENDING', limit = '50' } = req.query as any
    const items = await (db as any).engagementItem.findMany({
      where: { replyStatus: status },
      orderBy: { detectedAt: 'desc' },
      take: Math.min(100, parseInt(limit))
    })
    return reply.send({ success: true, data: items })
  })

  // PATCH /admin/marketing/engagement/:id/reply
  app.patch<{ Params: { id: string } }>('/admin/marketing/engagement/:id/reply', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    const { action, editedReply } = req.body as any
    if (!['APPROVE', 'SKIP'].includes(action)) return reply.status(400).send({ success: false, message: 'action must be APPROVE or SKIP' })
    if (action === 'SKIP') {
      await (db as any).engagementItem.update({ where: { id: req.params.id }, data: { replyStatus: 'SKIPPED' } })
      return reply.send({ success: true })
    }
    const item = await (db as any).engagementItem.findUnique({ where: { id: req.params.id } })
    if (!item) return reply.status(404).send({ success: false, message: 'Not found' })
    const replyText = editedReply ?? item.draftReply
    const credential = await (db as any).socialCredential.findFirst({ where: { platform: item.platform, isActive: true } })
    if (credential) {
      const connector = getConnector(item.platform, credential.accessToken)
      if (item.type === 'MENTION') await connector.replyToMention(item.platformPostId, replyText)
      else await connector.replyToComment(item.platformPostId, replyText)
    }
    await (db as any).engagementItem.update({ where: { id: req.params.id }, data: { replyStatus: 'POSTED', draftReply: replyText, repliedAt: new Date() } })
    return reply.send({ success: true })
  })

  // GET /admin/marketing/analytics
  app.get('/admin/marketing/analytics', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    const { days = '7' } = req.query as any
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
    const analytics = await (db as any).marketingAnalytics.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'desc' }
    })
    return reply.send({ success: true, data: analytics })
  })

  // GET /admin/marketing/calendar
  app.get('/admin/marketing/calendar', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    const { days = '7' } = req.query as any
    const since = startOfDay(new Date())
    const until = new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000)
    const posts = await (db as any).contentCalendar.findMany({
      where: { scheduledAt: { gte: since, lte: until } },
      orderBy: { scheduledAt: 'asc' }
    })
    return reply.send({ success: true, data: posts })
  })

  // GET /admin/marketing/credentials
  app.get('/admin/marketing/credentials', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    const creds = await (db as any).socialCredential.findMany({
      select: { id: true, platform: true, accountName: true, accountId: true, isActive: true, tokenExpiry: true, createdAt: true, updatedAt: true }
    })
    return reply.send({ success: true, data: creds })
  })

  // POST /admin/marketing/credentials/connect
  app.post('/admin/marketing/credentials/connect', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    const { platform } = req.body as any
    const validPlatforms = ['LINKEDIN', 'TWITTER', 'INSTAGRAM', 'YOUTUBE', 'WHATSAPP_BUSINESS', 'FACEBOOK']
    if (!validPlatforms.includes(platform)) return reply.status(400).send({ success: false, message: 'Invalid platform' })
    const tempToken = 'temp'
    const connector = getConnector(platform, encryptToken(tempToken))
    const authUrl = (connector as any).getAuthUrl()
    return reply.send({ success: true, data: { authUrl } })
  })

  // POST /admin/marketing/trigger-generation
  app.post('/admin/marketing/trigger-generation', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    runContentGeneration().catch(console.error)
    return reply.send({ success: true, message: 'Content generation triggered' })
  })
}
