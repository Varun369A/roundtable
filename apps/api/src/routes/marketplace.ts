import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { connectorRegistry } from '../connectors/registry'
import { PLANS } from '@sabha/types'
import type { AIModel, PlanId } from '@sabha/types'
import {
  createReviewRequest,
  claimReview,
  submitReview,
  acceptReview,
  getExpertLeaderboard,
  applyForExpert,
} from '../lib/expert-marketplace'
import { createNotification } from '../lib/notifications'

// ─── Full marketplace model data ──────────────────────────────────────────────
// (Model metadata unchanged from original implementation)

const MODEL_METADATA: Record<string, {
  displayName: string
  provider: string
  description: string
  longDescription: string
  capabilities: string[]
  categories: string[]
  inputCostPer1M: number
  outputCostPer1M: number
  availableOnPlans: PlanId[]
  externalUrl: string
  logoColor: string
  useCases: string[]
  limitations: string[]
}> = {
  'claude-3-5-sonnet': {
    displayName: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Best overall AI for writing, reasoning, and code. Preferred by professionals.',
    longDescription: 'Claude 3.5 Sonnet is Anthropic\'s flagship model, excelling at nuanced writing, complex reasoning, coding, and analysis. It has a 200K token context window and produces longer, more thorough outputs than competing models at the same speed tier.',
    capabilities: ['text', 'reasoning', 'code', 'vision', 'analysis', 'long-form'],
    categories: ['copywriting', 'strategy', 'code', 'data_analysis', 'general'],
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    availableOnPlans: ['free', 'starter', 'pro', 'power', 'enterprise'],
    externalUrl: 'https://claude.ai',
    logoColor: '#F97316',
    useCases: ['Marketing copy', 'Business strategy', 'Code generation', 'Research synthesis', 'Email drafting'],
    limitations: ['No real-time data', 'No image generation'],
  },
  'claude-3-opus': {
    displayName: 'Claude 3 Opus',
    provider: 'Anthropic',
    description: 'Maximum intelligence for the most complex tasks.',
    longDescription: 'Claude 3 Opus is Anthropic\'s most powerful model for highly complex tasks requiring deep reasoning, nuanced understanding, and expert-level output. Use it when quality matters more than speed.',
    capabilities: ['text', 'reasoning', 'code', 'vision', 'analysis', 'complex-tasks'],
    categories: ['strategy', 'code', 'data_analysis', 'general'],
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
    availableOnPlans: ['pro', 'power', 'enterprise'],
    externalUrl: 'https://claude.ai',
    logoColor: '#F97316',
    useCases: ['Complex business analysis', 'Advanced code review', 'Research papers', 'Legal document review'],
    limitations: ['Slower than Sonnet', 'Higher cost'],
  },
  'gpt-4o': {
    displayName: 'GPT-4o',
    provider: 'OpenAI',
    description: 'OpenAI\'s multimodal flagship. Excellent with structured tasks and vision.',
    longDescription: 'GPT-4o is OpenAI\'s omni model combining text, vision, and audio capabilities. Its strength is structured output, JSON generation, and tasks requiring precise formatting.',
    capabilities: ['text', 'vision', 'structured-output', 'reasoning', 'code'],
    categories: ['data_analysis', 'strategy', 'code', 'general'],
    inputCostPer1M: 5.0,
    outputCostPer1M: 15.0,
    availableOnPlans: ['free', 'starter', 'pro', 'power', 'enterprise'],
    externalUrl: 'https://openai.com',
    logoColor: '#22C55E',
    useCases: ['Data analysis', 'Structured reports', 'Code generation', 'Image analysis', 'Strategy docs'],
    limitations: ['Training data cutoff'],
  },
  'gpt-4-turbo': {
    displayName: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'GPT-4 with a 128K context window. Handles very long documents.',
    longDescription: 'GPT-4 Turbo offers a 128K context window, making it ideal for processing long documents, entire codebases, or lengthy research papers in a single request.',
    capabilities: ['text', 'vision', 'long-context', 'reasoning'],
    categories: ['data_analysis', 'research', 'general'],
    inputCostPer1M: 10.0,
    outputCostPer1M: 30.0,
    availableOnPlans: ['pro', 'power', 'enterprise'],
    externalUrl: 'https://openai.com',
    logoColor: '#22C55E',
    useCases: ['Long document analysis', 'Full codebase review', 'Comprehensive research'],
    limitations: ['Higher cost than GPT-4o'],
  },
  'perplexity-sonar': {
    displayName: 'Perplexity Sonar',
    provider: 'Perplexity AI',
    description: 'Real-time web search AI. Always current. Cites sources.',
    longDescription: 'Perplexity Sonar searches the web in real time and synthesizes current information with citations. The only AI in Sabha that has access to today\'s data — critical for market research, news analysis, and fact-checking.',
    capabilities: ['search', 'real-time', 'citations', 'research'],
    categories: ['research'],
    inputCostPer1M: 1.0,
    outputCostPer1M: 1.0,
    availableOnPlans: ['starter', 'pro', 'power', 'enterprise'],
    externalUrl: 'https://perplexity.ai',
    logoColor: '#06B6D4',
    useCases: ['Market research', 'Competitor analysis', 'Current events', 'Fact-checking', 'Industry trends'],
    limitations: ['Text only', 'Slower due to live search'],
  },
  'gemini-pro': {
    displayName: 'Gemini 1.5 Pro',
    provider: 'Google',
    description: 'Google\'s flagship multimodal model with 1M token context.',
    longDescription: 'Gemini 1.5 Pro offers a 1 million token context window — the largest available. Process entire books, large codebases, or hours of video content in a single request.',
    capabilities: ['text', 'vision', 'audio', 'million-token-context', 'multimodal'],
    categories: ['data_analysis', 'research', 'general'],
    inputCostPer1M: 3.5,
    outputCostPer1M: 10.5,
    availableOnPlans: ['pro', 'power', 'enterprise'],
    externalUrl: 'https://gemini.google.com',
    logoColor: '#3B82F6',
    useCases: ['Large document analysis', 'Video understanding', 'Multimodal tasks'],
    limitations: ['Occasional verbosity'],
  },
  'dalle-3': {
    displayName: 'DALL-E 3',
    provider: 'OpenAI',
    description: 'Photorealistic image generation from text. Understands complex prompts.',
    longDescription: 'DALL-E 3 is OpenAI\'s image generation model with the best prompt adherence of any image AI. It reliably renders text in images, handles complex multi-subject compositions, and produces commercially usable outputs.',
    capabilities: ['image-generation', 'text-rendering', 'photorealism'],
    categories: ['images'],
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    availableOnPlans: ['starter', 'pro', 'power', 'enterprise'],
    externalUrl: 'https://openai.com/dall-e-3',
    logoColor: '#EC4899',
    useCases: ['Marketing visuals', 'Product mockups', 'Social media content', 'Illustrations'],
    limitations: ['Fixed sizes', 'No editing existing images'],
  },
  'midjourney-v6': {
    displayName: 'Midjourney v6',
    provider: 'Midjourney',
    description: 'The gold standard for artistic image generation.',
    longDescription: 'Midjourney v6 produces the most aesthetically refined AI images — preferred by designers, artists, and brands. Its stylistic coherence and artistic quality surpass all competitors for creative work.',
    capabilities: ['image-generation', 'artistic', 'aesthetic', 'high-quality'],
    categories: ['images'],
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    availableOnPlans: ['pro', 'power', 'enterprise'],
    externalUrl: 'https://midjourney.com',
    logoColor: '#A855F7',
    useCases: ['Brand visuals', 'Concept art', 'Campaign imagery', 'Product photography'],
    limitations: ['Proxy API required', 'Slower than DALL-E'],
  },
  'stability-xl': {
    displayName: 'Stable Diffusion XL',
    provider: 'Stability AI',
    description: 'Open-source image generation. Unlimited customisation.',
    longDescription: 'Stable Diffusion XL offers the most flexibility of any image model — fine-tunable, open-source, and optimised for specific styles. Great for consistent brand imagery.',
    capabilities: ['image-generation', 'fine-tuning', 'style-control'],
    categories: ['images'],
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    availableOnPlans: ['pro', 'power', 'enterprise'],
    externalUrl: 'https://stability.ai',
    logoColor: '#8B5CF6',
    useCases: ['Consistent brand style', 'Product visualisation', 'Background generation'],
    limitations: ['Requires fine-tuning for best results'],
  },
  'elevenlabs': {
    displayName: 'ElevenLabs',
    provider: 'ElevenLabs',
    description: 'Ultra-realistic AI voice. 9 voices. Voice cloning available.',
    longDescription: 'ElevenLabs produces the most natural AI voices available. Support for 9 built-in voices, 29 languages, and custom voice cloning from a 1-minute sample. Essential for ads, podcasts, and narration.',
    capabilities: ['text-to-speech', 'voice-cloning', 'multilingual', 'emotion-control'],
    categories: ['audio'],
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    availableOnPlans: ['starter', 'pro', 'power', 'enterprise'],
    externalUrl: 'https://elevenlabs.io',
    logoColor: '#EAB308',
    useCases: ['Ad voiceovers', 'Podcast narration', 'E-learning content', 'Product demos'],
    limitations: ['Audio only', 'Character-based pricing'],
  },
  'runway-gen3': {
    displayName: 'Runway Gen-3',
    provider: 'Runway',
    description: 'Text-to-video and image-to-video generation.',
    longDescription: 'Runway Gen-3 Alpha Turbo is the leading text-to-video model for commercial use. Generate 5-second HD video clips from text prompts or existing images. Used by major studios and agencies.',
    capabilities: ['video-generation', 'text-to-video', 'image-to-video'],
    categories: ['video'],
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    availableOnPlans: ['power', 'enterprise'],
    externalUrl: 'https://runwayml.com',
    logoColor: '#F43F5E',
    useCases: ['Video ads', 'Social content', 'Product visualisation', 'Film concepts'],
    limitations: ['5-second clips', 'Async generation (~2min)'],
  },
  'sarvam-1': {
    displayName: 'Sarvam AI',
    provider: 'Sarvam AI',
    description: 'India\'s AI. 10 Indian languages. Built for Bharat.',
    longDescription: 'Sarvam is India\'s leading multilingual AI — built specifically for Indian languages and cultural context. Supports Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, and Odia. Essential for content targeting Indian audiences.',
    capabilities: ['translation', 'indian-languages', 'tts', 'speech-recognition'],
    categories: ['translation'],
    inputCostPer1M: 0.5,
    outputCostPer1M: 0.5,
    availableOnPlans: ['starter', 'pro', 'power', 'enterprise'],
    externalUrl: 'https://sarvam.ai',
    logoColor: '#6366F1',
    useCases: ['Hindi content', 'Tamil/Telugu campaigns', 'Regional product launches', 'Bharat-first marketing'],
    limitations: ['Indian languages only'],
  },
  'gamma': {
    displayName: 'Gamma',
    provider: 'Gamma',
    description: 'AI-powered presentations and docs. Beautiful by default.',
    longDescription: 'Gamma generates polished presentation decks from text outlines. Handles design, layout, and formatting automatically — producing decks that look like they were made by a professional designer.',
    capabilities: ['presentation', 'design', 'document-creation'],
    categories: ['presentation'],
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    availableOnPlans: ['pro', 'power', 'enterprise'],
    externalUrl: 'https://gamma.app',
    logoColor: '#14B8A6',
    useCases: ['Investor decks', 'Client proposals', 'Team updates', 'Product roadmaps'],
    limitations: ['Presentation format only'],
  },
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const applyForExpertSchema = z.object({
  bio: z.string().min(50).max(2000),
  specializations: z.array(z.string().min(1)).min(1).max(10),
  languages: z.array(z.string().min(2).max(10)).min(1),
  credentialsUrl: z.string().url().optional(),
  ratePerReview: z.number().int().min(10).max(500).optional(),
})

const updateExpertProfileSchema = z.object({
  bio: z.string().min(50).max(2000).optional(),
  isAvailable: z.boolean().optional(),
  ratePerReview: z.number().int().min(10).max(500).optional(),
})

const requestExpertReviewSchema = z.object({
  specialization: z.string().min(1),
  description: z.string().max(1000).optional(),
})

const submitReviewSchema = z.object({
  feedback: z.string().min(50).max(10000),
})

const acceptReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
})

