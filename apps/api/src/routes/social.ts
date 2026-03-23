import { FastifyInstance } from 'fastify'
import { prisma as db } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { requireTermsAccepted } from '../middleware/terms'
import { checkAccountStatus } from '../middleware/account-status'
import { checkRateLimit, RATE_LIMITS } from '../lib/rate-limit'

const preHandler = [requireAuth, checkAccountStatus, requireTermsAccepted]

export async function socialRoutes(app: FastifyInstance): Promise<void> {

  // GET /social/users
  app.get('/social/users', { preHandler }, async (req: any, reply) => {
    const { search = '', page = '1', limit = '20' } = req.query as any
    const userId = req.user.id
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)))

    const allowed = await checkRateLimit(`rl:profileSearch:${userId}`, RATE_LIMITS.profileSearch, reply)
    if (!allowed) return

    const blocks = await db.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true }
    })
    const blockedIds = new Set(
      blocks.flatMap(b => [b.blockerId, b.blockedId]).filter(id => id !== userId)
    )

    const searchStr = String(search).slice(0, 100).replace(/[%_\\]/g, '\\$&')

    const profiles = await db.userSocialProfile.findMany({
      where: {
        userId: { notIn: [...blockedIds, userId] },
        ...(searchStr ? { displayName: { contains: searchStr, mode: 'insensitive' as const } } : {})
      },
      select: { id: true, userId: true, displayName: true, avatarUrl: true, isVerified: true, friendsCount: true },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { displayName: 'asc' }
    })

    const friendships = await db.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true }
    })
    const friendSet = new Set(friendships.flatMap(f => [f.userAId, f.userBId]).filter(id => id !== userId))

    const pendingRequests = await db.friendRequest.findMany({
      where: { senderId: userId, status: 'PENDING' },
      select: { receiverId: true }
    })
    const pendingSet = new Set(pendingRequests.map(r => r.receiverId))

    const result = profiles.map(p => ({
      id: p.id,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      isVerified: p.isVerified,
      friendsCount: p.friendsCount,
      isFriend: friendSet.has(p.userId),
      requestSent: pendingSet.has(p.userId),
    }))

    return reply.send({ success: true, data: result, page: pageNum, limit: limitNum })
  })

  // GET /social/users/:id
  app.get<{ Params: { id: string } }>('/social/users/:id', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    const userId = req.user.id

    const profile = await db.userSocialProfile.findUnique({ where: { id } })
    if (!profile) return reply.status(404).send({ success: false, message: 'User not found' })

    const block = await db.userBlock.findFirst({
      where: { OR: [{ blockerId: userId, blockedId: profile.userId }, { blockerId: profile.userId, blockedId: userId }] }
    })
    if (block) return reply.status(404).send({ success: false, message: 'User not found' })

    const [a, b] = [userId, profile.userId].sort()
    const friendship = await db.friendship.findFirst({ where: { userAId: a, userBId: b } })
    const isOwn = userId === profile.userId

    if (profile.isPrivate && !friendship && !isOwn) {
      return reply.send({
        success: true,
        data: { id: profile.id, displayName: profile.displayName, avatarUrl: profile.avatarUrl, isVerified: profile.isVerified, isPrivate: true, message: 'This profile is private. Send a friend request to see more.' }
      })
    }

    return reply.send({
      success: true,
      data: {
        id: profile.id, displayName: profile.displayName, avatarUrl: profile.avatarUrl,
        isVerified: profile.isVerified, isPrivate: profile.isPrivate,
        bio: profile.bio, location: profile.location, website: profile.website,
        friendsCount: profile.friendsCount, reposCount: profile.reposCount,
        isFriend: !!friendship, isOwn, createdAt: profile.createdAt,
      }
    })
  })

  // POST /social/friends/request
  app.post('/social/friends/request', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const { targetProfileId, message } = req.body as any

    if (!targetProfileId || typeof targetProfileId !== 'string') {
      return reply.status(400).send({ success: false, message: 'targetProfileId required' })
    }

    const allowed = await checkRateLimit(`rl:friendReq:${userId}`, RATE_LIMITS.friendRequests, reply)
    if (!allowed) return

    const targetProfile = await db.userSocialProfile.findUnique({ where: { id: targetProfileId } })
    if (!targetProfile) return reply.status(404).send({ success: false, message: 'User not found' })

    const targetUserId = targetProfile.userId
    if (targetUserId === userId) return reply.status(400).send({ success: false, message: 'Cannot send request to yourself' })

    const block = await db.userBlock.findFirst({
      where: { OR: [{ blockerId: userId, blockedId: targetUserId }, { blockerId: targetUserId, blockedId: userId }] }
    })
    if (block) return reply.status(404).send({ success: false, message: 'User not found' })

    const [a, b] = [userId, targetUserId].sort()
    const friendship = await db.friendship.findFirst({ where: { userAId: a, userBId: b } })
    if (friendship) return reply.status(409).send({ success: false, message: 'Already friends' })

    const existing = await db.friendRequest.findFirst({
      where: { OR: [{ senderId: userId, receiverId: targetUserId }, { senderId: targetUserId, receiverId: userId }], status: 'PENDING' }
    })
    if (existing) return reply.status(409).send({ success: false, message: 'Friend request already pending' })

    const friendRequest = await db.friendRequest.create({
      data: { senderId: userId, receiverId: targetUserId, message: message ? String(message).slice(0, 200) : null }
    })

    await (db.notification as any).create({
      data: {
        userId: targetUserId,
        type: 'FRIEND_REQUEST',
        title: 'New friend request',
        body: 'Someone sent you a friend request',
        link: `/profile/${targetProfileId}`
      }
    })

    return reply.status(201).send({ success: true, data: friendRequest })
  })

  // GET /social/friends/requests
  app.get('/social/friends/requests', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const [incoming, outgoing] = await Promise.all([
      db.friendRequest.findMany({ where: { receiverId: userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } }),
      db.friendRequest.findMany({ where: { senderId: userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } })
    ])
    return reply.send({ success: true, data: { incoming, outgoing } })
  })

  // PATCH /social/friends/requests/:id
  app.patch<{ Params: { id: string } }>('/social/friends/requests/:id', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    const { action } = req.body as any
    const userId = req.user.id

    if (!['ACCEPT', 'REJECT'].includes(action)) {
      return reply.status(400).send({ success: false, message: 'action must be ACCEPT or REJECT' })
    }

    const request = await db.friendRequest.findUnique({ where: { id } })
    if (!request || request.receiverId !== userId) return reply.status(404).send({ success: false, message: 'Request not found' })
    if (request.status !== 'PENDING') return reply.status(409).send({ success: false, message: 'Already responded' })

    await db.friendRequest.update({ where: { id }, data: { status: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', respondedAt: new Date() } })

    if (action === 'ACCEPT') {
      const [a, b] = [request.senderId, request.receiverId].sort()
      await db.friendship.create({ data: { userAId: a, userBId: b } })
      await db.$transaction([
        db.userSocialProfile.updateMany({ where: { userId: request.senderId }, data: { friendsCount: { increment: 1 } } }),
        db.userSocialProfile.updateMany({ where: { userId: request.receiverId }, data: { friendsCount: { increment: 1 } } })
      ])
      const receiverProfile = await db.userSocialProfile.findUnique({ where: { userId: request.receiverId } })
      await (db.notification as any).create({
        data: { userId: request.senderId, type: 'FRIEND_ACCEPTED', title: 'Friend request accepted', body: 'Your friend request was accepted', link: `/profile/${receiverProfile?.id ?? ''}` }
      })
    }

    return reply.send({ success: true })
  })

  // GET /social/friends
  app.get('/social/friends', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const friendships = await db.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { createdAt: 'desc' }
    })
    const friendUserIds = friendships.map(f => f.userAId === userId ? f.userBId : f.userAId)
    const profiles = await db.userSocialProfile.findMany({
      where: { userId: { in: friendUserIds } },
      select: { id: true, displayName: true, avatarUrl: true, isVerified: true, friendsCount: true, userId: true }
    })
    return reply.send({ success: true, data: profiles })
  })

  // DELETE /social/friends/:id
  app.delete<{ Params: { id: string } }>('/social/friends/:id', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    const userId = req.user.id
    const friendship = await db.friendship.findUnique({ where: { id } })
    if (!friendship) return reply.status(404).send({ success: false, message: 'Not found' })
    if (friendship.userAId !== userId && friendship.userBId !== userId) return reply.status(403).send({ success: false, message: 'Forbidden' })
    await db.friendship.delete({ where: { id } })
    await db.$transaction([
      db.userSocialProfile.updateMany({ where: { userId: friendship.userAId }, data: { friendsCount: { decrement: 1 } } }),
      db.userSocialProfile.updateMany({ where: { userId: friendship.userBId }, data: { friendsCount: { decrement: 1 } } })
    ])
    return reply.send({ success: true })
  })

  // POST /social/block/:id
  app.post<{ Params: { id: string } }>('/social/block/:id', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    const userId = req.user.id
    const targetProfile = await db.userSocialProfile.findUnique({ where: { id } })
    if (!targetProfile) return reply.status(404).send({ success: false, message: 'User not found' })
    const targetUserId = targetProfile.userId
    if (targetUserId === userId) return reply.status(400).send({ success: false, message: 'Cannot block yourself' })

    await db.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
      create: { blockerId: userId, blockedId: targetUserId },
      update: {}
    })

    const [a, b] = [userId, targetUserId].sort()
    const friendship = await db.friendship.findFirst({ where: { userAId: a, userBId: b } })
    if (friendship) {
      await db.friendship.delete({ where: { id: friendship.id } })
      await db.$transaction([
        db.userSocialProfile.updateMany({ where: { userId }, data: { friendsCount: { decrement: 1 } } }),
        db.userSocialProfile.updateMany({ where: { userId: targetUserId }, data: { friendsCount: { decrement: 1 } } })
      ])
    }

    await db.friendRequest.deleteMany({
      where: { OR: [{ senderId: userId, receiverId: targetUserId }, { senderId: targetUserId, receiverId: userId }] }
    })

    return reply.send({ success: true })
  })

  // PATCH /social/profile
  app.patch('/social/profile', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const body = req.body as any
    const data: any = {}
    if (typeof body.displayName === 'string') data.displayName = body.displayName.slice(0, 50)
    if (typeof body.bio === 'string') data.bio = body.bio.slice(0, 300)
    if (typeof body.location === 'string') data.location = body.location.slice(0, 100)
    if (typeof body.website === 'string') data.website = body.website.slice(0, 200)
    if (typeof body.isPrivate === 'boolean') data.isPrivate = body.isPrivate

    const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } })
    const profile = await db.userSocialProfile.upsert({
      where: { userId },
      create: { userId, displayName: (body.displayName ?? user?.name ?? 'User').slice(0, 50), ...data },
      update: data
    })
    return reply.send({ success: true, data: profile })
  })

  // GET /social/profile/me
  app.get('/social/profile/me', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const profile = await db.userSocialProfile.findUnique({ where: { userId } })
    return reply.send({ success: true, data: profile })
  })
}
