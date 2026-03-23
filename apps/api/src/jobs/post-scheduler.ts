import { prisma as db } from '@sabha/db'
import { getConnector } from '../lib/social-connectors'

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

export async function runPostScheduler(): Promise<void> {
  console.log('[PostScheduler] Checking for posts to publish...')
  const now = new Date()
  const windowEnd = addMinutes(now, 5)

  const duePosts = await (db as any).contentCalendar.findMany({
    where: {
      status: { in: ['APPROVED', 'EDITED_AND_APPROVED'] },
      scheduledAt: { gte: now, lte: windowEnd }
    }
  })

  for (const post of duePosts) {
    try {
      await (db as any).contentCalendar.update({ where: { id: post.id }, data: { status: 'SCHEDULED' } })
      const credential = await (db as any).socialCredential.findFirst({ where: { platform: post.platform, isActive: true } })
      if (!credential) {
        console.error(`[PostScheduler] No credential for ${post.platform}`)
        await (db as any).contentCalendar.update({ where: { id: post.id }, data: { status: 'FAILED' } })
        continue
      }
      const connector = getConnector(post.platform, credential.accessToken)
      const hashtagText = post.hashtags?.length ? `\n\n${post.hashtags.map((h: string) => `#${h}`).join(' ')}` : ''
      const platformPostId = await connector.postText(`${post.body}${hashtagText}`)
      await (db as any).contentCalendar.update({
        where: { id: post.id },
        data: { status: 'POSTED', postedAt: new Date(), platformPostId }
      })
      console.log(`[PostScheduler] Posted ${post.platform} post ${platformPostId}`)
    } catch (err) {
      console.error(`[PostScheduler] Failed to post ${post.id}:`, err)
      await (db as any).contentCalendar.update({ where: { id: post.id }, data: { status: 'FAILED' } })
    }
  }
}
