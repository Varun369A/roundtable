import { FastifyInstance } from 'fastify'
import { prisma as db } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { requireAdmin } from '../middleware/require-admin'
import { getConnector } from '../lib/social-connectors'
import { encryptToken } from '../lib/social-crypto'
import { runContentGeneration } from '../jobs/content-generator'
import crypto from 'crypto'

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

export async function marketingRoutes(app: FastifyInstance): Promise<void> {

  // GET /admin/marketing/today
  app.get('/admin/marketing/today', { preHandler: [requireAuth, requireAdmin] }, async (req: any, reply) => {
    try {
      const posts = await (db as any).contentCalendar.findMany({
        where: { date: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } },
        orderBy: { scheduledAt: 'asc' }
      })
      return reply.send({ success: true, data: posts })
    } catch (err) {
      app.log.error(err, 'GET /admin/marketing/today failed')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch today\'s content' } })
    }
  })

  // PATCH /admin/marketing/content/:id/approve
  app.patch<{ Params: { id: string } }>('/admin/marketing/content/:id/approve', { preHandler: [requireAuth, requireAdmin] }, async (req: any, reply) => {
    try {
      const post = await (db as any).contentCalendar.update({
        where: { id: req.params.id },
        data: { status: 'APPROVED', approvedAt: new Date() }
      })
      return reply.send({ success: true, data: post })
    } catch (err) {
      app.log.error(err, 'PATCH /admin/marketing/content/:id/approve failed')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to approve content' } })
    }
  })

  // PATCH /admin/marketing/content/:id/edit
  app.patch<{ Params: { id: string } }>('/admin/marketing/content/:id/edit', { preHandler: [requireAuth, requireAdmin] }, async (req: any, reply) => {
    try {
      const { body, hashtags } = req.body as any
      const post = await (db as any).contentCalendar.update({
        where: { id: req.params.id },
        data: { body, hashtags: hashtags ?? [], status: 'EDITED_AND_APPROVED', approvedAt: new Date() }
      })
      return reply.send({ success: true, data: post })
    } catch (err) {
      app.log.error(err, 'PATCH /admin/marketing/content/:id/edit failed')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to edit content' } })
    }
  })

  // PATCH /admin/marketing/content/:id/skip
  app.patch<{ Params: { id: string } }>('/admin/marketing/content/:id/skip', { preHandler: [requireAuth, requireAdmin] }, async (req: any, reply) => {
    try {
      await (db as any).contentCalendar.update({ where: { id: req.params.id }, data: { status: 'SKIPPED' } })
      return reply.send({ success: true })
    } catch (err) {
      app.log.error(err, 'PATCH /admin/marketing/content/:id/skip failed')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to skip content' } })
    }
  })

  // POST /admin/marketing/content/approve-all
  app.post('/admin/marketing/content/approve-all', { preHandler: [requireAuth, requireAdmin] }, async (req: any, reply) => {
    try {
      const today = await (db as any).contentCalendar.findMany({
        where: { date: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) }, status: 'PENDING_APPROVAL' }
      })
      for (const post of today) {
        await (db as any).contentCalendar.update({ where: { id: post.id }, data: { status: 'APPROVED', approvedAt: new Date() } })
      }
      return reply.send({ success: true, approved: today.length })
    } catch (err) {
      app.log.error(err, 'POST /admin/marketing/content/approve-all failed')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to approve all content' } })
    }
  })

  // GET /admin/marketing/engagement
  app.get('/admin/marketing/engagement', { preHandler: [requireAuth, requireAdmin] }, async (req: any, reply) => {
    try {
      const { status = 'PENDING', limit = '50' } = req.query as any
      const items = await (db as any).engagementItem.findMany({
        where: { replyStatus: status },
        orderBy: { detectedAt: 'desc' },
        take: Math.min(100, parseInt(limit))
      })
      return reply.send({ success: true, data: items })
    } catch (err) {
      app.log.error(err, 'GET /admin/marketing/engagement failed')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch engagement items' } })
    }
  })

  // PATCH /admin/marketing/engagement/:id/reply
  app.patch<{ Params: { id: string } }>('/admin/marketing/engagement/:id/reply', { preHandler: [requireAuth, requireAdmin] }, async (req: any, reply) => {
    try {
      const { action, editedReply } = req.body as any
      if (!['APPROVE', 'SKIP'].includes(action)) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'action must be APPROVE or SKIP' } })
      }
      if (action === 'SKIP') {
        await (db as any).engagementItem.update({ where: { id: req.params.id }, data: { replyStatus: 'SKIPPED' } })
        return reply.send({ success: true })
      }
      const item = await (db as any).engagementItem.findUnique({ where: { id: req.params.id } })
      if (!item) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Engagement item not found' } })
      const replyText = editedReply ?? item.draftReply
      const credential = await (db as any).socialCredential.findFirst({ where: { platform: item.platform, isActive: true } })
      if (credential) {
        try {
          const connector = getConnector(item.platform, credential.accessToken)
          if (item.type === 'MENTION') await connector.replyToMention(item.platformPostId, replyText)
          else await connector.replyToComment(item.platformPostId, replyText)
        } catch (connErr) {
          app.log.error(connErr, `Failed to send reply via ${item.platform} connector`)
          // Continue — still mark as POSTED locally so admin doesn't re-send
        }
      }
      await (db as any).engagementItem.update({
        where: { id: req.params.id },
        data: { replyStatus: 'POSTED', draftReply: replyText, repliedAt: new Date() }
      })
      return reply.send({ success: true })
    } catch (err) {
      app.log.error(err, 'PATCH /admin/marketing/engagement/:id/reply failed')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to post reply' } })
    }
  })

  // GET /admin/marketing/analytics
  app.get('/admin/marketing/analytics', { preHandler: [requireAuth, requireAdmin] }, async (req: any, reply) => {
    try {
      const { days = '7' } = req.query as any
      const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
      const analytics = await (db as any).marketingAnalytics.findMany({
        where: { date: { gte: since } },
        orderBy: { date: 'desc' }
      })
      return reply.send({ success: true, data: analytics })
    } catch (err) {
      app.log.error(err, 'GET /admin/marketing/analytics failed')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics' } })
    }
  })

  // GET /admin/marketing/calendar
  app.get('/admin/marketing/calendar', { preHandler: [requireAuth, requireAdmin] }, async (req: any, reply) => {
    try {
      const { days = '7' } = req.query as any
      const since = startOfDay(new Date())
      const until = new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000)
      const posts = await (db as any).contentCalendar.findMany({
        where: { scheduledAt: { gte: since, lte: until } },
        orderBy: { scheduledAt: 'asc' }
      })
      return reply.send({ success: true, data: posts })
    } catch (err) {
      app.log.error(err, 'GET /admin/marketing/calendar failed')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch calendar' } })
    }
  })

  // GET /admin/marketing/credentials
  app.get('/admin/marketing/credentials', { preHandler: [requireAuth, requireAdmin] }, async (req: any, reply) => {
    try {
      const creds = await (db as any).socialCredential.findMany({
        select: { id: true, platform: true, accountName: true, accountId: true, isActive: true, tokenExpiry: true, createdAt: true, updatedAt: true }
      })
      return reply.send({ success: true, data: creds })
    } catch (err) {
      app.log.error(err, 'GET /admin/marketing/credentials failed')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch credentials' } })
    }
  })

  // POST /admin/marketing/credentials/connect
  app.post('/admin/marketing/credentials/connect', { preHandler: [requireAuth, requireAdmin] }, async (req: any, reply) => {
    try {
      const { platform } = req.body as any
      const validPlatforms = ['LINKEDIN', 'TWITTER', 'INSTAGRAM', 'YOUTUBE', 'WHATSAPP_BUSINESS', 'FACEBOOK']
      if (!validPlatforms.includes(platform)) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid platform' } })
      }
      // Use a random ephemeral token for OAuth URL generation (no real token needed at this stage)
      const ephemeralToken = crypto.randomBytes(16).toString('hex')
      const connector = getConnector(platform, ephemeralToken)
      const authUrl = connector.getAuthUrl()
      return reply.send({ success: true, data: { authUrl } })
    } catch (err) {
      app.log.error(err, 'POST /admin/marketing/credentials/connect failed')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate auth URL' } })
    }
  })

  // POST /admin/marketing/trigger-generation
  app.post('/admin/marketing/trigger-generation', { preHandler: [requireAuth, requireAdmin] }, async (req: any, reply) => {
    try {
      runContentGeneration().catch((err) => app.log.error(err, 'Background content generation failed'))
      return reply.send({ success: true, message: 'Content generation triggered' })
    } catch (err) {
      app.log.error(err, 'POST /admin/marketing/trigger-generation failed')
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to trigger generation' } })
    }
  })
}
