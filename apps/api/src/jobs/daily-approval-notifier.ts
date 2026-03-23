import { prisma as db } from '@arivarangam/db'

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

export async function runDailyApprovalNotifier(): Promise<void> {
  console.log('[ApprovalNotifier] Sending daily approval notifications...')

  const todayContent = await (db as any).contentCalendar.findMany({
    where: {
      date: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) },
      status: 'PENDING_APPROVAL'
    },
    orderBy: { scheduledAt: 'asc' }
  })

  if (todayContent.length === 0) {
    console.log('[ApprovalNotifier] No pending content for today')
    return
  }

  // Create in-app notification for all admins
  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } })
  await Promise.all(admins.map((admin: { id: string }) =>
    db.notification.create({
      data: {
        userId: admin.id,
        type: 'SYSTEM' as any,
        title: `${todayContent.length} posts ready for today`,
        body: `Arivarangam's daily content is ready for review. Tap to approve.`,
        link: '/admin/marketing/today'
      }
    })
  ))

  console.log(`[ApprovalNotifier] Notified ${admins.length} admins about ${todayContent.length} posts`)
}
