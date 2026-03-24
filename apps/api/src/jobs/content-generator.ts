import { prisma as db } from '@arivarangam/db'
import { getConnector } from '../lib/social-connectors'

const WEEKLY_SCHEDULE: Record<number, Array<{ platform: string; type: string; time: string }>> = {
  1: [
    { platform: 'LINKEDIN', type: 'PROBLEM_POST', time: '08:00' },
    { platform: 'TWITTER', type: 'THREAD', time: '09:00' },
    { platform: 'INSTAGRAM', type: 'CAROUSEL', time: '18:00' },
  ],
  2: [
    { platform: 'YOUTUBE', type: 'DEMO_VIDEO', time: '10:00' },
    { platform: 'LINKEDIN', type: 'DEMO_VIDEO', time: '10:30' },
    { platform: 'TWITTER', type: 'PROBLEM_POST', time: '09:00' },
    { platform: 'INSTAGRAM', type: 'REEL_SCRIPT', time: '18:00' },
  ],
  3: [
    { platform: 'LINKEDIN', type: 'USER_RESULT', time: '08:00' },
    { platform: 'TWITTER', type: 'USER_RESULT', time: '09:00' },
    { platform: 'INSTAGRAM', type: 'CAROUSEL', time: '18:00' },
  ],
  4: [
    { platform: 'LINKEDIN', type: 'EDUCATIONAL', time: '08:00' },
    { platform: 'TWITTER', type: 'EDUCATIONAL', time: '09:00' },
    { platform: 'INSTAGRAM', type: 'CAROUSEL', time: '18:00' },
  ],
  5: [
    { platform: 'LINKEDIN', type: 'REGIONAL_TAMIL', time: '08:00' },
    { platform: 'INSTAGRAM', type: 'REGIONAL_TAMIL', time: '18:00' },
    { platform: 'WHATSAPP_BUSINESS', type: 'REGIONAL_TAMIL', time: '10:00' },
  ],
  6: [
    { platform: 'LINKEDIN', type: 'BEHIND_SCENES', time: '10:00' },
    { platform: 'TWITTER', type: 'BEHIND_SCENES', time: '10:00' },
    { platform: 'INSTAGRAM', type: 'REEL_SCRIPT', time: '18:00' },
  ],
  0: [
    { platform: 'LINKEDIN', type: 'WEEKLY_RECAP', time: '10:00' },
    { platform: 'TWITTER', type: 'WEEKLY_RECAP', time: '10:00' },
  ]
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
}

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

async function buildContext() {
  const weekAgo = subDays(new Date(), 7)
  const recentTasks = await db.task.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: weekAgo } },
    take: 5,
    orderBy: { completedAt: 'desc' },
    select: { originalGoal: true, totalCostUsd: true, timeToCompleteMs: true }
  })
  const totalUsersResult = await db.user.count()
  const weeklyTasksResult = await db.task.count({ where: { createdAt: { gte: weekAgo }, status: 'COMPLETED' } })
  return {
    stats: `${totalUsersResult} total users, ${weeklyTasksResult} tasks completed this week`,
    taskExamples: recentTasks.map(t => t.originalGoal?.slice(0, 100)).filter(Boolean).join('; '),
    recentBuilds: 'Working on Arivarangam social automation and digital passports',
    weeklyStats: `${weeklyTasksResult} tasks completed, ${totalUsersResult} total users`,
    upcoming: 'Digital passport public profiles, user self-marketing automation',
    userResult: recentTasks[0] ? `User completed: "${recentTasks[0].originalGoal}" in ${Math.round(((recentTasks[0].timeToCompleteMs as number) ?? 0) / 60000)} minutes` : 'User completed a multi-AI task'
  }
}

