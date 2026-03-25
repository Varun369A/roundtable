import { PrismaClient, AIModel } from '../generated/client'
import bcrypt from 'bcryptjs'
// Templates are loaded at runtime via dynamic require to avoid circular deps at seed time
// We inline the template data here for seed independence.

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding AI connectors...')

  const connectors = [
    {
      model: AIModel.claude_3_5_sonnet,
      displayName: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      description: 'Best for complex reasoning, writing, and code. Fast and highly capable.',
      capabilities: ['text', 'reasoning', 'code', 'vision', 'analysis'],
      categories: ['copywriting', 'strategy', 'code', 'general'],
      inputCostPer1M: 3.0,
      outputCostPer1M: 15.0,
    },
    {
      model: AIModel.claude_3_opus,
      displayName: 'Claude 3 Opus',
      provider: 'anthropic',
      description: 'Most powerful Claude model. Best for nuanced, expert-level tasks.',
      capabilities: ['text', 'reasoning', 'code', 'vision', 'analysis'],
      categories: ['copywriting', 'strategy', 'code', 'research'],
      inputCostPer1M: 15.0,
      outputCostPer1M: 75.0,
    },
    {
      model: AIModel.gpt_4o,
      displayName: 'GPT-4o',
      provider: 'openai',
      description: 'OpenAI flagship model. Excellent at structured tasks and vision.',
      capabilities: ['text', 'reasoning', 'vision', 'code'],
      categories: ['strategy', 'copywriting', 'data_analysis', 'general'],
      inputCostPer1M: 5.0,
      outputCostPer1M: 15.0,
    },
    {
      model: AIModel.gpt_4_turbo,
      displayName: 'GPT-4 Turbo',
      provider: 'openai',
      description: 'GPT-4 Turbo — high capability, great for long-context tasks.',
      capabilities: ['text', 'reasoning', 'code', 'analysis'],
      categories: ['data_analysis', 'code', 'strategy'],
      inputCostPer1M: 10.0,
      outputCostPer1M: 30.0,
    },
    {
      model: AIModel.gemini_pro,
      displayName: 'Gemini 1.5 Pro',
      provider: 'google',
      description: 'Google\'s Gemini — excellent for long documents and multimodal tasks.',
      capabilities: ['text', 'reasoning', 'vision', 'code'],
      categories: ['research', 'strategy', 'general'],
      inputCostPer1M: 3.5,
      outputCostPer1M: 10.5,
    },
    {
      model: AIModel.perplexity_sonar,
      displayName: 'Perplexity Sonar',
      provider: 'perplexity',
      description: 'Real-time web search and research. Always up-to-date information.',
      capabilities: ['search', 'research', 'real-time'],
      categories: ['research'],
      inputCostPer1M: 1.0,
      outputCostPer1M: 1.0,
    },
    {
      model: AIModel.midjourney_v6,
      displayName: 'Midjourney v6',
      provider: 'midjourney',
      description: 'State-of-the-art image generation. Best for artistic and photorealistic visuals.',
      capabilities: ['image_generation'],
      categories: ['images'],
      inputCostPer1M: 0,
      outputCostPer1M: 0,
    },
    {
      model: AIModel.dalle_3,
      displayName: 'DALL-E 3',
      provider: 'openai',
      description: 'High quality image generation from text descriptions.',
      capabilities: ['image_generation'],
      categories: ['images'],
      inputCostPer1M: 0,
      outputCostPer1M: 0,
    },
    {
      model: AIModel.stability_xl,
      displayName: 'Stable Diffusion XL',
      provider: 'stability',
      description: 'Open-source image generation. Great for product and style variations.',
      capabilities: ['image_generation'],
      categories: ['images'],
      inputCostPer1M: 0,
      outputCostPer1M: 0,
    },
    {
      model: AIModel.elevenlabs,
      displayName: 'ElevenLabs',
      provider: 'elevenlabs',
      description: 'Ultra-realistic AI voice generation and cloning.',
      capabilities: ['text_to_speech', 'voice_cloning'],
      categories: ['audio'],
      inputCostPer1M: 0,
      outputCostPer1M: 0,
    },
    {
      model: AIModel.runway_gen3,
      displayName: 'Runway Gen-3',
      provider: 'runway',
      description: 'Next-generation AI video creation and editing.',
      capabilities: ['video_generation', 'video_editing'],
      categories: ['video'],
      inputCostPer1M: 0,
      outputCostPer1M: 0,
    },
    {
      model: AIModel.sarvam_1,
      displayName: 'Sarvam AI',
      provider: 'sarvam',
      description: 'Indian language AI. Supports Hindi, Tamil, Telugu, Kannada, and more.',
      capabilities: ['text', 'translation', 'indian_languages'],
      categories: ['translation', 'general'],
      inputCostPer1M: 0.5,
      outputCostPer1M: 0.5,
    },
    {
      model: AIModel.gamma,
      displayName: 'Gamma',
      provider: 'gamma',
      description: 'AI-powered presentation and document creation.',
      capabilities: ['presentation', 'document'],
      categories: ['presentation'],
      inputCostPer1M: 0,
      outputCostPer1M: 0,
    },
  ]

  for (const connector of connectors) {
    await prisma.aIConnector.upsert({
      where: { model: connector.model },
      update: connector,
      create: connector,
    })
  }

  console.log(`Seeded ${connectors.length} AI connectors.`)

  // ─── Default admin user ────────────────────────────────────────────────────
  const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@arivarangam.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'change-this-strong-password'

  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { isAdmin: true, passwordHash, isEmailVerified: true, emailVerified: true, tier: 'ENTERPRISE', status: 'ACTIVE' },
    create: {
      email: adminEmail,
      name: 'Arivarangam Admin',
      passwordHash,
      tier: 'ENTERPRISE',
      status: 'ACTIVE',
      isAdmin: true,
      emailVerified: true,
      isEmailVerified: true,
      usageStats: { create: {} },  // required for task stats tracking
    },
  })

  // Ensure usageStats exists for admin (idempotent — safe if already exists)
  await prisma.usageStats.upsert({
    where:  { userId: admin.id },
    update: {},
    create: { userId: admin.id },
  }).catch(() => {})

  // Create admin's personal workspace
  const adminSlug = `admin-workspace`
  const adminWorkspace = await prisma.workspace.upsert({
    where: { slug: adminSlug },
    update: {},
    create: {
      name: 'Admin Workspace',
      slug: adminSlug,
      type: 'PERSONAL',
      ownerId: admin.id,
    },
  })

  // Add admin as OWNER member
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: adminWorkspace.id, userId: admin.id } },
    update: {},
    create: {
      workspaceId: adminWorkspace.id,
      userId: admin.id,
      role: 'OWNER',
      acceptedAt: new Date(),
    },
  })

  // Update admin's currentWorkspaceId
  await prisma.user.update({
    where: { id: admin.id },
    data: { currentWorkspaceId: adminWorkspace.id },
  })

  // Grant admin unlimited credits (1,000,000)
  await prisma.creditWallet.upsert({
    where:  { userId: admin.id },
    update: { balance: 1000000 },
    create: { userId: admin.id, balance: 1000000, lifetimeEarned: 1000000 },
  })

  // Ensure admin has a SIGNUP_BONUS record so the update propagator
  // doesn't incorrectly top-up admin's credit balance on every restart
  const existingBonus = await prisma.creditTransaction.findFirst({
    where: { userId: admin.id, type: 'SIGNUP_BONUS' },
  })
  if (!existingBonus) {
    await prisma.creditTransaction.create({
      data: {
        userId:      admin.id,
        amount:      1000000,
        type:        'SIGNUP_BONUS',
        description: 'Admin unlimited credits',
      },
    }).catch(() => {})
  }

  // Ensure admin has accepted current terms (so no 403 on login)
  const latestTerms = await prisma.termsVersion.findFirst({ orderBy: { effectiveAt: 'desc' } })
  if (latestTerms) {
    await prisma.userTermsAcceptance.upsert({
      where:  { userId_termsVersionId: { userId: admin.id, termsVersionId: latestTerms.id } },
      update: {},
      create: { userId: admin.id, termsVersionId: latestTerms.id, ipAddress: '127.0.0.1', userAgent: 'seed' },
    }).catch(() => {})
  }

  // Ensure admin has an Arivarangam Passport
  await prisma.arivarangamPassport.upsert({
    where:  { userId: admin.id },
    update: {},
    create: {
      userId:      admin.id,
      displayName: 'Arivarangam Admin',
      level:       10,
      xp:          10000,
      tier:        'LEGEND',
    },
  }).catch(() => {})

  console.log(`Admin user seeded: ${adminEmail}`)

  // ─── Built-in Roundtable Templates ────────────────────────────────────────

  console.log('Seeding Roundtable templates...')

  const templates = getBuiltInTemplates()

  let newTemplates = 0
  let updatedTemplates = 0
  for (const template of templates) {
    const existing = await prisma.roundtableTemplate.findFirst({
      where: { name: template.name, isBuiltIn: true },
    })

    if (!existing) {
      await prisma.roundtableTemplate.create({
        data: {
          ...template,
          isBuiltIn: true,
          isPublic: true,
          agents: template.agents as object,
        },
      })
      newTemplates++
    } else {
      // Always update agents, description, tags so code changes propagate to all users
      await prisma.roundtableTemplate.update({
        where: { id: existing.id },
        data: {
          description:     template.description,
          agents:          template.agents as object,
          examplePrompts:  template.examplePrompts,
          tags:            template.tags,
          isPublic:        true,
        },
      })
      updatedTemplates++
    }
  }

  console.log(`Seeded ${newTemplates} new + updated ${updatedTemplates} existing Roundtable templates.`)

  // ─── Feature flags ──────────────────────────────────────────────────────────
  console.log('Seeding feature flags...')

  const flags = [
    {
      key: 'beta_required',
      enabled: false,  // flip to true for launch
      description: 'Gate signups behind invite code. Enable when going into closed beta.',
      config: {},
    },
    {
      key: 'email_notifications',
      enabled: false,  // enable once RESEND_API_KEY is configured
      description: 'Send transactional emails (welcome, task complete, workspace invite).',
      config: {},
    },
    {
      key: 'team_workspaces',
      enabled: true,
      description: 'Enable team workspace creation and member management for Power+ plans.',
      config: {},
    },
    {
      key: 'template_gallery',
      enabled: true,
      description: 'Show the template gallery page and allow template-based task creation.',
      config: {},
    },
    {
      key: 'admin_analytics_v2',
      enabled: false,
      description: 'New cohort analytics dashboard for admin (in development).',
      config: {},
    },
  ]

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: flag,
      update: { description: flag.description },
    })
  }

  console.log(`Seeded ${flags.length} feature flags.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())


// ─── Inline template data (avoids circular dep with apps/api) ─────────────────

function getBuiltInTemplates() {
  return [
    {
      name: 'Web App Development',
      description: 'Full-stack web app: architecture → research → implementation → review → docs',
      category: 'development' as const,
      subcategory: 'web-app',
      icon: '🌐',
      color: 'indigo',
      agents: [
        { model: 'perplexity-sonar', role: 'Tech Researcher', category: 'research', instruction: 'Research the best tech stack, libraries, and current best practices for this web app. Include security considerations, scalability options, and popular frameworks.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'System Architect', category: 'strategy', instruction: 'Based on the research, design the complete system architecture. Define: folder structure, API design, component hierarchy, state management, and deployment strategy.', dependsOnPrevious: true },
        { model: 'claude-3-opus', role: 'Lead Developer', category: 'code', instruction: 'Write the core implementation code based on the architecture. Include: main entry points, key components/routes, database schema, and setup instructions.', dependsOnPrevious: true },
        { model: 'gpt-4o', role: 'Code Reviewer', category: 'code', instruction: 'Review the implementation for security vulnerabilities, performance issues, and code quality. Suggest specific improvements.', dependsOnPrevious: true },
        { model: 'gamma', role: 'Documentation Writer', category: 'presentation', instruction: 'Create technical documentation: README, API docs, setup guide, and architecture overview.', dependsOnPrevious: true },
      ],
      examplePrompts: ['Build a SaaS expense tracker with team collaboration', 'Create a real-time multiplayer quiz app', 'Develop an e-commerce platform with payment integration'],
      tags: ['web', 'fullstack', 'javascript', 'typescript', 'saas'],
    },
    {
      name: 'Mobile App Development',
      description: 'Mobile app: research → architecture → UI design → implementation → store listing',
      category: 'development' as const,
      subcategory: 'mobile-app',
      icon: '📱',
      color: 'blue',
      agents: [
        { model: 'perplexity-sonar', role: 'Platform Researcher', category: 'research', instruction: 'Research: React Native vs Flutter vs native, required libraries, App Store/Play Store guidelines.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'Mobile Architect', category: 'strategy', instruction: 'Design the mobile app architecture: navigation structure, state management, offline support, and API integration pattern.', dependsOnPrevious: true },
        { model: 'midjourney-v6', role: 'UI Designer', category: 'images', instruction: 'Design key UI screens: onboarding, home dashboard, and main feature screens following mobile platform guidelines.', dependsOnPrevious: true },
        { model: 'claude-3-opus', role: 'Core Developer', category: 'code', instruction: 'Implement core app code: navigation, main screens, API integration, local storage, and authentication flow.', dependsOnPrevious: true },
        { model: 'gpt-4o', role: 'Store Listing Writer', category: 'copywriting', instruction: 'Write App Store and Play Store listing: title, description, keywords for ASO, and release notes.', dependsOnPrevious: true },
      ],
      examplePrompts: ['Build a fitness tracking app', 'Create a language learning app for Indian languages', 'Develop a food delivery app'],
      tags: ['mobile', 'react-native', 'flutter', 'ios', 'android'],
    },
    {
      name: 'API / Backend Service',
      description: 'REST or GraphQL API: design → implementation → security review → deployment docs',
      category: 'development' as const,
      subcategory: 'api-backend',
      icon: '⚙️',
      color: 'emerald',
      agents: [
        { model: 'perplexity-sonar', role: 'API Standards Researcher', category: 'research', instruction: 'Research: REST vs GraphQL for this use case, auth patterns, rate limiting, and API versioning strategies.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'API Architect', category: 'strategy', instruction: 'Design the complete API: endpoint structure, request/response schemas, auth flow, and data models.', dependsOnPrevious: true },
        { model: 'claude-3-opus', role: 'Backend Engineer', category: 'code', instruction: 'Implement the API with all endpoint handlers, middleware, database queries, and error handling.', dependsOnPrevious: true },
        { model: 'gpt-4o', role: 'Security Reviewer', category: 'code', instruction: 'Review for SQL injection, XSS, authentication bypass, and missing input validation. Provide specific fixes.', dependsOnPrevious: true },
        { model: 'gamma', role: 'API Documentation Writer', category: 'presentation', instruction: 'Create developer documentation: API reference with examples, authentication guide, and quickstart tutorial.', dependsOnPrevious: true },
      ],
      examplePrompts: ['Build a payments API with Razorpay integration', 'Create a notifications API', 'Develop a file upload and processing API'],
      tags: ['api', 'rest', 'graphql', 'backend', 'nodejs'],
    },
    {
      name: 'Brand Identity Design',
      description: 'Complete brand: research → strategy → visual identity → style guide → copy',
      category: 'design' as const,
      subcategory: 'brand-identity',
      icon: '✨',
      color: 'pink',
      agents: [
        { model: 'perplexity-sonar', role: 'Market Researcher', category: 'research', instruction: 'Research the industry, target audience, competitors, and design trends for brand positioning opportunities.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'Brand Strategist', category: 'strategy', instruction: 'Define the brand: personality, values, positioning, tone of voice, and key differentiators.', dependsOnPrevious: true },
        { model: 'midjourney-v6', role: 'Visual Designer', category: 'images', instruction: 'Create visual identity concepts: logo concepts, color palette, typography pairings, and brand patterns.', dependsOnPrevious: true },
        { model: 'dalle-3', role: 'Asset Creator', category: 'images', instruction: 'Generate brand application mockups: business cards, social media profiles, and product packaging.', dependsOnPrevious: true },
        { model: 'gamma', role: 'Style Guide Author', category: 'presentation', instruction: 'Create the brand style guide: logo rules, color specs, typography hierarchy, and imagery guidelines.', dependsOnPrevious: true },
      ],
      examplePrompts: ['Brand identity for a sustainable fashion startup', 'Design brand system for a fintech app', 'Visual identity for an EdTech platform'],
      tags: ['branding', 'logo', 'visual-identity', 'design-system'],
    },
    {
      name: 'UI/UX Product Design',
      description: 'Product design: user research → UX flow → UI screens → prototype spec → handoff',
      category: 'design' as const,
      subcategory: 'ui-ux',
      icon: '🎨',
      color: 'purple',
      agents: [
        { model: 'perplexity-sonar', role: 'UX Researcher', category: 'research', instruction: 'Research target users, pain points, competitor UX patterns, and accessibility requirements.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'UX Architect', category: 'strategy', instruction: 'Design user experience: personas, journey maps, information architecture, and interaction flows.', dependsOnPrevious: true },
        { model: 'midjourney-v6', role: 'UI Designer', category: 'images', instruction: 'Create high-fidelity UI screens for key flows with attention to typography, spacing, and visual hierarchy.', dependsOnPrevious: true },
        { model: 'dalle-3', role: 'Illustration Creator', category: 'images', instruction: 'Create custom illustrations, icons, and empty-state graphics consistent with the visual direction.', dependsOnPrevious: true },
        { model: 'gpt-4o', role: 'Developer Handoff Writer', category: 'copywriting', instruction: 'Write developer handoff spec: component specs, interaction behaviors, animation timings, and accessibility requirements.', dependsOnPrevious: true },
      ],
      examplePrompts: ['Design a dashboard for an analytics SaaS', 'Create UX for a mobile banking app', 'Design an onboarding flow for a B2B tool'],
      tags: ['ui', 'ux', 'product-design', 'figma', 'user-research'],
    },
    {
      name: 'Course Creation',
      description: 'Full online course: topic research → curriculum → content → audio lessons → slides',
      category: 'learning' as const,
      subcategory: 'course',
      icon: '🎓',
      color: 'amber',
      agents: [
        { model: 'perplexity-sonar', role: 'Subject Matter Researcher', category: 'research', instruction: 'Research the topic depth, existing courses, learner prerequisites, and what professionals say about learning this subject.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'Curriculum Designer', category: 'strategy', instruction: 'Design the complete curriculum: learning outcomes, module structure, lesson sequence, and assessments.', dependsOnPrevious: true },
        { model: 'gpt-4o', role: 'Content Writer', category: 'copywriting', instruction: 'Write course content: lesson scripts, explanations, examples, and practice exercises for each module.', dependsOnPrevious: true },
        { model: 'elevenlabs', role: 'Voice Narrator', category: 'audio', instruction: 'Convert lesson content to professional narration audio in a clear, engaging teaching voice.', dependsOnPrevious: true },
        { model: 'gamma', role: 'Slide Designer', category: 'presentation', instruction: 'Create the course slide deck: one slide per key concept with visual aids, diagrams, and quiz slides.', dependsOnPrevious: true },
      ],
      examplePrompts: ['Python programming course for beginners', 'Digital marketing course for small businesses', 'Financial literacy course in Hindi'],
      tags: ['education', 'course', 'elearning', 'curriculum', 'teaching'],
    },
    {
      name: 'Study Plan & Notes',
      description: 'Exam prep: syllabus research → study plan → detailed notes → practice questions',
      category: 'learning' as const,
      subcategory: 'study-plan',
      icon: '📚',
      color: 'teal',
      agents: [
        { model: 'perplexity-sonar', role: 'Syllabus Researcher', category: 'research', instruction: 'Research the exam syllabus, common question patterns, high-weight topics, and recommended resources.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'Study Planner', category: 'strategy', instruction: 'Create a structured study plan with daily/weekly schedule, topic prioritization, and revision cycles.', dependsOnPrevious: true },
        { model: 'claude-3-opus', role: 'Note Maker', category: 'copywriting', instruction: 'Create comprehensive study notes with clear explanations, memory tricks, key formulas, and concept maps.', dependsOnPrevious: true },
        { model: 'gpt-4o', role: 'Question Bank Creator', category: 'general', instruction: 'Generate a practice question bank: MCQs, short answers, and long-form questions with detailed explanations.', dependsOnPrevious: true },
        { model: 'sarvam-1', role: 'Regional Language Translator', category: 'translation', instruction: 'Translate study notes and key concepts to the user\'s regional language for easier retention.', dependsOnPrevious: true, optional: true },
      ],
      examplePrompts: ['Prepare for UPSC Civil Services in 6 months', 'Study plan for JEE Advanced', 'NEET Biology notes in Hindi'],
      tags: ['exam', 'upsc', 'jee', 'neet', 'study', 'notes'],
    },
    {
      name: 'Product Launch Campaign',
      description: 'Full launch: market research → strategy → copy → visuals → press release → social',
      category: 'marketing' as const,
      subcategory: 'product-launch',
      icon: '🚀',
      color: 'orange',
      agents: [
        { model: 'perplexity-sonar', role: 'Market Intelligence', category: 'research', instruction: 'Research target market, competitor launches, industry news, and winning launch strategies.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'Launch Strategist', category: 'strategy', instruction: 'Build complete launch strategy: positioning, go-to-market, channel mix, timeline, and success KPIs.', dependsOnPrevious: true },
        { model: 'gpt-4o', role: 'Copywriter', category: 'copywriting', instruction: 'Write all launch copy: tagline, hero copy, email sequence, landing page, and ad variations.', dependsOnPrevious: true },
        { model: 'midjourney-v6', role: 'Visual Creator', category: 'images', instruction: 'Create launch visuals: hero banner, social media graphics, email header, and ad creatives.', dependsOnPrevious: true },
        { model: 'claude-3-opus', role: 'PR Writer', category: 'copywriting', instruction: 'Write: press release, Product Hunt post, LinkedIn announcement, and influencer pitch templates.', dependsOnPrevious: true },
        { model: 'gamma', role: 'Pitch Deck Creator', category: 'presentation', instruction: 'Build investor/partner launch presentation with problem, solution, market, traction, and ask.', dependsOnPrevious: true },
      ],
      examplePrompts: ['Launch a B2B SaaS HR platform', 'Consumer app launch in Indian health market', 'D2C beauty brand product launch'],
      tags: ['launch', 'gtm', 'pr', 'campaign', 'product-marketing'],
    },
    {
      name: 'Content Marketing Engine',
      description: 'Content strategy + creation: SEO research → calendar → articles → social → newsletter',
      category: 'marketing' as const,
      subcategory: 'content-marketing',
      icon: '✍️',
      color: 'cyan',
      agents: [
        { model: 'perplexity-sonar', role: 'SEO & Trend Researcher', category: 'research', instruction: 'Research high-volume keywords, trending topics, competitor content gaps, and audience questions.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'Content Strategist', category: 'strategy', instruction: 'Create a 3-month content calendar with topic clusters, publishing frequency, and distribution channels.', dependsOnPrevious: true },
        { model: 'claude-3-opus', role: 'Lead Article Writer', category: 'copywriting', instruction: 'Write the top 3 pillar articles: 1500+ words each, SEO-optimized, with proper headings and strong CTAs.', dependsOnPrevious: true },
        { model: 'gpt-4o', role: 'Social Media Manager', category: 'copywriting', instruction: 'Repurpose articles into social content: LinkedIn posts, Twitter threads, Instagram captions, and video scripts.', dependsOnPrevious: true },
        { model: 'midjourney-v6', role: 'Visual Content Creator', category: 'images', instruction: 'Create featured images, social media graphics, and infographic concepts for the content.', dependsOnPrevious: true },
      ],
      examplePrompts: ['Content strategy for a fintech startup blog', 'SaaS HR tool content marketing', 'Content calendar for a D2C food brand'],
      tags: ['content', 'seo', 'blog', 'social-media', 'newsletter'],
    },
    {
      name: 'Business Plan',
      description: 'Complete business plan: market research → strategy → financials → pitch deck',
      category: 'business' as const,
      subcategory: 'business-plan',
      icon: '💼',
      color: 'slate',
      agents: [
        { model: 'perplexity-sonar', role: 'Market Analyst', category: 'research', instruction: 'Research market size (TAM/SAM/SOM), industry trends, competitors with funding/revenue, and regulatory landscape.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'Business Strategist', category: 'strategy', instruction: 'Write business plan sections: executive summary, problem/solution, value proposition, business model, and go-to-market strategy.', dependsOnPrevious: true },
        { model: 'gpt-4-turbo', role: 'Financial Modeler', category: 'data_analysis', instruction: 'Create 3-year financial projections: P&L forecast, cash flow, unit economics, and funding requirements.', dependsOnPrevious: true },
        { model: 'gamma', role: 'Pitch Deck Designer', category: 'presentation', instruction: 'Build investor pitch deck (12-15 slides): problem, solution, market, product, traction, and ask.', dependsOnPrevious: true },
        { model: 'midjourney-v6', role: 'Presentation Visuals', category: 'images', instruction: 'Create impactful pitch visuals: market charts, product mockups, and competitive positioning map.', dependsOnPrevious: true },
      ],
      examplePrompts: ['Business plan for a quick-commerce startup in India', 'B2B SaaS targeting SMEs', 'EV charging network business plan'],
      tags: ['startup', 'business-plan', 'pitch-deck', 'funding', 'strategy'],
    },
    {
      name: 'Competitive Intelligence',
      description: 'Deep competitor analysis: research → data synthesis → strategy → report',
      category: 'business' as const,
      subcategory: 'competitive-analysis',
      icon: '🔍',
      color: 'red',
      agents: [
        { model: 'perplexity-sonar', role: 'Competitive Intelligence Analyst', category: 'research', instruction: 'Research all major competitors: products, pricing, funding, team size, customer reviews, and marketing strategy.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'Strategic Advisor', category: 'strategy', instruction: 'Write strategic recommendations: market gaps, differentiation opportunities, threats, and prioritized action plan.', dependsOnPrevious: true },
        { model: 'gamma', role: 'Report Designer', category: 'presentation', instruction: 'Create competitive intelligence report with visual comparison charts and positioning maps.', dependsOnPrevious: true },
      ],
      examplePrompts: ['Competitive analysis for Indian CRM market', 'Online tutoring space competitor research', 'Fintech lending startup competitive landscape'],
      tags: ['competitive-analysis', 'market-research', 'strategy'],
    },
    {
      name: 'YouTube Video Production',
      description: 'Complete video: research → script → thumbnail → narration → description/tags',
      category: 'content' as const,
      subcategory: 'youtube',
      icon: '🎬',
      color: 'rose',
      agents: [
        { model: 'perplexity-sonar', role: 'Trend & SEO Researcher', category: 'research', instruction: 'Research YouTube search volume, trending angles, top-performing videos, and keywords to optimize for.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'Script Writer', category: 'copywriting', instruction: 'Write the full video script: hook, main content, examples/stories, and CTA. Written for spoken word.', dependsOnPrevious: true },
        { model: 'elevenlabs', role: 'Voice Narrator', category: 'audio', instruction: 'Record the narration audio in a clear, energetic voice appropriate for YouTube content.', dependsOnPrevious: true },
        { model: 'midjourney-v6', role: 'Thumbnail Designer', category: 'images', instruction: 'Create 3 thumbnail concepts: high-contrast, emotion-driven, with bold text overlays.', dependsOnPrevious: true },
        { model: 'gpt-4o', role: 'SEO Metadata Writer', category: 'copywriting', instruction: 'Write YouTube metadata: keyword-rich title, description, tags (20+), and pinned comment text.', dependsOnPrevious: true },
      ],
      examplePrompts: ['YouTube video on how AI is changing jobs', 'Tech review video for a new smartphone', 'Finance tutorial: investing in index funds'],
      tags: ['youtube', 'video', 'content-creation', 'script', 'thumbnail'],
    },
    {
      name: 'Market Research Report',
      description: 'Full market research: data gathering → analysis → insights → visual report',
      category: 'research' as const,
      subcategory: 'market-research',
      icon: '📊',
      color: 'green',
      agents: [
        { model: 'perplexity-sonar', role: 'Primary Researcher', category: 'research', instruction: 'Conduct market research: market size, growth rate, segments, customer demographics, and major trends.', dependsOnPrevious: false },
        { model: 'gemini-pro', role: 'Secondary Researcher', category: 'research', instruction: 'Research additional dimensions: regulatory environment, technology disruptions, and future projections.', dependsOnPrevious: false },
        { model: 'gpt-4-turbo', role: 'Data Analyst', category: 'data_analysis', instruction: 'Analyze all research data, calculate market metrics, create data tables, and draw sound conclusions.', dependsOnPrevious: true },
        { model: 'claude-3-5-sonnet', role: 'Insights Writer', category: 'copywriting', instruction: 'Write the research report: executive summary, key findings, and actionable recommendations.', dependsOnPrevious: true },
        { model: 'gamma', role: 'Report Designer', category: 'presentation', instruction: 'Create visual research report with charts, infographics, and key stat callouts.', dependsOnPrevious: true },
      ],
      examplePrompts: ['India EV market research report 2025', 'D2C beauty market in Southeast Asia', 'Indian EdTech landscape analysis'],
      tags: ['market-research', 'report', 'analysis', 'data'],
    },
    {
      name: 'Career Growth Plan',
      description: 'Personal career: skills gap → learning plan → resume → LinkedIn → outreach',
      category: 'personal' as const,
      subcategory: 'career',
      icon: '🌱',
      color: 'lime',
      agents: [
        { model: 'perplexity-sonar', role: 'Job Market Researcher', category: 'research', instruction: 'Research the target role/industry: in-demand skills, salary ranges, top companies hiring, and career paths.', dependsOnPrevious: false },
        { model: 'claude-3-5-sonnet', role: 'Career Advisor', category: 'strategy', instruction: 'Create personalized career plan: skills gap analysis, 90-day action plan, and networking strategy.', dependsOnPrevious: true },
        { model: 'gpt-4o', role: 'Resume & LinkedIn Writer', category: 'copywriting', instruction: 'Write ATS-optimized resume and LinkedIn profile with achievement metrics and role-specific keywords.', dependsOnPrevious: true },
        { model: 'claude-3-opus', role: 'Outreach Specialist', category: 'copywriting', instruction: 'Write personalized outreach: cold emails, LinkedIn connection notes, and referral request messages.', dependsOnPrevious: true },
      ],
      examplePrompts: ['Transition from engineer to product manager', 'Break into AI/ML from non-technical background', 'Land a remote job at a US tech company from India'],
      tags: ['career', 'resume', 'linkedin', 'job-search'],
    },
  ]
}
