/**
 * ContextBrain — Extracts background domain and context from the goal.
 * Pure logic — zero API calls. Pattern + keyword extraction.
 */

import { Brain, BrainContext } from '../../base/Brain'

export interface ContextBrainInput {
  goal: string
  userId: string
}

export interface ContextBrainOutput {
  domain: string           // e.g. 'healthcare', 'ecommerce', 'fintech', 'education'
  industry: string         // broader industry
  audience: string         // who the output is for
  techContext: string[]    // detected technologies
  businessContext: string  // any business context detected
}

const DOMAIN_MAP: Record<string, string[]> = {
  healthcare: ['doctor', 'patient', 'hospital', 'medical', 'health', 'clinic', 'appointment', 'prescription', 'diagnosis'],
  ecommerce: ['shop', 'store', 'product', 'cart', 'checkout', 'order', 'payment', 'inventory', 'buy', 'sell', 'marketplace'],
  fintech: ['bank', 'payment', 'finance', 'wallet', 'transaction', 'invoice', 'accounting', 'tax', 'loan', 'credit'],
  education: ['student', 'teacher', 'course', 'lesson', 'quiz', 'learning', 'school', 'university', 'exam', 'grade'],
  social: ['social', 'feed', 'post', 'follow', 'like', 'comment', 'chat', 'message', 'community', 'forum'],
  saas: ['saas', 'subscription', 'tenant', 'dashboard', 'analytics', 'admin', 'multi-tenant', 'billing', 'onboarding'],
  realestate: ['property', 'rent', 'buy house', 'listing', 'real estate', 'apartment', 'mortgage', 'agent'],
  logistics: ['delivery', 'tracking', 'shipment', 'warehouse', 'fleet', 'route', 'logistics', 'supply chain'],
  hr: ['employee', 'hr', 'payroll', 'hiring', 'recruitment', 'leave', 'attendance', 'performance review'],
  crm: ['customer', 'crm', 'lead', 'sales', 'pipeline', 'contact', 'deal', 'account management'],
}

const TECH_KEYWORDS: Record<string, RegExp> = {
  'React': /\breact\b/i,
  'Next.js': /next\.js|nextjs/i,
  'Vue': /\bvue\b/i,
  'TypeScript': /typescript|\.ts\b/i,
  'Node.js': /node\.js|nodejs/i,
  'Python': /\bpython\b/i,
  'PostgreSQL': /postgres|postgresql/i,
  'MongoDB': /mongodb|mongo/i,
  'Prisma': /\bprisma\b/i,
  'Tailwind': /tailwind/i,
  'Docker': /\bdocker\b/i,
  'FastAPI': /fastapi/i,
  'Django': /\bdjango\b/i,
  'Express': /\bexpress\b/i,
  'Supabase': /supabase/i,
  'Firebase': /firebase/i,
  'Flutter': /\bflutter\b/i,
  'React Native': /react native/i,
}

export class ContextBrain extends Brain<ContextBrainInput, ContextBrainOutput> {
  readonly brainName = 'ContextBrain'
  readonly orchestratorName = 'IntentOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: ContextBrainInput, _context: BrainContext): Promise<ContextBrainOutput> {
    const { goal } = input
    const lower = goal.toLowerCase()

    // Detect domain
    let domain = 'general'
    let maxScore = 0
    for (const [dom, keywords] of Object.entries(DOMAIN_MAP)) {
      const score = keywords.filter(kw => lower.includes(kw)).length
      if (score > maxScore) { maxScore = score; domain = dom }
    }

    // Detect industry (broader grouping)
    const industryMap: Record<string, string> = {
      healthcare: 'Health & Medical',
      ecommerce: 'Retail & Commerce',
      fintech: 'Finance & Banking',
      education: 'Education & Learning',
      social: 'Social & Community',
      saas: 'Software & Technology',
      realestate: 'Real Estate',
      logistics: 'Logistics & Supply Chain',
      hr: 'Human Resources',
      crm: 'Sales & CRM',
      general: 'General',
    }
    const industry = industryMap[domain] || 'General'

    // Detect technologies
    const techContext: string[] = []
    for (const [tech, pattern] of Object.entries(TECH_KEYWORDS)) {
      if (pattern.test(goal)) techContext.push(tech)
    }

    // Detect audience
    let audience = 'end users'
    if (/admin|internal|team|employee/i.test(goal)) audience = 'internal team / admins'
    else if (/customer|client|user/i.test(goal)) audience = 'customers / end users'
    else if (/developer|engineer|technical/i.test(goal)) audience = 'developers'
    else if (/student|learner/i.test(goal)) audience = 'students'

    // Business context
    let businessContext = ''
    if (/startup/i.test(goal)) businessContext = 'startup'
    else if (/enterprise|corporate|large company/i.test(goal)) businessContext = 'enterprise'
    else if (/small business|sme|smb/i.test(goal)) businessContext = 'small business'
    else if (/personal|side project|hobby/i.test(goal)) businessContext = 'personal project'

    return { domain, industry, audience, techContext, businessContext }
  }

  protected fallback(_input: ContextBrainInput): ContextBrainOutput {
    return { domain: 'general', industry: 'General', audience: 'end users', techContext: [], businessContext: '' }
  }
}
