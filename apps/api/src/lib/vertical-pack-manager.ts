/**
 * Vertical AI Packs — pre-configured specialist agent configurations.
 *
 * Built-in packs are seeded at server startup via seedBuiltInPacks().
 * Users can subscribe to packs to enable them for their tasks.
 * The orchestrator calls getPackContext() to inject pack-specific prompts.
 */

import { prisma } from '@sabha/db'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PackAgent {
  model: string
  role: string
  systemPrompt: string
  category: string
}

export interface PackWithSubscription {
  id: string
  slug: string
  name: string
  description: string
  category: string
  icon: string
  color: string
  agents: PackAgent[]
  disclaimer?: string
  isIncludedInTier: string[]
  creditsPerTask: number
  isSubscribed: boolean
  isIncludedInPlan: boolean
  usageCount: number
}

// ─── Built-in pack definitions ────────────────────────────────────────────────

const BUILT_IN_PACKS = [
  {
    slug: 'legal-pack',
    name: 'Legal AI Pack',
    category: 'LEGAL' as const,
    icon: '⚖️',
    color: 'from-slate-700 to-slate-900',
    description: 'Contract review, legal research, compliance checking, and document drafting with Indian law context.',
    disclaimer: 'Sabha Legal AI Pack provides informational assistance only. Content is not legal advice. Consult a qualified lawyer for legal decisions.',
    isIncludedInTier: ['POWER', 'ENTERPRISE'],
    creditsPerTask: 25,
    contextBlob: {
      jurisdiction: 'India',
      legalSystems: ['Indian Contract Act', 'Companies Act 2013', 'GDPR/PDPB', 'IT Act 2000'],
      citationFormat: 'Indian Legal Citation',
      disclaimerRequired: true,
    },
    agents: [
      {
        model: 'claude-3-opus',
        role: 'Legal Researcher',
        systemPrompt: 'You are a senior Indian legal expert. Research thoroughly citing relevant statutes, case law, and regulatory guidelines. Always note jurisdiction-specific requirements.',
        category: 'research',
      },
      {
        model: 'gpt-4o',
        role: 'Contract Analyst',
        systemPrompt: 'You are a contract law specialist. Analyze legal documents for risks, obligations, and compliance issues under Indian law.',
        category: 'strategy',
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Legal Writer',
        systemPrompt: 'You are a legal document drafting specialist. Write clear, precise legal language compliant with Indian regulations.',
        category: 'copywriting',
      },
    ],
  },
  {
    slug: 'medical-pack',
    name: 'Medical AI Pack',
    category: 'MEDICAL' as const,
    icon: '🏥',
    color: 'from-blue-600 to-cyan-700',
    description: 'Medical research, clinical documentation, patient education materials, and healthcare compliance.',
    disclaimer: 'Sabha Medical AI Pack is for informational and educational purposes only. Not a substitute for professional medical advice, diagnosis, or treatment.',
    isIncludedInTier: ['POWER', 'ENTERPRISE'],
    creditsPerTask: 30,
    contextBlob: {
      standard: 'Evidence-Based Medicine',
      citationFormat: 'Vancouver / PubMed',
      regulatoryBodies: ['CDSCO', 'NMC', 'FSSAI'],
      disclaimerRequired: true,
    },
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Medical Researcher',
        systemPrompt: 'You are a medical research specialist. Cite peer-reviewed studies from PubMed and clinical guidelines. Always note evidence levels (RCT, meta-analysis, expert opinion).',
        category: 'research',
      },
      {
        model: 'claude-3-opus',
        role: 'Clinical Analyst',
        systemPrompt: 'You are a clinical medicine expert. Analyze cases and literature with evidence-based reasoning. Always include relevant drug interactions, contraindications, and safety warnings.',
        category: 'strategy',
      },
      {
        model: 'gpt-4o',
        role: 'Patient Educator',
        systemPrompt: 'You write clear, accessible patient education materials. Translate medical complexity into plain language while maintaining accuracy.',
        category: 'copywriting',
      },
    ],
  },
  {
    slug: 'finance-pack',
    name: 'Finance AI Pack',
    category: 'FINANCE' as const,
    icon: '📊',
    color: 'from-emerald-600 to-teal-700',
    description: 'Financial analysis, investment research, tax planning, and regulatory compliance for Indian markets.',
    disclaimer: 'Sabha Finance AI Pack provides informational content only. Not investment advice. Consult a SEBI-registered advisor for investment decisions.',
    isIncludedInTier: ['PRO', 'POWER', 'ENTERPRISE'],
    creditsPerTask: 20,
    contextBlob: {
      market: 'India (NSE/BSE)',
      currency: 'INR',
      regulatoryBodies: ['SEBI', 'RBI', 'IRDAI', 'PFRDA'],
      taxSystem: 'Indian Income Tax Act',
      fiscalYear: 'April-March',
    },
    agents: [
      {
        model: 'perplexity-sonar',
        role: 'Market Researcher',
        systemPrompt: 'You are a senior Indian market analyst. Research financial data, company fundamentals, and market trends. Cite BSE/NSE data, SEBI filings, and RBI reports.',
        category: 'research',
      },
      {
        model: 'claude-3-opus',
        role: 'Financial Strategist',
        systemPrompt: 'You are a CFA-level financial strategist specializing in Indian markets. Provide deep analysis of financial statements, ratios, and investment frameworks.',
        category: 'strategy',
      },
      {
        model: 'gpt-4o',
        role: 'Financial Writer',
        systemPrompt: 'You write professional financial reports, investor communications, and regulatory filings following Indian financial reporting standards.',
        category: 'copywriting',
      },
    ],
  },
  {
    slug: 'engineering-pack',
    name: 'Engineering AI Pack',
    category: 'ENGINEERING' as const,
    icon: '⚙️',
    color: 'from-orange-500 to-red-600',
    description: 'System design, architecture review, code analysis, and technical documentation for software engineering teams.',
    isIncludedInTier: ['PRO', 'POWER', 'ENTERPRISE'],
    creditsPerTask: 15,
    contextBlob: {
      bestPractices: ['SOLID', 'DRY', 'KISS', '12-Factor App'],
      securityStandards: ['OWASP Top 10', 'CWE/SANS'],
    },
    agents: [
      {
        model: 'claude-3-opus',
        role: 'System Architect',
        systemPrompt: 'You are a principal software architect. Design scalable systems, review architecture decisions, and identify technical debt. Apply SOLID principles, design patterns, and 12-Factor app methodology.',
        category: 'strategy',
      },
      {
        model: 'gpt-4o',
        role: 'Code Reviewer',
        systemPrompt: 'You perform thorough code reviews focusing on correctness, performance, security (OWASP Top 10), and maintainability. Provide specific, actionable feedback.',
        category: 'code',
      },
      {
        model: 'claude-3-5-sonnet',
        role: 'Technical Writer',
        systemPrompt: 'You write clear technical documentation: API docs, architecture decisions (ADRs), runbooks, and developer guides.',
        category: 'copywriting',
      },
    ],
  },
  {
    slug: 'hr-pack',
    name: 'HR AI Pack',
    category: 'HR' as const,
    icon: '👥',
    color: 'from-violet-500 to-purple-700',
    description: 'Hiring, performance management, HR policy drafting, and employee communications for Indian workplaces.',
    isIncludedInTier: ['POWER', 'ENTERPRISE'],
    creditsPerTask: 15,
    contextBlob: {
      laborLaw: 'India (Factories Act, POSH Act, EPF, ESI)',
      hrFrameworks: ['OKR', 'BARS', '360-degree feedback'],
    },
    agents: [
      {
        model: 'claude-3-5-sonnet',
        role: 'HR Strategist',
        systemPrompt: 'You are an experienced Indian HR leader. Design people strategies, policies, and programs aligned with Indian labor law and company culture.',
        category: 'strategy',
      },
      {
        model: 'gpt-4o',
        role: 'HR Writer',
        systemPrompt: 'You write professional HR documents: job descriptions, offer letters, performance review templates, and employee handbooks compliant with Indian labor law.',
        category: 'copywriting',
      },
    ],
  },
] as const

