/**
 * PersonaBrain — Determines if the user is beginner / intermediate / expert.
 * Zero API calls — uses DB task history + vocabulary analysis.
 *
 * Shapes: response depth, explanation level, code comment density.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface PersonaBrainInput {
  userId: string
  goal: string
  totalTasksCompleted: number
}

export interface PersonaBrainOutput {
  expertiseLevel: 'beginner' | 'intermediate' | 'expert'
  role: 'developer' | 'business' | 'student' | 'creator' | 'analyst' | 'general'
  needsExplanations: boolean   // should output include explanations
  prefersTechnicalDepth: boolean
  communicationStyle: 'simple' | 'technical' | 'business'
}

// Technical vocabulary that indicates expertise
const TECHNICAL_TERMS = [
  'api', 'rest', 'graphql', 'microservice', 'docker', 'kubernetes', 'ci/cd',
  'prisma', 'orm', 'jwt', 'oauth', 'webhook', 'async', 'await', 'promise',
  'typescript', 'interface', 'generics', 'middleware', 'idempotent',
  'normalization', 'indexing', 'sharding', 'caching', 'redis', 'queue',
  'event-driven', 'pub/sub', 'saga', 'cqrs', 'ddd', 'solid', 'dry',
]

const BUSINESS_TERMS = [
  'revenue', 'roi', 'kpi', 'b2b', 'b2c', 'saas', 'mrr', 'arr', 'churn',
  'market share', 'go-to-market', 'product-market fit', 'growth hacking',
  'stakeholder', 'deliverable', 'milestone', 'sprint', 'roadmap',
]

const STUDENT_SIGNALS = [
  'learn', 'practice', 'assignment', 'project for', 'tutorial',
  'understand', 'beginner', 'first time', 'new to',
]

export class PersonaBrain extends Brain<PersonaBrainInput, PersonaBrainOutput> {
  readonly brainName = 'PersonaBrain'
  readonly orchestratorName = 'IntentOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: PersonaBrainInput, _context: BrainContext): Promise<PersonaBrainOutput> {
    const { userId, goal, totalTasksCompleted } = input
    const lower = goal.toLowerCase()

    // Vocabulary analysis
    const techScore = TECHNICAL_TERMS.filter(t => lower.includes(t)).length
    const businessScore = BUSINESS_TERMS.filter(t => lower.includes(t)).length
    const studentSignals = STUDENT_SIGNALS.filter(t => lower.includes(t)).length

    // Expertise from task count + vocabulary
    let expertiseLevel: 'beginner' | 'intermediate' | 'expert' = 'intermediate'
    if (totalTasksCompleted > 30 || techScore >= 3) expertiseLevel = 'expert'
    else if (totalTasksCompleted < 3 || studentSignals > 0) expertiseLevel = 'beginner'

    // Role detection
    let role: PersonaBrainOutput['role'] = 'general'
    if (techScore >= 2) role = 'developer'
    else if (businessScore >= 2) role = 'business'
    else if (studentSignals > 0) role = 'student'
    else if (/write|content|blog|copywriter/i.test(goal)) role = 'creator'
    else if (/data|analyze|report|dashboard/i.test(goal)) role = 'analyst'

    // Fetch user profile if available
    try {
      const userMemory = await prisma.userMemory.findMany({
        where: { userId, key: { in: ['role', 'expertise_level', 'tech_stack'] }, isActive: true },
      })
      const roleMemory = userMemory.find(m => m.key === 'role')
      if (roleMemory?.value) {
        const v = roleMemory.value.toLowerCase()
        if (v.includes('developer') || v.includes('engineer')) role = 'developer'
        else if (v.includes('business') || v.includes('manager')) role = 'business'
      }
    } catch {
      // DB query failed — use detected values
    }

    const prefersTechnicalDepth = role === 'developer' || expertiseLevel === 'expert'
    const needsExplanations = expertiseLevel === 'beginner' || role === 'student'

    let communicationStyle: 'simple' | 'technical' | 'business' = 'technical'
    if (role === 'business') communicationStyle = 'business'
    else if (needsExplanations) communicationStyle = 'simple'

    return { expertiseLevel, role, needsExplanations, prefersTechnicalDepth, communicationStyle }
  }

  protected fallback(_input: PersonaBrainInput): PersonaBrainOutput {
    return {
      expertiseLevel: 'intermediate',
      role: 'general',
      needsExplanations: false,
      prefersTechnicalDepth: false,
      communicationStyle: 'technical',
    }
  }
}
