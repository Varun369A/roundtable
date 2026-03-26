/**
 * RequirementsBrain — Structures all requirements from intent outputs.
 * Zero API — pure logic transformation of intent brain outputs.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { TaskCategory, Complexity } from '../../understanding/intent/IntentBrain'

export interface RequirementsBrainInput {
  goal: string
  primaryCategory: TaskCategory
  complexity: Complexity
  deliverables: string[]
  constraints: Array<{ type: string; description: string }>
  missingInfo: string[]
  domain: string
  techStack: string[]
  qualityExpectation: 'draft' | 'good' | 'production'
}

export interface Requirement {
  id: string
  description: string
  type: 'functional' | 'non-functional' | 'constraint' | 'compliance'
  priority: 'must' | 'should' | 'could'
  clarityScore: number
}

export interface RequirementsBrainOutput {
  requirements: Requirement[]
  functionalCount: number
  nonFunctionalCount: number
  hasAuthRequirement: boolean
  hasDatabaseRequirement: boolean
  hasAPIRequirement: boolean
  requirementsDocument: string
}

export class RequirementsBrain extends Brain<RequirementsBrainInput, RequirementsBrainOutput> {
  readonly brainName = 'RequirementsBrain'
  readonly orchestratorName = 'ArchitectureOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: RequirementsBrainInput, _ctx: BrainContext): Promise<RequirementsBrainOutput> {
    const { goal, primaryCategory, complexity, deliverables, constraints, domain, qualityExpectation } = input
    const lower = goal.toLowerCase()
    const requirements: Requirement[] = []
    let idCounter = 1

    const addReq = (description: string, type: Requirement['type'], priority: Requirement['priority']) => {
      requirements.push({ id: `REQ-${String(idCounter++).padStart(3, '0')}`, description, type, priority, clarityScore: 80 })
    }

    // Core deliverables → functional requirements
    for (const deliverable of deliverables) {
      addReq(`Deliver: ${deliverable}`, 'functional', 'must')
    }

    // Code task specific requirements
    if (primaryCategory === 'code') {
      const hasAuth = /auth|login|signup|register|user account/i.test(goal)
      const hasDb = /database|db|store|save|persist|crud/i.test(goal)
      const hasApi = /api|endpoint|rest|graphql|backend/i.test(goal)
      const hasUI = /ui|frontend|interface|dashboard|page|component/i.test(goal)

      if (hasAuth) addReq('User authentication and session management', 'functional', 'must')
      if (hasDb) addReq('Data persistence with database', 'functional', 'must')
      if (hasApi) addReq('REST API endpoints', 'functional', 'must')
      if (hasUI) addReq('User interface implementation', 'functional', 'must')

      // Non-functional based on quality
      if (qualityExpectation === 'production') {
        addReq('Error handling on all endpoints', 'non-functional', 'must')
        addReq('Input validation and sanitization', 'non-functional', 'must')
        addReq('Environment variable configuration', 'non-functional', 'must')
      }

      addReq('README with setup instructions', 'non-functional', 'should')
      if (complexity !== 'simple') addReq('Code comments and documentation', 'non-functional', 'should')
    }

    // Constraints → constraint requirements
    for (const constraint of constraints) {
      addReq(constraint.description, 'constraint', 'must')
    }

    // Compliance
    if (/dpdp|privacy/i.test(goal) || domain === 'healthcare' || domain === 'fintech') {
      addReq('Data privacy compliance (DPDP Act 2023)', 'compliance', 'must')
    }

    const hasAuthReq = requirements.some(r => r.description.toLowerCase().includes('auth'))
    const hasDbReq = requirements.some(r => r.description.toLowerCase().includes('database') || r.description.toLowerCase().includes('persist'))
    const hasApiReq = requirements.some(r => r.description.toLowerCase().includes('api'))

    const lines = ['# Requirements Document', '', `**Goal:** ${goal}`, `**Category:** ${primaryCategory}`, `**Complexity:** ${complexity}`, '']
    lines.push('## Requirements')
    for (const req of requirements) {
      lines.push(`- [${req.priority.toUpperCase()}] ${req.id}: ${req.description} (${req.type})`)
    }
    const requirementsDocument = lines.join('\n')

    return {
      requirements,
      functionalCount: requirements.filter(r => r.type === 'functional').length,
      nonFunctionalCount: requirements.filter(r => r.type === 'non-functional').length,
      hasAuthRequirement: hasAuthReq,
      hasDatabaseRequirement: hasDbReq,
      hasAPIRequirement: hasApiReq,
      requirementsDocument,
    }
  }

  protected fallback(input: RequirementsBrainInput): RequirementsBrainOutput {
    return {
      requirements: [{ id: 'REQ-001', description: input.goal, type: 'functional', priority: 'must', clarityScore: 50 }],
      functionalCount: 1, nonFunctionalCount: 0,
      hasAuthRequirement: false, hasDatabaseRequirement: false, hasAPIRequirement: false,
      requirementsDocument: `# Requirements\n- ${input.goal}`,
    }
  }
}
