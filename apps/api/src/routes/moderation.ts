import { FastifyInstance } from 'fastify'
import { prisma as db } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { requireTermsAccepted } from '../middleware/terms'
import { checkAccountStatus } from '../middleware/account-status'
import { checkRateLimit, RATE_LIMITS } from '../lib/rate-limit'

const preHandler = [requireAuth, checkAccountStatus, requireTermsAccepted]

async function assertAdmin(userId: string, reply: any): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  if (!user?.isAdmin) {
    await reply.status(403).send({ success: false, message: 'Admin only' })
    return false
  }
  return true
}

export async function moderationRoutes(app: FastifyInstance): Promise<void> {

  app.post('/reports', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const { contentType, contentId, reason, description } = req.body as any
    const allowed = await checkRateLimit(`rl:reports:${userId}`, RATE_LIMITS.reports, reply)
    if (!allowed) return
    if (!['MESSAGE', 'PROFILE', 'REPO_ITEM'].includes(contentType)) return reply.status(400).send({ success: false, message: 'Invalid contentType' })
    if (!['ILLEGAL_CONTENT', 'HARASSMENT', 'SPAM', 'FRAUD', 'HATE_SPEECH', 'OTHER'].includes(reason)) return reply.status(400).send({ success: false, message: 'Invalid reason' })
    const report = await db.userReport.create({ data: { reporterId: userId, reportedId: contentId, contentType, contentId, reason, description: description ? String(description).slice(0, 500) : null } })
    if (reason === 'ILLEGAL_CONTENT') {
      const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } })
      await Promise.all(admins.map((admin: { id: string }) => (db.notification as any).create({ data: { userId: admin.id, type: 'PRIORITY_REPORT', title: 'Priority: Illegal content reported', body: `Report #${report.id} requires immediate review`, link: `/admin/reports/${report.id}` } })))
    }
    return reply.status(201).send({ success: true, data: { id: report.id } })
  })

  app.get('/admin/reports', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    const { status, reason, page = '1', limit = '20' } = req.query as any
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(50, parseInt(limit))
    const reports = await db.userReport.findMany({ where: { ...(status ? { status } : {}), ...(reason ? { reason } : {}) }, orderBy: { createdAt: 'desc' }, skip: (pageNum - 1) * limitNum, take: limitNum })
    return reply.send({ success: true, data: reports })
  })

  app.patch<{ Params: { id: string } }>('/admin/reports/:id', { preHandler: [requireAuth] }, async (req: any, reply) => {
    const adminId = req.user.id
    if (!await assertAdmin(adminId, reply)) return
    const { id } = req.params
    const { action, adminAction, reason } = req.body as any
    if (!['DISMISS', 'ACTION'].includes(action)) return reply.status(400).send({ success: false, message: 'action must be DISMISS or ACTION' })
    const report = await db.userReport.findUnique({ where: { id } })
    if (!report) return reply.status(404).send({ success: false, message: 'Not found' })
    await db.userReport.update({ where: { id }, data: { status: action === 'DISMISS' ? 'DISMISSED' : 'ACTIONED', reviewedById: adminId, reviewedAt: new Date() } })
    if (action === 'ACTION' && adminAction) {
      const validActions = ['WARN_USER', 'SUSPEND_USER', 'DELETE_CONTENT', 'BAN_USER']
      if (!validActions.includes(adminAction)) return reply.status(400).send({ success: false, message: 'Invalid adminAction' })
      await db.adminAction.create({ data: { adminId, targetType: report.contentType, targetId: report.reportedId, action: adminAction, reason: reason ? String(reason).slice(0, 500) : `Report #${id}` } })
      if (adminAction === 'WARN_USER') {
        await (db.notification as any).create({ data: { userId: report.reportedId, type: 'ACCOUNT_WARNING', title: 'Account Warning', body: 'Your account has received a warning for violating Arivarangam Terms of Service.', link: '/terms' } })
      }
      if (['SUSPEND_USER', 'BAN_USER'].includes(adminAction)) {
        await db.user.update({ where: { id: report.reportedId }, data: { isSuspended: true, suspendedAt: new Date(), suspendedReason: `${adminAction} following report #${id}` } })
        await db.refreshToken.updateMany({ where: { userId: report.reportedId }, data: { isRevoked: true } })
      }
      if (adminAction === 'DELETE_CONTENT' && report.contentType === 'MESSAGE') {
        await db.message.updateMany({ where: { id: report.contentId }, data: { deletedAt: new Date(), content: '' } })
      }
    }
    return reply.send({ success: true })
  })

  app.get('/admin/conversations', { preHandler: [requireAuth] }, async (req: any, reply) => {
    if (!await assertAdmin(req.user.id, reply)) return
    const allowed = await checkRateLimit(`rl:adminAccess:${req.user.id}`, RATE_LIMITS.adminAccess, reply)
    if (!allowed) return
    const { type, page = '1', limit = '20' } = req.query as any
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(50, parseInt(limit))
    const convs = await db.conversation.findMany({ where: { ...(type ? { type } : {}) }, include: { _count: { select: { members: true, messages: true } } }, orderBy: { updatedAt: 'desc' }, skip: (pageNum - 1) * limitNum, take: limitNum })
    return reply.send({ success: true, data: convs })
  })

  app.get<{ Params: { id: string } }>('/admin/conversations/:id/messages', { preHandler: [requireAuth] }, async (req: any, reply) => {
    const adminId = req.user.id
    if (!await assertAdmin(adminId, reply)) return
    const { reason } = req.query as any
    if (!reason || String(reason).trim().length < 10) return reply.status(400).send({ success: false, message: 'reason query param required (min 10 chars) for audit compliance' })
    const allowed = await checkRateLimit(`rl:adminAccess:${adminId}`, RATE_LIMITS.adminAccess, reply)
    if (!allowed) return
    const { id } = req.params
    await db.adminMessageAccess.create({ data: { adminId, conversationId: id, reason: String(reason).slice(0, 500) } })
    const { cursor, limit = '50' } = req.query as any
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const messages = await db.message.findMany({ where: { conversationId: id, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) }, orderBy: { createdAt: 'desc' }, take: limitNum })
    return reply.send({ success: true, data: messages.reverse() })
  })
}
