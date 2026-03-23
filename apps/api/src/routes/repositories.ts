import { FastifyInstance } from 'fastify'
import { prisma as db } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { requireTermsAccepted } from '../middleware/terms'
import { checkAccountStatus } from '../middleware/account-status'
import { checkRateLimit, RATE_LIMITS } from '../lib/rate-limit'

const preHandler = [requireAuth, checkAccountStatus, requireTermsAccepted]

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 100)
}

async function checkRepoAccess(repoId: string, userId: string, required: 'READ' | 'WRITE' | 'ADMIN' = 'READ'): Promise<boolean> {
  const repo = await db.sabhaRepo.findUnique({ where: { id: repoId } })
  if (!repo || repo.isArchived) return false
  if (repo.ownerId === userId) return true

  const user = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  if (user?.isAdmin && required === 'READ') return true

  const collab = await db.repoCollaborator.findFirst({ where: { repoId, userId, revokedAt: null } })
  if (collab) {
    if (required === 'READ') return true
    if (required === 'WRITE') return ['WRITE', 'ADMIN'].includes(collab.permission)
    if (required === 'ADMIN') return collab.permission === 'ADMIN'
  }

  if (repo.visibility === 'PRIVATE') return false
  if (repo.visibility === 'FRIENDS') {
    const [a, b] = [userId, repo.ownerId].sort()
    const f = await db.friendship.findFirst({ where: { userAId: a, userBId: b } })
    return !!f && required === 'READ'
  }
  return false
}

const VALID_CATEGORIES = ['CODE', 'CONTENT', 'DESIGN', 'STRATEGY', 'RESEARCH', 'MIXED']