const disputeReviewSchema = z.object({
  reason: z.string().min(20).max(2000),
})

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function marketplaceRoutes(app: FastifyInstance) {

  // ─── AI Model marketplace (public) ────────────────────────────────────────

  // GET /api/v1/marketplace/models
  app.get('/models', async (request, reply) => {
    const query = (request.query as { category?: string; plan?: string; search?: string })
    const availableModels = await connectorRegistry.getAvailableModels()
    const availableSet = new Set(availableModels)

    let models = Object.entries(MODEL_METADATA).map(([modelKey, meta]) => ({
      model: modelKey,
      ...meta,
      isAvailable: availableSet.has(modelKey as AIModel),
    }))

    if (query.category) {
      models = models.filter((m) => m.categories.includes(query.category!))
    }
    if (query.plan) {
      models = models.filter((m) => m.availableOnPlans.includes(query.plan as PlanId))
    }
    if (query.search) {
      const term = query.search.toLowerCase()
      models = models.filter((m) =>
        m.displayName.toLowerCase().includes(term) ||
        m.description.toLowerCase().includes(term) ||
        m.capabilities.some((c) => c.includes(term))
      )
    }

    return reply.send({
      success: true,
      data: { models, total: models.length, available: models.filter((m) => m.isAvailable).length },
    })
  })

  // GET /api/v1/marketplace/models/:model
  app.get<{ Params: { model: string } }>('/models/:model', async (request, reply) => {
    const { model } = request.params
    const meta = MODEL_METADATA[model]

    if (!meta) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'AI model not found' },
      })
    }

    const availableModels = await connectorRegistry.getAvailableModels()
    const isAvailable = availableModels.includes(model as AIModel)

    const dbConnector = await prisma.aIConnector.findUnique({
      where: { model: model as AIModel },
      select: { avgLatencyMs: true, successRate: true },
    }).catch(() => null)

    return reply.send({
      success: true,
      data: {
        model,
        ...meta,
        isAvailable,
        stats: dbConnector || { avgLatencyMs: 0, successRate: 1 },
        planAccess: Object.entries(PLANS).map(([planId, plan]) => ({
          planId,
          planName: plan.name,
          hasAccess: meta.availableOnPlans.includes(planId as PlanId),
        })),
      },
    })
  })

  // GET /api/v1/marketplace/categories
  app.get('/categories', async (_request, reply) => {
    const categories = [
      { id: 'research',      label: 'Research',      emoji: '🔍', description: 'Real-time web search and information gathering' },
      { id: 'copywriting',   label: 'Writing',        emoji: '✍️',  description: 'Content, copy, articles, scripts' },
      { id: 'strategy',      label: 'Strategy',       emoji: '🎯', description: 'Planning, frameworks, roadmaps' },
      { id: 'images',        label: 'Images',         emoji: '🎨', description: 'Generate visuals, logos, illustrations' },
      { id: 'video',         label: 'Video',          emoji: '🎬', description: 'Text-to-video generation' },
      { id: 'audio',         label: 'Audio',          emoji: '🎵', description: 'Voiceover, TTS, transcription' },
      { id: 'presentation',  label: 'Presentations',  emoji: '📊', description: 'Decks, slides, reports' },
      { id: 'code',          label: 'Code',           emoji: '💻', description: 'Development, automation, scripts' },
      { id: 'translation',   label: 'Translation',    emoji: '🌐', description: 'Language conversion and localisation' },
      { id: 'data_analysis', label: 'Data Analysis',  emoji: '📈', description: 'Insights, charts, statistics' },
    ]
    return reply.send({ success: true, data: { categories } })
  })

  // GET /api/v1/marketplace/stats
  app.get('/stats', async (_request, reply) => {
    const totalModels = Object.keys(MODEL_METADATA).length
    const availableModels = await connectorRegistry.getAvailableModels()

    const retailCost = [
      { name: 'ChatGPT Plus',       priceInr: 1672 },
      { name: 'Claude Pro',         priceInr: 1672 },
      { name: 'Midjourney',         priceInr: 838  },
      { name: 'ElevenLabs Starter', priceInr: 1672 },
      { name: 'Perplexity Pro',     priceInr: 1672 },
    ]

    const totalRetailInr = retailCost.reduce((sum, s) => sum + s.priceInr, 0)

    return reply.send({
      success: true,
      data: {
        totalModels,
        availableModels: availableModels.length,
        sabhaProPriceInr: 1299,
        retailTotalInr: totalRetailInr,
        savingsInr: totalRetailInr - 1299,
        savingsPercent: Math.round(((totalRetailInr - 1299) / totalRetailInr) * 100),
        breakdown: retailCost,
      },
    })
  })

  // ─── Expert profiles (public browse) ──────────────────────────────────────

  // GET /api/v1/marketplace/experts
  // ?specialization=legal&sort=rating|reviews
  app.get('/experts', async (request, reply) => {
    const query = request.query as { specialization?: string; sort?: string; page?: string }
    const page = Math.max(1, parseInt(query.page ?? '1', 10))
    const pageSize = 20

    const where: Record<string, unknown> = { status: 'ACTIVE' }
    if (query.specialization) {
      where.specializations = { has: query.specialization }
    }

    const orderBy: Record<string, string>[] =
      query.sort === 'reviews'
        ? [{ reviewCount: 'desc' }]
        : [{ avgRating: 'desc' }, { reviewCount: 'desc' }]

    const [experts, total] = await Promise.all([
      prisma.expertProfile.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          specializations: true,
          avgRating: true,
          reviewCount: true,
          ratePerReview: true,
          isAvailable: true,
          user: { select: { name: true, avatarUrl: true } },
        },
      }),
      prisma.expertProfile.count({ where }),
    ])

    return reply.send({
      success: true,
      data: {
        experts: experts.map((e) => ({
          id: e.id,
          displayName: e.user.name,
          avatarUrl: e.user.avatarUrl,
          specializations: e.specializations,
          avgRating: e.avgRating,
          reviewCount: e.reviewCount,
          ratePerReview: e.ratePerReview,
          isAvailable: e.isAvailable,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  })

  // GET /api/v1/marketplace/experts/leaderboard
  app.get('/experts/leaderboard', async (request, reply) => {
    const query = request.query as { specialization?: string }
    const leaderboard = await getExpertLeaderboard(query.specialization)
    return reply.send({ success: true, data: { experts: leaderboard } })
  })

  // ─── Expert profile management (authenticated) ────────────────────────────

  // POST /api/v1/marketplace/experts/apply
  app.post(
    '/experts/apply',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = applyForExpertSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        })
      }

      const userId = request.user!.id
      const { bio, specializations, languages, credentialsUrl, ratePerReview } = body.data

      try {
        const profileId = await applyForExpert(
          userId,
          bio,
          specializations,
          languages,
          credentialsUrl,
          ratePerReview
        )
        return reply.status(201).send({
          success: true,
          data: {
            profileId,
            message: 'Application submitted. You will be notified once reviewed by our team (typically within 48 hours).',
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit application'
        return reply.status(400).send({
          success: false,
          error: { code: 'APPLICATION_ERROR', message },
        })
      }
    }
  )

  // GET /api/v1/marketplace/experts/me
  app.get(
    '/experts/me',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.user!.id

      const profile = await prisma.expertProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          bio: true,
          specializations: true,
          languages: true,
          credentialsUrl: true,
          ratePerReview: true,
          avgRating: true,
          reviewCount: true,
          status: true,
          isAvailable: true,
          approvedAt: true,
          createdAt: true,
        },
      })

      if (!profile) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'You do not have an expert profile' },
        })
      }

      return reply.send({ success: true, data: { profile } })
    }
  )

  // PATCH /api/v1/marketplace/experts/me
  app.patch(
    '/experts/me',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = updateExpertProfileSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        })
      }

      const userId = request.user!.id
      const existing = await prisma.expertProfile.findUnique({
        where: { userId },
        select: { id: true, status: true },
      })

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'You do not have an expert profile' },
        })
      }

      const updated = await prisma.expertProfile.update({
        where: { userId },
        data: body.data,
        select: {
          id: true,
          bio: true,
          isAvailable: true,
          ratePerReview: true,
          updatedAt: true,
        },
      })

      return reply.send({ success: true, data: { profile: updated } })
    }
  )

  // ─── Expert inbox (authenticated expert) ──────────────────────────────────

  // GET /api/v1/marketplace/inbox
  app.get(
    '/inbox',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.user!.id

      const expertProfile = await prisma.expertProfile.findUnique({
        where: { userId },
        select: { id: true },
      })

      if (!expertProfile) {
        return reply.status(403).send({
          success: false,
          error: { code: 'NOT_AN_EXPERT', message: 'You do not have an expert profile' },
        })
      }

      const reviews = await prisma.expertReview.findMany({
        where: {
          expertId: expertProfile.id,
          status: { in: ['OPEN', 'IN_REVIEW'] },
        },
        orderBy: { expiresAt: 'asc' },
        select: {
          id: true,
          status: true,
          specialization: true,
          description: true,
          creditsEscrowed: true,
          claimedAt: true,
          expiresAt: true,
          task: { select: { id: true, title: true, originalGoal: true } },
        },
      })

      return reply.send({ success: true, data: { reviews } })
    }
  )

  // ─── Review actions (expert side) ─────────────────────────────────────────

  // POST /api/v1/marketplace/reviews/:id/claim
  app.post<{ Params: { id: string } }>(
    '/reviews/:id/claim',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.user!.id
      const { id: reviewId } = request.params

      const expertProfile = await prisma.expertProfile.findUnique({
        where: { userId },
        select: { id: true },
      })

      if (!expertProfile) {
        return reply.status(403).send({
          success: false,
          error: { code: 'NOT_AN_EXPERT', message: 'You do not have an active expert profile' },
        })
      }

      try {
        await claimReview(reviewId, expertProfile.id)
        return reply.send({ success: true, data: { message: 'Review claimed successfully' } })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to claim review'
        const status = message.includes('not found') ? 404 : 400
        return reply.status(status).send({
          success: false,
          error: { code: 'CLAIM_ERROR', message },
        })
      }
    }
  )

  // POST /api/v1/marketplace/reviews/:id/submit
  app.post<{ Params: { id: string } }>(
    '/reviews/:id/submit',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = submitReviewSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        })
      }

      const userId = request.user!.id
      const { id: reviewId } = request.params

      const expertProfile = await prisma.expertProfile.findUnique({
        where: { userId },
        select: { id: true },
      })

      if (!expertProfile) {
        return reply.status(403).send({
          success: false,
          error: { code: 'NOT_AN_EXPERT', message: 'You do not have an active expert profile' },
        })
      }

      try {
        await submitReview(reviewId, expertProfile.id, body.data.feedback)
        return reply.send({ success: true, data: { message: 'Review submitted successfully' } })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit review'
        const status = message.includes('not found') ? 404 : 400
        return reply.status(status).send({
          success: false,
          error: { code: 'SUBMIT_ERROR', message },
        })
      }
    }
  )

  // ─── Review acceptance / dispute (user side) ──────────────────────────────

  // POST /api/v1/marketplace/reviews/:id/accept
  app.post<{ Params: { id: string } }>(
    '/reviews/:id/accept',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = acceptReviewSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        })
      }

      const userId = request.user!.id
      const { id: reviewId } = request.params

      try {
        await acceptReview(reviewId, userId, body.data.rating, body.data.comment)
        return reply.send({
          success: true,
          data: { message: 'Review accepted and expert paid. Thank you for rating!' },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to accept review'
        const status = message.includes('not found') ? 404 : 400
        return reply.status(status).send({
          success: false,
          error: { code: 'ACCEPT_ERROR', message },
        })
      }
    }
  )

  // POST /api/v1/marketplace/reviews/:id/dispute
  app.post<{ Params: { id: string } }>(
    '/reviews/:id/dispute',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = disputeReviewSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        })
      }

      const userId = request.user!.id
      const { id: reviewId } = request.params

      const review = await prisma.expertReview.findUnique({
        where: { id: reviewId },
        select: { id: true, userId: true, status: true, taskId: true, expertId: true },
      })

      if (!review) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Review not found' },
        })
      }
      if (review.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You are not the requester of this review' },
        })
      }
      if (review.status !== 'SUBMITTED') {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_STATUS', message: `Review cannot be disputed in status: ${review.status}` },
        })
      }

      await prisma.expertReview.update({
        where: { id: reviewId },
        data: { status: 'DISPUTED' },
      })

      // Notify admin — use sentinel userId 'admin' if no real admin record exists
      const adminUser = await prisma.user.findFirst({
        where: { isAdmin: true },
        select: { id: true },
      })

      const adminUserId = adminUser?.id ?? 'admin'
      await createNotification({
        userId: adminUserId,
        type: 'system_alert',
        title: 'Expert review disputed',
        body: `Review ${reviewId} has been disputed. Reason: ${body.data.reason}`,
        link: `/admin/marketplace/reviews/${reviewId}`,
        metadata: {
          reviewId,
          taskId: review.taskId,
          expertId: review.expertId,
          disputeReason: body.data.reason,
          disputedBy: userId,
        },
      }).catch(() => {})

      return reply.send({
        success: true,
        data: { message: 'Dispute submitted. Our team will review within 24 hours.' },
      })
    }
  )

}

