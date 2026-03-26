/**
 * PatternBrain (Build) — Selects design patterns to apply to this codebase.
 * Zero API — rule-based pattern selection from built-in pattern library.
 */

import { Brain, BrainContext } from '../../base/Brain'

export interface PatternBrainInput {
  pattern: string
  hasAuthRequirement: boolean
  hasDatabaseRequirement: boolean
  hasAPIRequirement: boolean
  goal: string
}

export interface DesignPattern {
  name: string
  reason: string
  appliesTo: string
}

export interface PatternBrainOutput {
  patterns: DesignPattern[]
  authPattern: 'jwt' | 'session' | 'oauth' | 'none'
  dbPattern: 'prisma-orm' | 'raw-sql' | 'mongoose' | 'sqlalchemy' | 'none'
  apiPattern: 'rest' | 'graphql' | 'trpc' | 'none'
  statePattern: 'zustand' | 'context' | 'redux' | 'none'
}

export class PatternBrain extends Brain<PatternBrainInput, PatternBrainOutput> {
  readonly brainName = 'PatternBrain'
  readonly orchestratorName = 'ArchitectureOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: PatternBrainInput, _ctx: BrainContext): Promise<PatternBrainOutput> {
    const { hasAuthRequirement, hasDatabaseRequirement, hasAPIRequirement, goal } = input
    const lower = goal.toLowerCase()
    const patterns: DesignPattern[] = []

    // Auth pattern
    let authPattern: PatternBrainOutput['authPattern'] = 'none'
    if (hasAuthRequirement) {
      if (/google|github|social|oauth/i.test(goal)) { authPattern = 'oauth'; patterns.push({ name: 'OAuth 2.0', reason: 'Social login detected', appliesTo: 'authentication' }) }
      else if (/session|cookie/i.test(goal)) { authPattern = 'session'; patterns.push({ name: 'Session-based auth', reason: 'Session auth requested', appliesTo: 'authentication' }) }
      else { authPattern = 'jwt'; patterns.push({ name: 'JWT Bearer Tokens', reason: 'Default secure auth', appliesTo: 'authentication' }) }
    }

    // DB pattern
    let dbPattern: PatternBrainOutput['dbPattern'] = 'none'
    if (hasDatabaseRequirement) {
      if (/python|sqlalchemy/i.test(lower)) { dbPattern = 'sqlalchemy'; patterns.push({ name: 'SQLAlchemy ORM', reason: 'Python stack', appliesTo: 'database' }) }
      else if (/mongodb|mongoose/i.test(lower)) { dbPattern = 'mongoose'; patterns.push({ name: 'Mongoose ODM', reason: 'MongoDB detected', appliesTo: 'database' }) }
      else { dbPattern = 'prisma-orm'; patterns.push({ name: 'Prisma ORM', reason: 'Type-safe database access', appliesTo: 'database' }) }
    }

    // API pattern
    let apiPattern: PatternBrainOutput['apiPattern'] = 'none'
    if (hasAPIRequirement || /api/i.test(goal)) {
      if (/graphql/i.test(lower)) { apiPattern = 'graphql'; patterns.push({ name: 'GraphQL', reason: 'GraphQL requested', appliesTo: 'api' }) }
      else if (/trpc/i.test(lower)) { apiPattern = 'trpc'; patterns.push({ name: 'tRPC', reason: 'tRPC requested', appliesTo: 'api' }) }
      else { apiPattern = 'rest'; patterns.push({ name: 'REST API', reason: 'Standard REST conventions', appliesTo: 'api' }) }
    }

    // State management
    let statePattern: PatternBrainOutput['statePattern'] = 'none'
    if (/dashboard|complex ui|real.?time|live/i.test(lower)) {
      statePattern = 'zustand'
      patterns.push({ name: 'Zustand', reason: 'Complex client state needed', appliesTo: 'state-management' })
    } else if (/react|next/i.test(lower)) {
      statePattern = 'context'
      patterns.push({ name: 'React Context', reason: 'Simple state for React app', appliesTo: 'state-management' })
    }

    // Always add repository pattern for db
    if (hasDatabaseRequirement) {
      patterns.push({ name: 'Repository Pattern', reason: 'Separates data access from business logic', appliesTo: 'architecture' })
    }

    return { patterns, authPattern, dbPattern, apiPattern, statePattern }
  }

  protected fallback(_: PatternBrainInput): PatternBrainOutput {
    return { patterns: [], authPattern: 'none', dbPattern: 'none', apiPattern: 'rest', statePattern: 'none' }
  }
}
