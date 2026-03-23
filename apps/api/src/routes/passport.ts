import { FastifyInstance } from 'fastify'
import { prisma as db } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import { requireTermsAccepted } from '../middleware/terms'
import { checkAccountStatus } from '../middleware/account-status'

const preHandler = [requireAuth, checkAccountStatus, requireTermsAccepted]

export async function passportRoutes(app: FastifyInstance): Promise<void> {

  // GET /u/:username — public passport data
  app.get<{ Params: { username: string } }>('/u/:username', async (req, reply) => {
    const { username } = req.params
    const passport = await (db as any).sabhaPassport.findUnique({
      where: { username },
      include: {
        skills: { where: { isVisible: true }, orderBy: { evidenceCount: 'desc' } },
        achievements: { where: { isVisible: true }, orderBy: { awardedAt: 'asc' } },
        showcases: { orderBy: { order: 'asc' }, take: 3 }
      }
    })
    if (!passport) return reply.status(404).send({ success: false, message: 'Passport not found' })
    if (!passport.isPublic) return reply.status(404).send({ success: false, message: 'Passport not found' })

    // Record view (fire-and-forget)
    const ip = String((req as any).ip ?? 'unknown').slice(0, 45)
    const referrer = String(req.headers.referer ?? '').slice(0, 500)
    ;(db as any).passportView.create({ data: { passportId: passport.id, viewerIp: ip, referrer } }).catch(() => {})

    // Task count (anonymized)
    const taskCount = await db.task.count({ where: { userId: passport.userId, status: 'COMPLETED' } })
    const reposCount = await (db as any).sabhaRepo.count({ where: { ownerId: passport.userId, isArchived: false } })
    const friendsCount = await db.friendship.count({ where: { OR: [{ userAId: passport.userId }, { userBId: passport.userId }] } })

    // Get showcase tasks
    const showcaseTasks = await Promise.all(
      passport.showcases.map(async (s: any) => {
        const task = await db.task.findFirst({
          where: { id: s.taskId },
          select: { id: true, originalGoal: true, timeToCompleteMs: true, totalCostUsd: true, completedAt: true }
        })
        return task
      })
    )

    return reply.send({
      success: true,
      data: {
        ...passport,
        stats: { taskCount, reposCount, friendsCount }
      },
      showcaseTasks: showcaseTasks.filter(Boolean)
    })
  })

  // GET /passport/me
  app.get('/passport/me', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const passport = await (db as any).sabhaPassport.findUnique({
      where: { userId },
      include: { skills: true, achievements: true, showcases: true }
    })
    if (!passport) return reply.status(404).send({ success: false, message: 'No passport found. Please create one.' })
    return reply.send({ success: true, data: passport })
  })

  // POST /passport — create or ensure passport exists
  app.post('/passport', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const existing = await (db as any).sabhaPassport.findUnique({ where: { userId } })
    if (existing) return reply.send({ success: true, data: existing })
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    const { createPassportOnSignup } = await import('../jobs/skill-detector')
    await createPassportOnSignup(userId, user?.email ?? '', user?.name ?? undefined)
    const passport = await (db as any).sabhaPassport.findUnique({ where: { userId } })
    return reply.status(201).send({ success: true, data: passport })
  })

  // PATCH /passport — update profile fields
  app.patch('/passport', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const { displayName, title, bio, location, website, avatarUrl } = req.body as any
    const data: any = {}
    if (typeof displayName === 'string') data.displayName = displayName.slice(0, 100)
    if (typeof title === 'string') data.title = title.slice(0, 150)
    if (typeof bio === 'string') data.bio = bio.slice(0, 300)
    if (typeof location === 'string') data.location = location.slice(0, 100)
    if (typeof website === 'string') data.website = website.slice(0, 200)
    if (typeof avatarUrl === 'string') data.avatarUrl = avatarUrl
    const passport = await (db as any).sabhaPassport.update({ where: { userId }, data })
    return reply.send({ success: true, data: passport })
  })

  // PATCH /passport/privacy
  app.patch('/passport/privacy', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const { isPublic, showWatermark } = req.body as any
    const data: any = {}
    if (typeof isPublic === 'boolean') data.isPublic = isPublic
    if (typeof showWatermark === 'boolean') data.showWatermark = showWatermark
    const passport = await (db as any).sabhaPassport.update({ where: { userId }, data })
    return reply.send({ success: true, data: passport })
  })

  // PATCH /passport/skills/:skillId — toggle visibility
  app.patch<{ Params: { skillId: string } }>('/passport/skills/:skillId', { preHandler }, async (req: any, reply) => {
    const { skillId } = req.params
    const { isVisible } = req.body as any
    const userId = req.user.id
    const passport = await (db as any).sabhaPassport.findUnique({ where: { userId } })
    if (!passport) return reply.status(404).send({ success: false, message: 'No passport' })
    const skill = await (db as any).passportSkill.findFirst({ where: { id: skillId, passportId: passport.id } })
    if (!skill) return reply.status(404).send({ success: false, message: 'Skill not found' })
    const updated = await (db as any).passportSkill.update({ where: { id: skillId }, data: { isVisible } })
    return reply.send({ success: true, data: updated })
  })

  // POST /passport/showcase — pin a task
  app.post('/passport/showcase', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const { taskId, order } = req.body as any
    const passport = await (db as any).sabhaPassport.findUnique({ where: { userId } })
    if (!passport) return reply.status(404).send({ success: false, message: 'No passport' })
    const task = await db.task.findFirst({ where: { id: taskId, userId, status: 'COMPLETED' } })
    if (!task) return reply.status(400).send({ success: false, message: 'Task not found or not completed' })
    const count = await (db as any).passportShowcase.count({ where: { passportId: passport.id } })
    if (count >= 3) return reply.status(400).send({ success: false, message: 'Maximum 3 pinned showcases' })
    const showcase = await (db as any).passportShowcase.upsert({
      where: { passportId_taskId: { passportId: passport.id, taskId } },
      create: { passportId: passport.id, taskId, order: order ?? count },
      update: { order: order ?? count }
    })
    return reply.status(201).send({ success: true, data: showcase })
  })

  // DELETE /passport/showcase/:taskId
  app.delete<{ Params: { taskId: string } }>('/passport/showcase/:taskId', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const passport = await (db as any).sabhaPassport.findUnique({ where: { userId } })
    if (!passport) return reply.status(404).send({ success: false, message: 'No passport' })
    await (db as any).passportShowcase.deleteMany({ where: { passportId: passport.id, taskId: req.params.taskId } })
    return reply.send({ success: true })
  })

  // GET /u/:username/og-image — 1200×630 OG image for social sharing (public, no auth)
  app.get<{ Params: { username: string } }>('/u/:username/og-image', async (req, reply) => {
    const { username } = req.params
    const passport = await (db as any).sabhaPassport.findUnique({
      where: { username },
      include: {
        skills: { where: { isVisible: true }, orderBy: { evidenceCount: 'desc' }, take: 5 },
        achievements: { where: { isVisible: true }, orderBy: { awardedAt: 'asc' }, take: 3 }
      }
    })
    if (!passport || !passport.isPublic) {
      return reply.status(404).send({ success: false, message: 'Not found' })
    }

    const user = await db.user.findUnique({ where: { id: passport.userId }, select: { name: true } })
    const name = passport.displayName || user?.name || username
    const headline = (passport.title || passport.headline || 'Arivarangam User').slice(0, 60)
    const taskCount = await db.task.count({ where: { userId: passport.userId, status: 'COMPLETED' } })
    const reputationScore = passport.reputationScore ?? 0
    const topSkills = passport.skills.slice(0, 3).map((s: any) => s.skillName).join(' · ')
    const topAchievements = passport.achievements.slice(0, 3).map((a: any) => a.badgeIcon).join(' ')

    const avatar = passport.avatarUrl
      ? `<image href="${passport.avatarUrl}" x="60" y="60" width="100" height="100" clip-path="url(#avatarClip)" />`
      : `<rect x="60" y="60" width="100" height="100" rx="50" fill="#374151"/>
         <text x="110" y="125" text-anchor="middle" font-size="44" fill="white" font-family="Inter,Arial,sans-serif">${name[0]?.toUpperCase() ?? '?'}</text>`

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <clipPath id="avatarClip"><circle cx="110" cy="110" r="50"/></clipPath>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#111827"/>
      <stop offset="100%" style="stop-color:#1f2937"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="4" height="630" fill="#6366f1"/>

  <!-- Arivarangam wordmark -->
  <text x="1140" y="54" text-anchor="end" font-size="22" font-weight="700" fill="#6366f1" font-family="Inter,Arial,sans-serif">Arivarangam</text>

  <!-- Avatar -->
  ${avatar}

  <!-- Name + headline -->
  <text x="188" y="100" font-size="42" font-weight="700" fill="white" font-family="Inter,Arial,sans-serif">${name.slice(0, 32)}</text>
  <text x="188" y="140" font-size="22" fill="#9ca3af" font-family="Inter,Arial,sans-serif">@${username}</text>
  <text x="188" y="178" font-size="24" fill="#d1d5db" font-family="Inter,Arial,sans-serif">${headline}</text>

  <!-- Divider -->
  <line x1="60" y1="210" x2="1140" y2="210" stroke="#374151" stroke-width="1"/>

  <!-- Stats -->
  <text x="60" y="270" font-size="52" font-weight="700" fill="white" font-family="Inter,Arial,sans-serif">${taskCount}</text>
  <text x="60" y="305" font-size="18" fill="#6b7280" font-family="Inter,Arial,sans-serif">Tasks Completed</text>

  <text x="350" y="270" font-size="52" font-weight="700" fill="white" font-family="Inter,Arial,sans-serif">${reputationScore}</text>
  <text x="350" y="305" font-size="18" fill="#6b7280" font-family="Inter,Arial,sans-serif">Reputation Score</text>

  <!-- Skills -->
  <text x="60" y="370" font-size="16" fill="#6b7280" font-weight="600" font-family="Inter,Arial,sans-serif">TOP SKILLS</text>
  <text x="60" y="402" font-size="22" fill="#e5e7eb" font-family="Inter,Arial,sans-serif">${topSkills || 'Building skills…'}</text>

  <!-- Achievements -->
  ${topAchievements ? `<text x="60" y="460" font-size="16" fill="#6b7280" font-weight="600" font-family="Inter,Arial,sans-serif">ACHIEVEMENTS</text>
  <text x="60" y="500" font-size="36" font-family="Inter,Arial,sans-serif">${topAchievements}</text>` : ''}

  <!-- URL watermark -->
  <text x="60" y="590" font-size="20" fill="#4b5563" font-family="Inter,Arial,sans-serif">arivarangam.com/u/${username}</text>
  <text x="1140" y="590" text-anchor="end" font-size="18" fill="#4b5563" font-family="Inter,Arial,sans-serif">Digital Passport</text>
</svg>`

    reply.header('Content-Type', 'image/svg+xml')
    reply.header('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    return reply.send(svg)
  })

  // GET /passport/views — view analytics
  app.get('/passport/views', { preHandler }, async (req: any, reply) => {
    const userId = req.user.id
    const passport = await (db as any).sabhaPassport.findUnique({ where: { userId } })
    if (!passport) return reply.status(404).send({ success: false, message: 'No passport' })
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const views = await (db as any).passportView.count({
      where: { passportId: passport.id, createdAt: { gte: thirtyDaysAgo } }
    })
    return reply.send({ success: true, data: { views30d: views, passportUrl: `/u/${passport.username}` } })
  })
}