// ─── taskReviewRoutes — registered at /api/v1/tasks ──────────────────────────
// These routes live under /api/v1/tasks/:taskId/expert-review, separate from
// the /api/v1/marketplace prefix so the URL matches the spec exactly.

export async function taskReviewRoutes(app: FastifyInstance) {
  // POST /api/v1/tasks/:taskId/expert-review
  app.post<{ Params: { taskId: string } }>(
    '/:taskId/expert-review',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = requestExpertReviewSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        })
      }

      const userId = request.user!.id
      const { taskId } = request.params

      // Verify the task belongs to this user
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, userId: true },
      })

      if (!task) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Task not found' },
        })
      }
      if (task.userId !== userId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'This task does not belong to you' },
        })
      }

      try {
        const result = await createReviewRequest(
          taskId,
          userId,
          body.data.specialization,
          body.data.description
        )
        return reply.status(201).send({ success: true, data: result })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create review request'
        const status = message.includes('Insufficient credits') ? 402 : 400
        return reply.status(status).send({
          success: false,
          error: { code: 'REVIEW_REQUEST_ERROR', message },
        })
      }
    }
  )

  // GET /api/v1/tasks/:taskId/expert-review
  app.get<{ Params: { taskId: string } }>(
    '/:taskId/expert-review',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = request.user!.id
      const { taskId } = request.params

      const review = await prisma.expertReview.findFirst({
        where: { taskId, userId },
        orderBy: { expiresAt: 'desc' },
        select: {
          id: true,
          status: true,
          specialization: true,
          description: true,
          creditsEscrowed: true,
          feedback: true,
          rating: true,
          ratingComment: true,
          claimedAt: true,
          submittedAt: true,
          expiresAt: true,
          expert: {
            select: {
              id: true,
              avgRating: true,
              specializations: true,
              user: { select: { name: true, avatarUrl: true } },
            },
          },
        },
      })

      if (!review) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No expert review found for this task' },
        })
      }

      return reply.send({ success: true, data: { review } })
    }
  )
}