function buildPrompt(platform: string, contentType: string, trends: string, ctx: any): string {
  const SYSTEM_PROMPT = `You are writing marketing content for Arivarangam, an AI orchestration platform built in Tamil Nadu, India. Arivarangam lets users run Claude, GPT-4o, Gemini, and Perplexity together in a 3-round Roundtable. Users bring their own API keys. Price: ₹799/month. India-first. Warm, genuine, never salesy. Founder is Varun, solo builder from Coimbatore.`

  const PROMPTS: Record<string, Record<string, string>> = {
    LINKEDIN: {
      PROBLEM_POST: `Write a LinkedIn post about the frustration of switching between Claude, ChatGPT, and Gemini manually. Start with a one-line hook. Tell a real story. Do not mention Arivarangam until the last 2 lines. Under 250 words. Warm and genuine. Trending context: ${trends}. Arivarangam stats: ${ctx.stats}`,
      DEMO_VIDEO: `Write a LinkedIn post announcing a Arivarangam demo video. Show what happens: task run, AIs collaborated, time taken, output, cost in rupees. Under 200 words. End with [YOUTUBE_URL].`,
      USER_RESULT: `Write a LinkedIn post showcasing a real user result on Arivarangam. User data: ${ctx.userResult}. Make it genuine celebration. Under 200 words.`,
      EDUCATIONAL: `Write a LinkedIn post teaching one specific thing about using multiple AI models together. Pure value. Subtle Arivarangam mention only at the end. Under 300 words. Context: ${trends}`,
      REGIONAL_TAMIL: `Write a LinkedIn post in Tamil (Tamil script) about Arivarangam. Topic: how Tamil Nadu freelancers can use multiple AI tools. Mention Coimbatore, Chennai. Under 200 words.`,
      BEHIND_SCENES: `Write a personal LinkedIn post from Varun, solo founder of Arivarangam, about building Arivarangam this week. One real challenge faced. One thing learned. Genuine. No marketing. Context: ${ctx.recentBuilds}. Under 250 words.`,
      WEEKLY_RECAP: `Write a LinkedIn post recapping Arivarangam's week. Stats: ${ctx.weeklyStats}. Task examples: ${ctx.taskExamples}. Coming next: ${ctx.upcoming}. Celebratory but not boastful. Under 300 words.`,
      THREAD: `Write a LinkedIn article-style long post (500 words) about one insight about multi-AI collaboration for Indian professionals.`,
      CAROUSEL: `Write a LinkedIn carousel (5 slides) about using Arivarangam for faster work. Each slide: title + 2 sentences. Format: SLIDE 1: [title]\n[content]`,
      PRODUCT_UPDATE: `Write a LinkedIn product update post about Arivarangam's latest features. Professional but personal. Under 200 words.`,
    },
    TWITTER: {
      THREAD: `Write a Twitter thread (6-8 tweets) about the hidden power of using multiple AI models together. Each tweet under 280 chars. Start with a bold claim. End with a question. Separate tweets with ---`,
      PROBLEM_POST: `Write a single tweet (under 280 chars) about the pain of switching between AI tools. Relatable. End with a question.`,
      USER_RESULT: `Write a tweet celebrating a user's result with Arivarangam. Include: what they built, time saved. Under 280 chars.`,
      EDUCATIONAL: `Write an educational tweet about one AI productivity tip. Under 280 chars. No sales.`,
      BEHIND_SCENES: `Write a tweet from Varun about something he built or learned today working on Arivarangam. Personal. Under 280 chars.`,
      WEEKLY_RECAP: `Write a tweet recapping Arivarangam's week. Stats: ${ctx.weeklyStats}. Under 280 chars.`,
    },
    INSTAGRAM: {
      CAROUSEL: `Write Instagram carousel content (5 slides) for a professional/productivity topic. Format: SLIDE 1: [Hook title]\n[2-line description]. Visual and punchy.`,
      REEL_SCRIPT: `Write a 30-second Instagram Reel script about using Arivarangam. Scene descriptions + dialogue. End with a call to action.`,
      REGIONAL_TAMIL: `Write an Instagram caption in Tamil about Arivarangam for Tamil Nadu creators. Friendly and local. Include 10 relevant hashtags at the end.`,
    },
    YOUTUBE: {
      DEMO_VIDEO: `Write a YouTube video title, description (300 words), and 10 tags for a Arivarangam demo video showing how to run 3 AI models together on one task. Format:\nTITLE: ...\nDESCRIPTION: ...\nTAGS: ...`,
    },
    WHATSAPP_BUSINESS: {
      REGIONAL_TAMIL: `Write a WhatsApp Business message in Tamil about Arivarangam for small business owners in Tamil Nadu. Conversational, friendly, under 200 words. No emojis.`,
    },
  }

  const platformPrompts = PROMPTS[platform]
  if (!platformPrompts) return `Write a social media post about Arivarangam platform for ${platform}.`
  return `${SYSTEM_PROMPT}\n\n${platformPrompts[contentType] ?? `Write a ${contentType} post about Arivarangam for ${platform}.`}`
}

