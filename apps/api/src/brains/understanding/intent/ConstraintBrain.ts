/**
 * ConstraintBrain — Detects constraints: time, technology, budget, compliance.
 * Pure logic — zero API calls.
 */

import { Brain, BrainContext } from '../../base/Brain'

export interface ConstraintBrainInput {
  goal: string
}

export interface ConstraintBrainOutput {
  constraints: Constraint[]
  hasTechConstraints: boolean
  hasTimeConstraints: boolean
  hasComplianceConstraints: boolean
  maxBrains: number         // suggested brain count based on constraints
}

export interface Constraint {
  type: 'technology' | 'time' | 'budget' | 'compliance' | 'scope' | 'compatibility'
  description: string
  value?: string
}

export class ConstraintBrain extends Brain<ConstraintBrainInput, ConstraintBrainOutput> {
  readonly brainName = 'ConstraintBrain'
  readonly orchestratorName = 'IntentOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: ConstraintBrainInput, _context: BrainContext): Promise<ConstraintBrainOutput> {
    const { goal } = input
    const lower = goal.toLowerCase()
    const constraints: Constraint[] = []

    // Tech constraints
    const techPatterns: Array<[RegExp, string]> = [
      [/must use|only use|using only|stick to/i, 'Technology is specified/restricted'],
      [/no (external|third.party) (api|library|service)/i, 'No external dependencies'],
      [/must work (on|with|in)/i, 'Compatibility constraint'],
      [/open.?source only/i, 'Open source only'],
    ]
    for (const [pattern, desc] of techPatterns) {
      if (pattern.test(goal)) constraints.push({ type: 'technology', description: desc })
    }

    // Time constraints
    const timePatterns: Array<[RegExp, string, string?]> = [
      [/asap|urgently|immediately|right now/i, 'Urgent delivery required', 'urgent'],
      [/by (today|tomorrow|this week|this month)/i, 'Time-bound deadline', 'deadline'],
      [/within (a |an )?(day|week|month|hour)/i, 'Time constraint specified'],
    ]
    for (const [pattern, desc, value] of timePatterns) {
      if (pattern.test(goal)) constraints.push({ type: 'time', description: desc, value })
    }

    // Compliance constraints
    const compliancePatterns: Array<[RegExp, string]> = [
      [/dpdp|data protection|privacy/i, 'DPDP Act / data privacy compliance required'],
      [/gdpr/i, 'GDPR compliance required'],
      [/hipaa/i, 'HIPAA medical compliance required'],
      [/pci.?dss|payment.?compliance/i, 'PCI-DSS payment compliance required'],
      [/wcag|accessibility|a11y/i, 'Accessibility (WCAG) compliance required'],
      [/gst|tax.?compliance/i, 'GST/Tax compliance (India) required'],
    ]
    for (const [pattern, desc] of compliancePatterns) {
      if (pattern.test(goal)) constraints.push({ type: 'compliance', description: desc })
    }

    // Scope constraints
    if (/no (auth|authentication|login)/i.test(goal)) {
      constraints.push({ type: 'scope', description: 'No authentication required' })
    }
    if (/no (database|db|storage)/i.test(goal)) {
      constraints.push({ type: 'scope', description: 'No database required' })
    }

    // Suggest max brains based on complexity
    const maxBrains = constraints.length > 3 ? 9 : constraints.length > 1 ? 6 : 4

    return {
      constraints,
      hasTechConstraints: constraints.some(c => c.type === 'technology'),
      hasTimeConstraints: constraints.some(c => c.type === 'time'),
      hasComplianceConstraints: constraints.some(c => c.type === 'compliance'),
      maxBrains,
    }
  }

  protected fallback(_input: ConstraintBrainInput): ConstraintBrainOutput {
    return { constraints: [], hasTechConstraints: false, hasTimeConstraints: false, hasComplianceConstraints: false, maxBrains: 6 }
  }
}
