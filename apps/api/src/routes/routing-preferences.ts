/**
 * User Routing Preferences — per-category AI assignment customization.
 * Users can override which AI handles each task category.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/require-auth'
import { ROUTING_TABLE } from '../orchestration/task-decomposer'

const VALID_CATEGORIES = ['research','copywriting','strategy','images','video','audio','presentation','code','translation','data_analysis','general']

export async function routingPreferencesRoutes(app: FastifyInstance) {
  // GET /routing-preferences — get user's preferences + defaults
  app.get('/', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id

    const prefs = await prisma.userRoutingPreference.findMany({
      where: { userId },
      select: { taskCategory: true, preferredModel: true, priority: true },
    })

    const prefsMap = new Map(prefs.map((p) => [p.taskCategory, p.preferredModel]))

    // Merge user prefs with defaults
    const routing = VALID_CATEGORIES.map((cat) => ({
      category: cat,
      defaultModel: (ROUTING_TABLE as any)[cat] || 'claude-3-5-sonnet',
      userModel: prefsMap.get(cat) || null,
      effectiveModel: prefsMap.get(cat) || (ROUTING_TABLE as any)[cat] || 'claude-3-5-sonnet',
    }))

    return reply.send({ success: true, data: { routing } })
  })

  // PUT /routing-preferences — bulk update (drag & drop saves all at once)
  app.put<{ Body: { preferences: Array<{ category: string; model: string }> } }>(
    '/',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Body: { preferences: Array<{ category: string; model: string }> } }>, reply: FastifyReply) => {
      const { preferences } = request.body
      const userId = request.user!.id

      if (!Array.isArray(preferences)) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'preferences must be array' } })
      }

      // Upsert all preferences
      await Promise.all(
        preferences.map((pref, idx) => {
          if (!VALID_CATEGORIES.includes(pref.category)) return Promise.resolve()
          return prisma.userRoutingPreference.upsert({
            where: { userId_taskCategory: { userId, taskCategory: pref.category } },
            update: { preferredModel: pref.model, priority: idx },
            create: { userId, taskCategory: pref.category, preferredModel: pref.model, priority: idx },
          })
        })
      )

      return reply.send({ success: true })
    }
  )

  // DELETE /routing-preferences/:category — reset one category to default
  app.delete<{ Params: { category: string } }>(
    '/:category',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { category: string } }>, reply: FastifyReply) => {
      const { category } = request.params
      const userId = request.user!.id
      await prisma.userRoutingPreference.deleteMany({ where: { userId, taskCategory: category } })
      return reply.send({ success: true })
    }
  )

  // DELETE /routing-preferences — reset all to defaults
  app.delete('/', { preHandler: [requireAuth] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id
    await prisma.userRoutingPreference.deleteMany({ where: { userId } })
    return reply.send({ success: true })
  })
}
