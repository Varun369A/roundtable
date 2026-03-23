/**
 * Vertical AI Packs routes.
 *
 * Provides endpoints for listing, subscribing to, and managing Vertical AI Packs.
 * Also exports applyPackToTask() for use by the tasks route when creating tasks
 * with a ?packId query parameter.
 */

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import {
  getPacksForUser,
  subscribeUserToPack,
  unsubscribeUserFromPack,
  getPackContext,
} from '../lib/vertical-pack-manager'

// ─── applyPackToTask (helper for tasks route) ─────────────────────────────────

/**
 * Associates a pack with a task and increments the pack's usage counter.
 * Called by the tasks route when a task is created with a ?packId param.
 */
export async function applyPackToTask(taskId: string, packId: string): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: { verticalPackId: packId },
  })

  await prisma.verticalPack.update({
    where: { id: packId },
    data: { usageCount: { increment: 1 } },
  })
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function verticalPacksRoutes(app: FastifyInstance) {

  // ─── GET /api/v1/packs ────────────────────────────────────────────────────
  // List all ACTIVE packs with user's subscription/plan status (authenticated).
  // Returns public pack data if not authenticated (no subscription info).
  app.get('/packs', async (request, reply) => {
    // Attempt auth but don't require it — anonymous users see packs without subscription state
    let userId: string | null = null
    try {
      const payload = await request.jwtVerify<{ sub: string }>()
      userId = payload.sub
    } catch {
      // Not authenticated — public view
    }

    if (userId) {
      const packs = await getPacksForUser(userId)
      return reply.send({ success: true, data: { packs } })
    }

    // Unauthenticated: return basic pack info
    const packs = await prisma.verticalPack.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        category: true,
        icon: true,
        color: true,
        disclaimer: true,
        isIncludedInTier: true,
        creditsPerTask: true,
        usageCount: true,
      },
    })

    return reply.send({
      success: true,
      data: {
        packs: packs.map((p: any) => ({
          ...p,
          isSubscribed: false,
          isIncludedInPlan: false,
        })),
      },
    })
  })

  // ─── GET /api/v1/packs/:slug ──────────────────────────────────────────────
  // Full pack detail including agent configurations.
  app.get<{ Params: { slug: string } }>('/packs/:slug', async (request, reply) => {
    const { slug } = request.params

    const pack = await prisma.verticalPack.findUnique({
      where: { slug, status: 'ACTIVE' },
    })

    if (!pack) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Pack not found' },
      })
    }

    // Attempt auth to include subscription state
    let isSubscribed = false
    let isIncludedInPlan = false

    try {
      const payload = await request.jwtVerify<{ sub: string }>()
      const userId = payload.sub

      const [user, subscription] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { tier: true } }),
        prisma.userPackSubscription.findUnique({
          where: { userId_packId: { userId, packId: pack.id } },
          select: { isActive: true },
        }),
      ])

      isSubscribed = subscription?.isActive ?? false
      isIncludedInPlan = pack.isIncludedInTier.includes(user?.tier ?? 'FREE')
    } catch {
      // Not authenticated — return pack without subscription state
    }

    return reply.send({
      success: true,
      data: {
        pack: {
          id: pack.id,
          slug: pack.slug,
          name: pack.name,
          description: pack.description,
          category: pack.category,
          icon: pack.icon,
          color: pack.color,
          agents: pack.agents,
          contextBlob: pack.contextBlob,
          disclaimer: pack.disclaimer,
          isIncludedInTier: pack.isIncludedInTier,
          creditsPerTask: pack.creditsPerTask,
          usageCount: pack.usageCount,
          isSubscribed,
          isIncludedInPlan,
        },
      },
    })
  })

  // ─── POST /api/v1/packs/:slug/subscribe ───────────────────────────────────
  app.post<{ Params: { slug: string } }>(
    '/packs/:slug/subscribe',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { slug } = request.params
      const userId = request.user!.id

      const pack = await prisma.verticalPack.findUnique({
        where: { slug, status: 'ACTIVE' },
        select: { id: true, name: true },
      })

      if (!pack) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Pack not found' },
        })
      }

      await subscribeUserToPack(userId, pack.id)

      return reply.send({
        success: true,
        data: { message: `Subscribed to ${pack.name}` },
      })
    }
  )

  // ─── DELETE /api/v1/packs/:slug/subscribe ─────────────────────────────────
  app.delete<{ Params: { slug: string } }>(
    '/packs/:slug/subscribe',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { slug } = request.params
      const userId = request.user!.id

      const pack = await prisma.verticalPack.findUnique({
        where: { slug },
        select: { id: true, name: true },
      })

      if (!pack) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Pack not found' },
        })
      }

      await unsubscribeUserFromPack(userId, pack.id)

      return reply.send({
        success: true,
        data: { message: `Unsubscribed from ${pack.name}` },
      })
    }
  )
}