// ─── seedBuiltInPacks ─────────────────────────────────────────────────────────

/**
 * Idempotent seed — safe to call on every server startup.
 * Uses upsert on slug so re-runs only update changed fields.
 */
export async function seedBuiltInPacks(): Promise<void> {
  for (const pack of BUILT_IN_PACKS) {
    try {
      await prisma.verticalPack.upsert({
        where: { slug: pack.slug },
        update: {
          name: pack.name,
          description: pack.description,
          category: pack.category,
          icon: pack.icon,
          color: pack.color,
          agents: pack.agents,
          contextBlob: pack.contextBlob,
          disclaimer: 'disclaimer' in pack ? pack.disclaimer : null,
          isIncludedInTier: [...pack.isIncludedInTier],
          creditsPerTask: pack.creditsPerTask,
          isBuiltIn: true,
          status: 'ACTIVE',
        },
        create: {
          slug: pack.slug,
          name: pack.name,
          description: pack.description,
          category: pack.category,
          icon: pack.icon,
          color: pack.color,
          agents: pack.agents,
          contextBlob: pack.contextBlob,
          disclaimer: 'disclaimer' in pack ? (pack as { disclaimer?: string }).disclaimer : null,
          isIncludedInTier: [...pack.isIncludedInTier],
          creditsPerTask: pack.creditsPerTask,
          isBuiltIn: true,
          status: 'ACTIVE',
        },
      })
    } catch (err) {
      console.error(`[vertical-pack-manager] Failed to seed pack "${pack.slug}":`, err)
    }
  }

  console.log(`[vertical-pack-manager] Seeded ${BUILT_IN_PACKS.length} built-in packs`)
}