function getScheduledAt(targetDate: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const scheduled = new Date(targetDate)
  scheduled.setHours(hours, minutes as number, 0, 0)
  return scheduled
}

function generateHashtags(platform: string, contentType: string): string[] {
  const base = ['Arivarangam', 'AI', 'ArtificialIntelligence', 'India', 'ProductivityTools']
  const platformTags: Record<string, string[]> = {
    LINKEDIN: ['LinkedInIndia', 'StartupIndia', 'BuildInIndia', 'AIStartup'],
    TWITTER: ['AITools', 'TechIndia', 'IndieHacker'],
    INSTAGRAM: ['TechIndia', 'AICreator', 'MadeInIndia', 'StartupLife'],
  }
  const contentTags: Record<string, string[]> = {
    REGIONAL_TAMIL: ['TamilNadu', 'Chennai', 'Coimbatore', 'TamilTech'],
    EDUCATIONAL: ['LearnAI', 'AIEducation', 'TechLearning'],
    BEHIND_SCENES: ['BuildInPublic', 'SoloFounder', 'StartupLife'],
  }
  return [...base, ...(platformTags[platform] ?? []), ...(contentTags[contentType] ?? [])].slice(0, 10)
}

export async function runContentGeneration(): Promise<void> {
  console.log('[ContentGenerator] Starting nightly content generation...')

  // Get tomorrow's day of week (IST)
  const tomorrow = addDays(new Date(), 1)
  const dayOfWeek = tomorrow.getDay()
  const schedule = WEEKLY_SCHEDULE[dayOfWeek] ?? []

  if (schedule.length === 0) {
    console.log('[ContentGenerator] No content scheduled for tomorrow')
    return
  }

  const ctx = await buildContext()

  for (const item of schedule) {
    try {
      // Check if credential exists for this platform
      const credential = await (db as any).socialCredential.findFirst({
        where: { platform: item.platform, isActive: true }
      })
      if (!credential) {
        console.log(`[ContentGenerator] No credential for ${item.platform}, skipping`)
        continue
      }

      // Mark as generating
      const entry = await (db as any).contentCalendar.create({
        data: {
          date: tomorrow,
          platform: item.platform,
          contentType: item.type,
          title: `${item.type} — ${item.platform} — ${formatDate(tomorrow)}`,
          body: '',
          hashtags: [],
          scheduledAt: getScheduledAt(tomorrow, item.time),
          status: 'GENERATING'
        }
      })

      // Generate content using Claude
      const { Anthropic } = await import('@anthropic-ai/sdk')
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

      const prompt = buildPrompt(item.platform, item.type, 'AI productivity tools trending in India', ctx)

      const response = await anthropic.messages.create({
        model: process.env.CONTENT_GEN_MODEL ?? 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })

      const generatedText = response.content[0].type === 'text' ? response.content[0].text : ''
      const hashtags = generateHashtags(item.platform, item.type)

      await (db as any).contentCalendar.update({
        where: { id: entry.id },
        data: { body: generatedText, hashtags, status: 'PENDING_APPROVAL' }
      })

      console.log(`[ContentGenerator] Generated ${item.type} for ${item.platform}`)
    } catch (err) {
      console.error(`[ContentGenerator] Failed for ${item.platform}:${item.type}`, err)
    }
  }

  console.log('[ContentGenerator] Content generation complete')
}
