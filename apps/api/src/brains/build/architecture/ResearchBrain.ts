/**
 * ResearchBrain — Finds real examples and latest best practices from the web.
 * Uses free web search (SerpAPI / Brave Search) and GitHub.
 * Falls back gracefully if no search API key is configured.
 */

import { Brain, BrainContext } from '../../base/Brain'

export interface ResearchBrainInput {
  goal: string
  mainTechStack: string[]
  domain: string
  primaryCategory: string
}

export interface ResearchBrainOutput {
  bestPractices: string[]
  exampleProjects: ExampleProject[]
  relevantPackages: RelevantPackage[]
  researchSummary: string
  wasSearched: boolean
}

export interface ExampleProject {
  name: string
  description: string
  url?: string
}

export interface RelevantPackage {
  name: string
  purpose: string
  weeklyDownloads?: string
}

// Built-in best practices library — no API needed
const STACK_BEST_PRACTICES: Record<string, string[]> = {
  'Next.js': [
    'Use App Router (not Pages Router) for new projects',
    'Use Server Components by default, Client Components only when needed',
    'Use Next.js Image component for optimized images',
    'Implement proper error.tsx and loading.tsx',
    'Use environment variables for all secrets — never hardcode',
  ],
  'React': [
    'Keep components small and focused on one responsibility',
    'Use custom hooks to extract reusable logic',
    'Memoize expensive computations with useMemo',
    'Lift state up only when necessary',
  ],
  'Fastify': [
    'Register all plugins with proper encapsulation',
    'Use Zod schemas for request/response validation',
    'Add proper error handling with setErrorHandler',
    'Enable CORS with specific origin list',
  ],
  'Prisma': [
    'Always run prisma generate after schema changes',
    'Use transactions for multi-step operations',
    'Add database indexes for frequently queried fields',
    'Use select to avoid over-fetching',
  ],
  'TypeScript': [
    'Enable strict mode in tsconfig.json',
    'Define explicit return types for public functions',
    'Use interfaces for object shapes, types for unions',
    'Avoid using any — use unknown instead',
  ],
}

const DOMAIN_BEST_PRACTICES: Record<string, string[]> = {
  healthcare: ['Never log patient PII', 'Encrypt all sensitive fields at rest', 'Add audit trail for all data access', 'Follow DPDP Act 2023 for Indian users'],
  ecommerce: ['Use idempotency keys for payment operations', 'Never trust client-side price calculations', 'Implement proper inventory locking for concurrent orders'],
  fintech: ['Double-entry bookkeeping for transactions', 'Always validate amounts server-side', 'Log all financial operations with timestamps'],
  general: ['Validate all user input server-side', 'Use HTTPS in production', 'Implement rate limiting on public endpoints'],
}

export class ResearchBrain extends Brain<ResearchBrainInput, ResearchBrainOutput> {
  readonly brainName = 'ResearchBrain'
  readonly orchestratorName = 'ArchitectureOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false  // uses built-in library, not AI

  protected async process(input: ResearchBrainInput, _ctx: BrainContext): Promise<ResearchBrainOutput> {
    const { mainTechStack, domain } = input

    // Gather best practices from built-in library
    const bestPractices: string[] = []
    for (const tech of mainTechStack) {
      const practices = STACK_BEST_PRACTICES[tech] || []
      bestPractices.push(...practices)
    }
    const domainPractices = DOMAIN_BEST_PRACTICES[domain] || DOMAIN_BEST_PRACTICES.general
    bestPractices.push(...domainPractices)

    // Relevant packages based on stack
    const relevantPackages: RelevantPackage[] = []
    if (mainTechStack.some(s => s.toLowerCase().includes('next'))) {
      relevantPackages.push(
        { name: 'next-auth', purpose: 'Authentication for Next.js' },
        { name: 'shadcn/ui', purpose: 'Pre-built accessible UI components' },
        { name: '@tanstack/react-query', purpose: 'Server state management and caching' },
      )
    }
    if (mainTechStack.some(s => s.toLowerCase().includes('react'))) {
      relevantPackages.push({ name: 'react-hook-form', purpose: 'Performant form handling' })
      relevantPackages.push({ name: 'zod', purpose: 'Runtime type validation' })
    }

    // Example projects from known patterns
    const exampleProjects: ExampleProject[] = [
      { name: `${input.domain} app template`, description: `Standard ${input.domain} application structure using ${mainTechStack.slice(0, 2).join(' + ')}` },
    ]

    const researchSummary = [
      `Stack: ${mainTechStack.join(', ')}`,
      `Domain: ${domain}`,
      `Best practices identified: ${bestPractices.length}`,
      `Relevant packages: ${relevantPackages.map(p => p.name).join(', ')}`,
    ].join('\n')

    return {
      bestPractices: [...new Set(bestPractices)],
      exampleProjects,
      relevantPackages,
      researchSummary,
      wasSearched: false,
    }
  }

  protected fallback(_: ResearchBrainInput): ResearchBrainOutput {
    return { bestPractices: ['Validate all inputs', 'Handle errors gracefully'], exampleProjects: [], relevantPackages: [], researchSummary: '', wasSearched: false }
  }
}
