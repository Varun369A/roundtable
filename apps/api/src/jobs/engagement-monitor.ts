import { prisma as db } from '@arivarangam/db'
import { getConnector } from '../lib/social-connectors'
import { Anthropic } from '@anthropic-ai/sdk'

function subHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000)
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

async function generateReply(content: string, authorHandle: string, originalPostBody: string | null): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `You are managing social media for Arivarangam, an AI orchestration platform.
Someone has commented or mentioned Arivarangam.

Original post context: ${originalPostBody ?? 'Direct mention'}
Their message: ${content}
Their handle: ${authorHandle}

Write a genuine, helpful reply under 100 words.
If they ask about Arivarangam: answer clearly and invite them to try free.
If they praise Arivarangam: thank them warmly and personally.
If they criticise Arivarangam: acknowledge honestly and offer to help.
If they ask a technical question: answer it helpfully.
Never be promotional. Always be human.`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }]
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export async function runEngagementMonitor(): Promise<void> {
  console.log('[EngagementMonitor] Checking engagement...')

  const credentials = await (db as any).socialCredential.findMany({ where: { isActive: true } })

  for (const credential of credentials) {
    try {
      const connector = getConnector(credential.platform, credential.accessToken)
      const recentPosts = await (db as any).contentCalendar.findMany({
        where: { platform: credential.platform, status: 'POSTED', postedAt: { gte: subDays(new Date(), 7) } }
      })

      for (const post of recentPosts) {
        if (!post.platformPostId) continue
        try {
          const comments = await connector.getComments(post.platformPostId)
          for (const comment of comments) {
            const existing = await (db as any).engagementItem.findFirst({
              where: { platformPostId: comment.id }
            })
            if (existing) continue
            const draftReply = await generateReply(comment.content, comment.authorHandle, post.body)
            await (db as any).engagementItem.create({
              data: {
                platform: credential.platform,
                platformPostId: comment.id,
                type: 'COMMENT',
                authorName: comment.authorName,
                authorHandle: comment.authorHandle,
                content: comment.content,
                draftReply,
                replyStatus: 'PENDING'
              }
            })
          }
        } catch (err) {
          console.error(`[EngagementMonitor] Error getting comments for post ${post.id}:`, err)
        }
      }

      try {
        const mentions = await connector.getMentions(subHours(new Date(), 2))
        for (const mention of mentions) {
          const existing = await (db as any).engagementItem.findFirst({ where: { platformPostId: mention.id } })
          if (existing) continue
          const draftReply = await generateReply(mention.content, mention.authorHandle, null)
          await (db as any).engagementItem.create({
            data: {
              platform: credential.platform,
              platformPostId: mention.id,
              type: 'MENTION',
              authorName: mention.authorName,
              authorHandle: mention.authorHandle,
              content: mention.content,
              draftReply,
              replyStatus: 'PENDING'
            }
          })
        }
      } catch (err) {
        console.error(`[EngagementMonitor] Error getting mentions for ${credential.platform}:`, err)
      }
    } catch (err) {
      console.error(`[EngagementMonitor] Error for platform ${credential.platform}:`, err)
    }
  }

  const pendingCount = await (db as any).engagementItem.count({ where: { replyStatus: 'PENDING' } })
  if (pendingCount > 0) {
    const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } })
    await Promise.all(admins.map((admin: { id: string }) =>
      db.notification.create({
        data: {
          userId: admin.id,
          type: 'SYSTEM' as any,
          title: `${pendingCount} new comments and mentions`,
          body: 'Tap to review and reply',
          link: '/admin/marketing/engagement'
        }
      })
    ))
  }

  console.log(`[EngagementMonitor] Done. Pending replies: ${pendingCount}`)
}
