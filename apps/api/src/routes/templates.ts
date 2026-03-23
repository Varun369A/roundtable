import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import type { TemplateCategory, TemplateAgent } from '@arivarangam/types'

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'development', 'design', 'learning', 'marketing',
  'business', 'content', 'research', 'personal',
]

const createTemplateSchema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().min(10).max(300),
  category: z.enum(['development', 'design', 'learning', 'marketing', 'business', 'content', 'research', 'personal']),
  subcategory: z.string().max(50).optional(),
  icon: z.string().max(8).default('🤖'),
  color: z.string().max(20).default('indigo'),
  agents: z.array(z.object({
    model: z.string(),
    role: z.string().max(50),
    instruction: z.string().max(1000),
    category: z.string(),
    dependsOnPrevious: z.boolean().default(false),
    optional: z.boolean().default(false),
  })).min(1).max(10),
  examplePrompts: z.array(z.string().max(200)).max(5).default([]),
  tags: z.array(z.string().max(30)).max(10).default([]),
  isPublic: z.boolean().default(false),
})

export async function templateRoutes(app: FastifyInstance) {

  // ─── GET / — list all templates ─────────────────────────────────────────────
  app.get<{
    Querystring: {
      category?: string
      subcategory?: string
      search?: string
      page?: string
      limit?: string
    }
  }>('/', async (request, reply) => {
    const { category, subcategory, search, page = '1', limit = '20' } = request.query
    const take = Math.min(parseInt(limit, 10) || 20, 50)
    const skip = (parseInt(page, 10) - 1) * take

    const where: Record<string, unknown> = {
      OR: [
        { isBuiltIn: true },
        { isPublic: true },
      ],
    }

    if (category && TEMPLATE_CATEGORIES.includes(category as TemplateCategory)) {
      where.category = category
    }
    if (subcategory) {
      where.subcategory = subcategory
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ]
    }

    const [templates, total] = await Promise.all([
      prisma.roundtableTemplate.findMany({
        where,
        orderBy: [{ isBuiltIn: 'desc' }, { useCount: 'desc' }],
        take,
        skip,
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          subcategory: true,
          icon: true,
          color: true,
          tags: true,
          examplePrompts: true,
          useCount: true,
          isBuiltIn: true,
          agents: true,
        },
      }),
      prisma.roundtableTemplate.count({ where }),
    ])

    return reply.send({
      success: true,
      data: templates,
      meta: { page: parseInt(page, 10), limit: take, total },
    })
  })

  // ─── GET /categories — category summary with counts ─────────────────────────
  app.get('/categories', async (_request, reply) => {
    const counts = await prisma.roundtableTemplate.groupBy({
      by: ['category'],
      _count: { _all: true },
      where: { OR: [{ isBuiltIn: true }, { isPublic: true }] },
      orderBy: { category: 'asc' },
    })

    const CATEGORY_META: Record<TemplateCategory, { label: string; icon: string; description: string }> = {
      development: { label: 'Development', icon: '💻', description: 'Web apps, mobile apps, APIs, and dev tools' },
      design:      { label: 'Design', icon: '🎨', description: 'Brand identity, UI/UX, and visual content' },
      learning:    { label: 'Learning', icon: '🎓', description: 'Courses, study plans, and exam preparation' },
      marketing:   { label: 'Marketing', icon: '📣', description: 'Product launches, content, and campaigns' },
      business:    { label: 'Business', icon: '💼', description: 'Business plans, competitive analysis, strategy' },
      content:     { label: 'Content', icon: '✍️', description: 'YouTube, podcasts, blogs, and social media' },
      research:    { label: 'Research', icon: '📊', description: 'Market research and technical papers' },
      personal:    { label: 'Personal', icon: '🌱', description: 'Career growth and personal development' },
    }

    const categories = TEMPLATE_CATEGORIES.map((cat) => ({
      id: cat,
      ...CATEGORY_META[cat],
      templateCount: counts.find((c) => c.category === cat)?._count._all || 0,
    }))

    return reply.send({ success: true, data: categories })
  })

  // ─── GET /:id — single template ─────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const template = await prisma.roundtableTemplate.findUnique({
      where: { id: request.params.id },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { tasks: true } },
      },
    })

    if (!template || (!template.isBuiltIn && !template.isPublic)) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      })
    }

    return reply.send({
      success: true,
      data: { ...template, usageCount: template._count.tasks },
    })
  })

  // ─── POST / — create custom template (Pro+) ─────────────────────────────────
  app.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user!

    // Only Pro+ can create custom templates
    if (!['PRO', 'POWER', 'ENTERPRISE'].includes(user.tier)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'PLAN_LIMIT',
          message: 'Creating custom templates requires Pro plan or higher',
          details: { upgradeUrl: '/pricing' },
        },
      })
    }

    const body = createTemplateSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const template = await prisma.roundtableTemplate.create({
      data: {
        ...body.data,
        agents: body.data.agents as object,
        isBuiltIn: false,
        createdById: user.id,
      },
    })

    return reply.status(201).send({ success: true, data: template })
  })

  // ─── PATCH /:id — update custom template ────────────────────────────────────
  app.patch<{ Params: { id: string } }>('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const template = await prisma.roundtableTemplate.findUnique({ where: { id: request.params.id } })

    if (!template || template.isBuiltIn) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot edit built-in templates' },
      })
    }

    if (template.createdById !== request.user!.id) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only edit your own templates' },
      })
    }

    const body = createTemplateSchema.partial().safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const { agents, ...rest } = body.data
    const updated = await prisma.roundtableTemplate.update({
      where: { id: request.params.id },
      data: {
        ...rest,
        ...(agents ? { agents: agents as object } : {}),
      },
    })

    return reply.send({ success: true, data: updated })
  })

  // ─── DELETE /:id — delete custom template ───────────────────────────────────
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const template = await prisma.roundtableTemplate.findUnique({ where: { id: request.params.id } })

    if (!template || template.isBuiltIn) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot delete built-in templates' },
      })
    }

    if (template.createdById !== request.user!.id) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only delete your own templates' },
      })
    }

    await prisma.roundtableTemplate.delete({ where: { id: request.params.id } })
    return reply.send({ success: true, data: { deleted: true } })
  })

  // ─── POST /:id/use — increment use count ────────────────────────────────────
  app.post<{ Params: { id: string } }>('/:id/use', async (request, reply) => {
    await prisma.roundtableTemplate.update({
      where: { id: request.params.id },
      data: { useCount: { increment: 1 } },
    })
    return reply.send({ success: true })
  })

  // ─── GET /user/mine — user's custom templates ────────────────────────────────
  app.get('/user/mine', { preHandler: [requireAuth] }, async (request, reply) => {
    const templates = await prisma.roundtableTemplate.findMany({
      where: { createdById: request.user!.id, isBuiltIn: false },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ success: true, data: templates })
  })
}