export async function repositoryRoutes(app: FastifyInstance): Promise<void> {

  app.post('/repos', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const { name, description, category, visibility } = req.body as any
    const allowed = await checkRateLimit(`rl:repoCreate:${userId}`, RATE_LIMITS.repoCreation, reply)
    if (!allowed) return
    if (!name || !VALID_CATEGORIES.includes(category)) return reply.status(400).send({ success: false, message: 'name and valid category required' })
    const vis = ['PRIVATE', 'FRIENDS', 'COLLABORATORS'].includes(visibility) ? visibility : 'PRIVATE'
    let slug = generateSlug(String(name).trim())
    const existing = await db.sabhaRepo.findFirst({ where: { ownerId: userId, slug } })
    if (existing) slug = `${slug}-${Date.now().toString(36)}`
    const repo = await db.sabhaRepo.create({ data: { ownerId: userId, name: String(name).slice(0, 100), slug, description: description ? String(description).slice(0, 500) : null, category, visibility: vis as any } })
    await db.userSocialProfile.updateMany({ where: { userId }, data: { reposCount: { increment: 1 } } })
    return reply.status(201).send({ success: true, data: repo })
  })

  app.get('/repos', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const repos = await db.sabhaRepo.findMany({ where: { ownerId: userId, isArchived: false }, include: { _count: { select: { items: true, commits: true } } }, orderBy: { updatedAt: 'desc' } })
    return reply.send({ success: true, data: repos })
  })

  app.get('/repos/discover', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const { cursor, limit = '20' } = req.query as any
    const limitNum = Math.min(20, Math.max(1, parseInt(limit)))
    const friendships = await db.friendship.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] }, select: { userAId: true, userBId: true } })
    const friendIds = friendships.map(f => f.userAId === userId ? f.userBId : f.userAId)
    const collabRepos = await db.repoCollaborator.findMany({ where: { userId, revokedAt: null }, select: { repoId: true } })
    const collabRepoIds = collabRepos.map(c => c.repoId)
    const repos = await db.sabhaRepo.findMany({
      where: {
        isArchived: false, ownerId: { not: userId },
        OR: [{ id: { in: collabRepoIds } }, { visibility: 'FRIENDS', ownerId: { in: friendIds } }],
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {})
      },
      include: { _count: { select: { items: true } } },
      take: limitNum, orderBy: { updatedAt: 'desc' }
    })
    return reply.send({ success: true, data: repos, nextCursor: repos.length === limitNum ? repos[repos.length - 1].createdAt.toISOString() : null })
  })

  app.get<{ Params: { id: string } }>('/repos/:id', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    if (!await checkRepoAccess(id, req.user.id, 'READ')) return reply.status(404).send({ success: false, message: 'Not found' })
    const repo = await db.sabhaRepo.findUnique({ where: { id }, include: { _count: { select: { items: true, commits: true } }, collaborators: { where: { revokedAt: null }, select: { userId: true, permission: true, grantedAt: true } } } })
    return reply.send({ success: true, data: repo })
  })

  app.patch<{ Params: { id: string } }>('/repos/:id', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    if (!await checkRepoAccess(id, req.user.id, 'ADMIN')) return reply.status(403).send({ success: false, message: 'Forbidden' })
    const { name, description, visibility, isArchived } = req.body as any
    const data: any = {}
    if (typeof name === 'string') data.name = name.slice(0, 100)
    if (typeof description === 'string') data.description = description.slice(0, 500)
    if (['PRIVATE', 'FRIENDS', 'COLLABORATORS'].includes(visibility)) data.visibility = visibility
    if (typeof isArchived === 'boolean') data.isArchived = isArchived
    const repo = await db.sabhaRepo.update({ where: { id }, data })
    return reply.send({ success: true, data: repo })
  })

  app.get<{ Params: { id: string } }>('/repos/:id/items', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    if (!await checkRepoAccess(id, req.user.id, 'READ')) return reply.status(404).send({ success: false, message: 'Not found' })
    const { category, search, cursor, limit = '20' } = req.query as any
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)))
    const items = await db.repoItem.findMany({
      where: { repoId: id, isArchived: false, ...(VALID_CATEGORIES.includes(category) ? { category } : {}), ...(search ? { title: { contains: String(search).slice(0, 100), mode: 'insensitive' as const } } : {}), ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
      orderBy: { createdAt: 'desc' }, take: limitNum
    })
    return reply.send({ success: true, data: items, nextCursor: items.length === limitNum ? items[items.length - 1].createdAt.toISOString() : null })
  })

  app.post<{ Params: { id: string } }>('/repos/:id/items', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    const userId = req.user.id
    if (!await checkRepoAccess(id, userId, 'WRITE')) return reply.status(403).send({ success: false, message: 'Forbidden' })
    const { title, category, content, fileUrl, metadata, sourceTaskId, sourceSubtaskId } = req.body as any
    if (!title || !content || !VALID_CATEGORIES.includes(category)) return reply.status(400).send({ success: false, message: 'title, content, valid category required' })
    if (sourceTaskId) {
      const task = await db.task.findFirst({ where: { id: sourceTaskId, userId, status: 'COMPLETED' } })
      if (!task) return reply.status(400).send({ success: false, message: 'Invalid sourceTaskId' })
    }
    const item = await db.repoItem.create({ data: { repoId: id, authorId: userId, title: String(title).slice(0, 200), category, content: String(content), fileUrl: fileUrl ?? null, metadata: metadata ?? null, sourceTaskId: sourceTaskId ?? null, sourceSubtaskId: sourceSubtaskId ?? null } })
    const snapshot = await db.repoItem.findMany({ where: { repoId: id, isArchived: false } })
    await db.repoCommit.create({ data: { repoId: id, authorId: userId, message: `Added: ${item.title}`, itemsAdded: 1, snapshot: snapshot as any } })
    await db.sabhaRepo.update({ where: { id }, data: { updatedAt: new Date() } })
    return reply.status(201).send({ success: true, data: item })
  })

  app.patch<{ Params: { id: string; itemId: string } }>('/repos/:id/items/:itemId', { preHandler }, async (req: any, reply) => {
    const { id, itemId } = req.params
    if (!await checkRepoAccess(id, req.user.id, 'WRITE')) return reply.status(403).send({ success: false, message: 'Forbidden' })
    const { title, content, category, isArchived } = req.body as any
    const data: any = {}
    if (typeof title === 'string') data.title = title.slice(0, 200)
    if (typeof content === 'string') data.content = content
    if (VALID_CATEGORIES.includes(category)) data.category = category
    if (typeof isArchived === 'boolean') data.isArchived = isArchived
    if (Object.keys(data).length > 0) data.version = { increment: 1 }
    const item = await db.repoItem.update({ where: { id: itemId }, data })
    return reply.send({ success: true, data: item })
  })

  app.post<{ Params: { id: string } }>('/repos/:id/collaborators', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    const userId = req.user.id
    if (!await checkRepoAccess(id, userId, 'ADMIN')) return reply.status(403).send({ success: false, message: 'Forbidden' })
    const { targetUserId, permission } = req.body as any
    if (!['READ', 'WRITE', 'ADMIN'].includes(permission)) return reply.status(400).send({ success: false, message: 'Invalid permission' })
    const termsOk = await db.userTermsAcceptance.findFirst({ where: { userId: targetUserId } })
    if (!termsOk) return reply.status(400).send({ success: false, message: 'Target user has not accepted Terms of Service' })
    const block = await db.userBlock.findFirst({ where: { OR: [{ blockerId: userId, blockedId: targetUserId }, { blockerId: targetUserId, blockedId: userId }] } })
    if (block) return reply.status(400).send({ success: false, message: 'Cannot grant access to blocked user' })
    const existing = await db.repoCollaborator.findFirst({ where: { repoId: id, userId: targetUserId, revokedAt: null } })
    if (existing) return reply.status(409).send({ success: false, message: 'Already a collaborator' })
    const collab = await db.repoCollaborator.create({ data: { repoId: id, userId: targetUserId, permission, grantedById: userId } })
    const repo = await db.sabhaRepo.findUnique({ where: { id } })
    await (db.notification as any).create({ data: { userId: targetUserId, type: 'REPO_ACCESS_GRANTED', title: 'Repository access granted', body: `You have been given ${permission} access to "${repo?.name}"`, link: `/repos/${id}` } })
    return reply.status(201).send({ success: true, data: collab })
  })

  app.delete<{ Params: { id: string; uid: string } }>('/repos/:id/collaborators/:uid', { preHandler }, async (req: any, reply) => {
    const { id, uid } = req.params
    const userId = req.user.id
    if (!await checkRepoAccess(id, userId, 'ADMIN')) return reply.status(403).send({ success: false, message: 'Forbidden' })
    await db.repoCollaborator.updateMany({ where: { repoId: id, userId: uid }, data: { revokedAt: new Date() } })
    const repo = await db.sabhaRepo.findUnique({ where: { id } })
    await (db.notification as any).create({ data: { userId: uid, type: 'REPO_ACCESS_REVOKED', title: 'Repository access revoked', body: `Your access to "${repo?.name}" has been revoked`, link: '/repos' } })
    return reply.send({ success: true })
  })

  app.get<{ Params: { id: string } }>('/repos/:id/commits', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    if (!await checkRepoAccess(id, req.user.id, 'READ')) return reply.status(404).send({ success: false, message: 'Not found' })
    const commits = await db.repoCommit.findMany({ where: { repoId: id }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, authorId: true, message: true, itemsAdded: true, itemsModified: true, itemsRemoved: true, createdAt: true } })
    return reply.send({ success: true, data: commits })
  })

  app.post<{ Params: { id: string } }>('/repos/:id/commit', { preHandler }, async (req: any, reply) => {
    const { id } = req.params
    const userId = req.user.id
    if (!await checkRepoAccess(id, userId, 'WRITE')) return reply.status(403).send({ success: false, message: 'Forbidden' })
    const { message } = req.body as any
    if (!message || typeof message !== 'string' || message.trim().length === 0) return reply.status(400).send({ success: false, message: 'Commit message required' })
    const snapshot = await db.repoItem.findMany({ where: { repoId: id, isArchived: false } })
    const commit = await db.repoCommit.create({ data: { repoId: id, authorId: userId, message: message.trim().slice(0, 500), snapshot: snapshot as any } })
    return reply.status(201).send({ success: true, data: commit })
  })

  app.post<{ Params: { taskId: string } }>('/tasks/:taskId/save-to-repo', { preHandler }, async (req: any, reply) => {
    const { taskId } = req.params
    const userId = req.user.id
    const { repoId, title, category } = req.body as any
    const task = await db.task.findFirst({ where: { id: taskId, userId, status: 'COMPLETED' }, include: { subtasks: { include: { output: true } } } })
    if (!task) return reply.status(404).send({ success: false, message: 'Task not found or not completed' })
    if (!await checkRepoAccess(repoId, userId, 'WRITE')) return reply.status(403).send({ success: false, message: 'No write access' })
    const cat = VALID_CATEGORIES.includes(category) ? category : 'MIXED'
    const content = (task.subtasks as any[]).flatMap((st: any) => [(st.output as any)].filter(Boolean).map((o: any) => `## ${st.title}\n\n${o.content}`)).join('\n\n---\n\n')
    const item = await db.repoItem.create({ data: { repoId, authorId: userId, title: title ? String(title).slice(0, 200) : `Roundtable: ${((task as any).originalGoal ?? '').slice(0, 100)}`, category: cat, content, sourceTaskId: taskId, metadata: { taskGoal: (task as any).originalGoal } } })
    const snapshot = await db.repoItem.findMany({ where: { repoId, isArchived: false } })
    await db.repoCommit.create({ data: { repoId, authorId: userId, message: `Saved Roundtable output: ${((task as any).originalGoal ?? '').slice(0, 100)}`, itemsAdded: 1, snapshot: snapshot as any } })
    await db.sabhaRepo.update({ where: { id: repoId }, data: { updatedAt: new Date() } })
    return reply.status(201).send({ success: true, data: item })
  })
}
