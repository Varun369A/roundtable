import { FastifyInstance } from 'fastify'
import { prisma as db } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { requireTermsAccepted } from '../middleware/terms'
import { checkAccountStatus } from '../middleware/account-status'
import { checkRateLimit, RATE_LIMITS } from '../lib/rate-limit'
import { emitToConversation } from '../lib/websocket-emitter'

const preHandler = [requireAuth, checkAccountStatus, requireTermsAccepted]

export async function messagingRoutes(app: FastifyInstance): Promise<void> {

  // POST /conversations
  app.post('/conversations', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const { type, memberUserIds, name, description } = req.body as any

    if (!['DIRECT', 'GROUP'].includes(type)) {
      return reply.status(400).send({ success: false, message: 'type must be DIRECT or GROUP' })
    }

    const allIds: string[] = Array.from(new Set([userId, ...(memberUserIds ?? [])]))

    if (type === 'DIRECT') {
      if (allIds.length !== 2) return reply.status(400).send({ success: false, message: 'DM requires exactly 2 users' })
      const otherId = allIds.find(id => id !== userId)!

      const [a, b] = [userId, otherId].sort()
      const friendship = await db.friendship.findFirst({ where: { userAId: a, userBId: b } })
      if (!friendship) return reply.status(403).send({ success: false, message: 'Must be friends to start a DM' })

      const block = await db.userBlock.findFirst({
        where: { OR: [{ blockerId: userId, blockedId: otherId }, { blockerId: otherId, blockedId: userId }] }
      })
      if (block) return reply.status(404).send({ success: false, message: 'User not found' })

      // Find existing DM
      const existing = await db.conversationMember.findMany({
        where: { userId, leftAt: null, conversation: { type: 'DIRECT', isArchived: false } },
        select: { conversationId: true }
      })
      const myConvIds = existing.map(e => e.conversationId)
      const sharedConv = await db.conversationMember.findFirst({
        where: { userId: otherId, conversationId: { in: myConvIds }, leftAt: null }
      })
      if (sharedConv) {
        const conv = await db.conversation.findUnique({ where: { id: sharedConv.conversationId }, include: { members: true } })
        return reply.send({ success: true, data: conv })
      }

      const conv = await db.conversation.create({
        data: { type: 'DIRECT', createdById: userId, members: { create: allIds.map(uid => ({ userId: uid, role: 'MEMBER' as const })) } },
        include: { members: true }
      })
      return reply.status(201).send({ success: true, data: conv })
    }

    // GROUP
    if (allIds.length < 2 || allIds.length > 10) return reply.status(400).send({ success: false, message: 'Group requires 2–10 members' })
    if (!name || typeof name !== 'string') return reply.status(400).send({ success: false, message: 'Group name required' })

    const conv = await db.conversation.create({
      data: {
        type: 'GROUP', name: name.slice(0, 100),
        description: description ? String(description).slice(0, 300) : null,
        createdById: userId,
        members: { create: allIds.map(uid => ({ userId: uid, role: (uid === userId ? 'ADMIN' : 'MEMBER') as any })) }
      },
      include: { members: true }
    })
    return reply.status(201).send({ success: true, data: conv })
  })

  // GET /conversations
  app.get('/conversations', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const memberships = await db.conversationMember.findMany({ where: { userId, leftAt: null }, select: { conversationId: true } })
    const convIds = memberships.map(m => m.conversationId)
    const convs = await db.conversation.findMany({
      where: { id: { in: convIds }, isArchived: false },
      include: {
        members: { where: { leftAt: null }, select: { userId: true, role: true, lastReadAt: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, deletedAt: true, createdAt: true, senderId: true, type: true } }
      },
      orderBy: { updatedAt: 'desc' }
    })
    return reply.send({ success: true, data: convs })
  })

  // GET /conversations/:id
  app.get<{ Params: { id: string } }>('/conversations/:id', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    const userId = req.user.id
    const member = await db.conversationMember.findFirst({ where: { conversationId: id, userId, leftAt: null } })
    if (!member) return reply.status(403).send({ success: false, message: 'Forbidden' })
    const conv = await db.conversation.findUnique({ where: { id }, include: { members: { where: { leftAt: null } } } })
    return reply.send({ success: true, data: conv })
  })

  // GET /conversations/:id/messages
  app.get<{ Params: { id: string } }>('/conversations/:id/messages', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    const { cursor, limit = '50' } = req.query as any
    const userId = req.user.id
    const member = await db.conversationMember.findFirst({ where: { conversationId: id, userId, leftAt: null } })
    if (!member) return reply.status(403).send({ success: false, message: 'Forbidden' })

    const limitNum = Math.min(50, Math.max(1, parseInt(limit)))
    const messages = await db.message.findMany({
      where: { conversationId: id, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      select: { id: true, conversationId: true, senderId: true, content: true, type: true, fileUrl: true, fileMeta: true, replyToId: true, editedAt: true, deletedAt: true, createdAt: true }
    })

    const sanitized = messages.map(m => ({
      ...m,
      content: m.deletedAt ? 'This message was deleted' : m.content,
      fileUrl: m.deletedAt ? null : m.fileUrl,
      fileMeta: m.deletedAt ? null : m.fileMeta,
    }))

    const nextCursor = messages.length === limitNum ? messages[messages.length - 1].createdAt.toISOString() : null
    return reply.send({ success: true, data: sanitized.reverse(), nextCursor })
  })

  // POST /conversations/:id/messages
  app.post<{ Params: { id: string } }>('/conversations/:id/messages', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    const userId = req.user.id
    const { content, type = 'TEXT', fileUrl, fileMeta, replyToId } = req.body as any

    const member = await db.conversationMember.findFirst({ where: { conversationId: id, userId, leftAt: null } })
    if (!member) return reply.status(403).send({ success: false, message: 'Forbidden' })

    const allowed = await checkRateLimit(`rl:msg:${id}:${userId}`, RATE_LIMITS.messages, reply)
    if (!allowed) return

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return reply.status(400).send({ success: false, message: 'Content required' })
    }
    if (content.length > 4000) return reply.status(400).send({ success: false, message: 'Content max 4000 characters' })

    const msg = await db.message.create({
      data: { conversationId: id, senderId: userId, content: content.trim(), type, fileUrl: fileUrl ?? null, fileMeta: fileMeta ?? null, replyToId: replyToId ?? null }
    })

    await db.conversation.update({ where: { id }, data: { updatedAt: new Date() } })
    await emitToConversation(id, { type: 'message.new', conversationId: id, payload: msg, timestamp: new Date().toISOString() })

    return reply.status(201).send({ success: true, data: msg })
  })

  // PATCH /conversations/:id/messages/:msgId
  app.patch<{ Params: { id: string; msgId: string } }>('/conversations/:id/messages/:msgId', { preHandler }, async (req: any, reply) => {
    const { id, msgId } = req.params
    const userId = req.user.id
    const { content } = req.body as any

    const member = await db.conversationMember.findFirst({ where: { conversationId: id, userId, leftAt: null } })
    if (!member) return reply.status(403).send({ success: false, message: 'Forbidden' })

    const msg = await db.message.findUnique({ where: { id: msgId } })
    if (!msg || msg.conversationId !== id) return reply.status(404).send({ success: false, message: 'Not found' })
    if (msg.senderId !== userId) return reply.status(403).send({ success: false, message: 'Can only edit own messages' })
    if (msg.deletedAt) return reply.status(400).send({ success: false, message: 'Cannot edit deleted message' })
    if (msg.type === 'SYSTEM') return reply.status(400).send({ success: false, message: 'Cannot edit system messages' })
    if (!content || content.length > 4000) return reply.status(400).send({ success: false, message: 'Invalid content' })

    const existingMeta = (msg.fileMeta as any) ?? {}
    const editHistory = [...(existingMeta.editHistory ?? []), { content: msg.content, editedAt: msg.editedAt ?? msg.createdAt }]

    const updated = await db.message.update({
      where: { id: msgId },
      data: { content: content.trim(), editedAt: new Date(), fileMeta: { ...existingMeta, editHistory } }
    })

    await emitToConversation(id, { type: 'message.edit', conversationId: id, payload: updated, timestamp: new Date().toISOString() })
    return reply.send({ success: true, data: updated })
  })

  // DELETE /conversations/:id/messages/:msgId
  app.delete<{ Params: { id: string; msgId: string } }>('/conversations/:id/messages/:msgId', { preHandler }, async (req: any, reply) => {
    const { id, msgId } = req.params
    const userId = req.user.id

    const member = await db.conversationMember.findFirst({ where: { conversationId: id, userId, leftAt: null } })
    if (!member) return reply.status(403).send({ success: false, message: 'Forbidden' })

    const msg = await db.message.findUnique({ where: { id: msgId } })
    if (!msg || msg.conversationId !== id) return reply.status(404).send({ success: false, message: 'Not found' })

    if (msg.senderId !== userId && member.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, message: 'Forbidden' })
    }

    await db.message.update({ where: { id: msgId }, data: { deletedAt: new Date(), content: '', fileUrl: null, fileMeta: undefined } })
    await emitToConversation(id, { type: 'message.delete', conversationId: id, payload: { messageId: msgId }, timestamp: new Date().toISOString() })
    return reply.send({ success: true })
  })

  // POST /conversations/:id/members
  app.post<{ Params: { id: string } }>('/conversations/:id/members', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    const userId = req.user.id
    const { newUserId } = req.body as any

    const member = await db.conversationMember.findFirst({ where: { conversationId: id, userId, leftAt: null } })
    if (!member || member.role !== 'ADMIN') return reply.status(403).send({ success: false, message: 'Must be group admin' })

    const activeCount = await db.conversationMember.count({ where: { conversationId: id, leftAt: null } })
    if (activeCount >= 10) return reply.status(400).send({ success: false, message: 'Group is full' })

    const existingMember = await db.conversationMember.findFirst({ where: { conversationId: id, userId: newUserId } })
    if (existingMember && !existingMember.leftAt) return reply.status(409).send({ success: false, message: 'Already a member' })

    if (existingMember) {
      await db.conversationMember.update({ where: { id: existingMember.id }, data: { leftAt: null, joinedAt: new Date() } })
    } else {
      await db.conversationMember.create({ data: { conversationId: id, userId: newUserId, role: 'MEMBER' } })
    }

    const profile = await db.userSocialProfile.findUnique({ where: { userId: newUserId } })
    await db.message.create({ data: { conversationId: id, senderId: userId, content: `${profile?.displayName ?? 'A user'} was added to the group`, type: 'SYSTEM' } })
    await emitToConversation(id, { type: 'member.join', conversationId: id, payload: { userId: newUserId }, timestamp: new Date().toISOString() })
    return reply.status(201).send({ success: true })
  })

  // DELETE /conversations/:id/members/:uid
  app.delete<{ Params: { id: string; uid: string } }>('/conversations/:id/members/:uid', { preHandler }, async (req: any, reply) => {
    const { id, uid } = req.params
    const userId = req.user.id

    const myMembership = await db.conversationMember.findFirst({ where: { conversationId: id, userId, leftAt: null } })
    if (!myMembership) return reply.status(403).send({ success: false, message: 'Forbidden' })

    const isSelf = uid === userId
    if (!isSelf && myMembership.role !== 'ADMIN') return reply.status(403).send({ success: false, message: 'Must be admin to remove others' })

    const targetMembership = await db.conversationMember.findFirst({ where: { conversationId: id, userId: uid, leftAt: null } })
    if (!targetMembership) return reply.status(404).send({ success: false, message: 'Member not found' })

    await db.conversationMember.update({ where: { id: targetMembership.id }, data: { leftAt: new Date() } })

    const profile = await db.userSocialProfile.findUnique({ where: { userId: uid } })
    const action = isSelf ? 'left the group' : 'was removed'
    await db.message.create({ data: { conversationId: id, senderId: userId, content: `${profile?.displayName ?? 'A user'} ${action}`, type: 'SYSTEM' } })

    const remaining = await db.conversationMember.count({ where: { conversationId: id, leftAt: null } })
    if (remaining === 0) await db.conversation.update({ where: { id }, data: { isArchived: true } })

    await emitToConversation(id, { type: 'member.leave', conversationId: id, payload: { userId: uid }, timestamp: new Date().toISOString() })
    return reply.send({ success: true })
  })

  // POST /conversations/:id/read
  app.post<{ Params: { id: string } }>('/conversations/:id/read', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    const userId = req.user.id
    const member = await db.conversationMember.findFirst({ where: { conversationId: id, userId, leftAt: null } })
    if (!member) return reply.status(403).send({ success: false, message: 'Forbidden' })
    await db.conversationMember.updateMany({ where: { conversationId: id, userId }, data: { lastReadAt: new Date() } })
    return reply.send({ success: true })
  })
}
