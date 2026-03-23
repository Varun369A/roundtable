import { prisma as db } from '@arivarangam/db'

const SKILL_RULES = [
  { triggers: ['code', 'build', 'debug', 'api', 'function', 'component', 'database', 'backend', 'frontend', 'typescript', 'python', 'javascript'], skill: 'Software Development' },
  { triggers: ['write', 'blog', 'article', 'copy', 'caption', 'newsletter', 'content', 'essay', 'post'], skill: 'Content Creation' },
  { triggers: ['design', 'ui', 'ux', 'interface', 'prototype', 'wireframe', 'figma', 'visual'], skill: 'UI/UX Design' },
  { triggers: ['marketing', 'campaign', 'strategy', 'social media', 'brand', 'ads', 'advertisement', 'growth'], skill: 'Digital Marketing' },
  { triggers: ['research', 'analyse', 'analysis', 'report', 'study', 'findings', 'data', 'survey'], skill: 'Research and Analysis' },
  { triggers: ['tamil', 'தமிழ்'], skill: 'Tamil Content Creation' },
  { triggers: ['hindi', 'हिंदी'], skill: 'Hindi Content Creation' },
  { triggers: ['business plan', 'strategy', 'roadmap', 'pitch', 'startup', 'revenue', 'pricing'], skill: 'Business Strategy' },
  { triggers: ['video', 'youtube', 'reel', 'shorts', 'script'], skill: 'Video Content Creation' },
]

async function awardAchievement(passportId: string, achievement: string): Promise<void> {
  await (db as any).passportAchievement.upsert({
    where: { passportId_achievement: { passportId, achievement } },
    create: { passportId, achievement },
    update: {}
  })
}

async function checkAndAwardAchievements(userId: string, passportId: string): Promise<void> {
  const taskCount = await db.task.count({ where: { userId, status: 'COMPLETED' } })
  const thresholds = [
    { count: 1, achievement: 'FIRST_ROUNDTABLE' },
    { count: 10, achievement: 'TEN_ROUNDTABLES' },
    { count: 50, achievement: 'FIFTY_ROUNDTABLES' },
    { count: 100, achievement: 'HUNDRED_ROUNDTABLES' },
    { count: 500, achievement: 'FIVE_HUNDRED_ROUNDTABLES' },
  ]
  for (const t of thresholds) {
    if (taskCount >= t.count) await awardAchievement(passportId, t.achievement)
  }

  const skills = await (db as any).passportSkill.findMany({ where: { passportId }, select: { skill: true } })
  const skillSet = new Set(skills.map((s: any) => s.skill))

  if (skillSet.has('Tamil Content Creation') || skillSet.has('Hindi Content Creation')) {
    await awardAchievement(passportId, 'MULTILINGUAL_CREATOR')
  }
  if (['Software Development', 'UI/UX Design', 'Digital Marketing'].every(s => skillSet.has(s))) {
    await awardAchievement(passportId, 'FULL_STACK_BUILDER')
  }
  if (skillSet.has('Software Development')) await awardAchievement(passportId, 'CODE_BUILDER')
  if (skillSet.has('Content Creation')) await awardAchievement(passportId, 'CONTENT_CREATOR')
  if (skillSet.has('UI/UX Design')) await awardAchievement(passportId, 'DESIGN_THINKER')
  if (skillSet.has('Research and Analysis')) await awardAchievement(passportId, 'RESEARCH_ANALYST')

  const user = await db.user.findUnique({ where: { id: userId }, select: { foundingMember: true } })
  if (user?.foundingMember) await awardAchievement(passportId, 'FOUNDING_MEMBER')
}

export async function detectSkillsAndAwards(taskId: string, userId: string): Promise<void> {
  try {
    const task = await db.task.findUnique({ where: { id: taskId }, select: { originalGoal: true } })
    if (!task?.originalGoal) return

    const passport = await (db as any).sabhaPassport.findUnique({ where: { userId } })
    if (!passport) return

    const goalLower = task.originalGoal.toLowerCase()
    for (const rule of SKILL_RULES) {
      if (rule.triggers.some(t => goalLower.includes(t))) {
        await (db as any).passportSkill.upsert({
          where: { passportId_skill: { passportId: passport.id, skill: rule.skill } },
          update: { evidenceCount: { increment: 1 } },
          create: { passportId: passport.id, skill: rule.skill, evidenceCount: 1, autoDetected: true }
        })
      }
    }

    await checkAndAwardAchievements(userId, passport.id)
  } catch (err) {
    console.error('[SkillDetector] Error:', err)
  }
}

export async function createPassportOnSignup(userId: string, email: string, name?: string): Promise<void> {
  try {
    const base = (email.split('@')[0] ?? 'user').toLowerCase().replace(/[^a-z0-9]/g, '')
    let username = base.slice(0, 30)
    const existing = await (db as any).sabhaPassport.findFirst({ where: { username } })
    if (existing) username = `${username}${Date.now().toString(36).slice(-4)}`
    await (db as any).sabhaPassport.create({
      data: {
        userId,
        username,
        displayName: name ?? email.split('@')[0] ?? 'User',
        isPublic: true,
        showWatermark: true
      }
    })
    console.log(`[Passport] Created passport for user ${userId}: /u/${username}`)
  } catch (err) {
    console.error('[Passport] Failed to create passport:', err)
  }
}