// ─── getPacksForUser ──────────────────────────────────────────────────────────

/**
 * Returns all ACTIVE packs with the user's subscription and plan-inclusion status.
 */
export async function getPacksForUser(userId: string): Promise<PackWithSubscription[]> {
  const [user, packs, subscriptions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    }),
    prisma.verticalPack.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    }),
    prisma.userPackSubscription.findMany({
      where: { userId, isActive: true },
      select: { packId: true },
    }),
  ])

  const userTier = user?.tier ?? 'FREE'
  const subscribedPackIds = new Set(subscriptions.map((s) => s.packId))

  return packs.map((pack) => ({
    id: pack.id,
    slug: pack.slug,
    name: pack.name,
    description: pack.description,
    category: pack.category,
    icon: pack.icon,
    color: pack.color,
    agents: pack.agents as unknown as PackAgent[],
    disclaimer: pack.disclaimer ?? undefined,
    isIncludedInTier: pack.isIncludedInTier,
    creditsPerTask: pack.creditsPerTask,
    isSubscribed: subscribedPackIds.has(pack.id),
    isIncludedInPlan: pack.isIncludedInTier.includes(userTier),
    usageCount: pack.usageCount,
  }))
}

// ─── subscribeUserToPack ──────────────────────────────────────────────────────

export async function subscribeUserToPack(userId: string, packId: string): Promise<void> {
  await prisma.userPackSubscription.upsert({
    where: { userId_packId: { userId, packId } },
    update: { isActive: true },
    create: { userId, packId, isActive: true },
  })
}

// ─── unsubscribeUserFromPack ──────────────────────────────────────────────────

export async function unsubscribeUserFromPack(userId: string, packId: string): Promise<void> {
  await prisma.userPackSubscription.updateMany({
    where: { userId, packId },
    data: { isActive: false },
  })
}

// ─── getPackContext ───────────────────────────────────────────────────────────

/**
 * Returns the pack's agent configs and a system prompt suffix derived from its
 * contextBlob. Used by the orchestrator to inject pack context into task planning.
 */
export async function getPackContext(
  packId: string
): Promise<{ systemPromptSuffix: string; agents: PackAgent[] } | null> {
  const pack = await prisma.verticalPack.findUnique({
    where: { id: packId, status: 'ACTIVE' },
    select: {
      name: true,
      category: true,
      agents: true,
      contextBlob: true,
      disclaimer: true,
    },
  })

  if (!pack) return null

  const ctx = pack.contextBlob as Record<string, unknown>
  const contextLines: string[] = [
    `\n\n---`,
    `## ${pack.name} Context`,
    `You are operating under the ${pack.name} configuration for the ${pack.category} domain.`,
    `Apply the following domain-specific context to all outputs:`,
  ]

  for (const [key, value] of Object.entries(ctx)) {
    if (key === 'disclaimerRequired') continue
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
    const displayValue = Array.isArray(value) ? value.join(', ') : String(value)
    contextLines.push(`- **${label}**: ${displayValue}`)
  }

  if (pack.disclaimer) {
    contextLines.push(`\n**Disclaimer**: ${pack.disclaimer}`)
  }

  contextLines.push(`---`)

  return {
    systemPromptSuffix: contextLines.join('\n'),
    agents: pack.agents as unknown as PackAgent[],
  }
}
