/**
 * APIBrain — Defines all API endpoints from requirements.
 * Zero API — pure derivation from requirements and domain.
 */

import { Brain, BrainContext } from '../../base/Brain'

export interface APIBrainInput {
  goal: string
  hasAuthRequirement: boolean
  hasDatabaseRequirement: boolean
  apiPattern: string
  domain: string
  requirements: Array<{ description: string; type: string }>
}

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  description: string
  requiresAuth: boolean
  requestBody?: string
  responseType: string
}

export interface APIBrainOutput {
  endpoints: APIEndpoint[]
  baseUrl: string
  hasAuthEndpoints: boolean
  totalEndpoints: number
}

export class APIBrain extends Brain<APIBrainInput, APIBrainOutput> {
  readonly brainName = 'APIBrain'
  readonly orchestratorName = 'ArchitectureOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: APIBrainInput, _ctx: BrainContext): Promise<APIBrainOutput> {
    const { hasAuthRequirement, goal, domain, requirements } = input
    const lower = goal.toLowerCase()
    const endpoints: APIEndpoint[] = []

    // Auth endpoints
    if (hasAuthRequirement) {
      endpoints.push(
        { method: 'POST', path: '/api/auth/signup', description: 'Create new user account', requiresAuth: false, requestBody: '{ email, password, name }', responseType: '{ user, token }' },
        { method: 'POST', path: '/api/auth/login', description: 'Authenticate user', requiresAuth: false, requestBody: '{ email, password }', responseType: '{ user, token }' },
        { method: 'POST', path: '/api/auth/logout', description: 'Invalidate session', requiresAuth: true, responseType: '{ success }' },
        { method: 'GET', path: '/api/auth/me', description: 'Get current user', requiresAuth: true, responseType: '{ user }' },
      )
    }

    // Domain-specific CRUD endpoints
    const entities = this.extractEntities(lower, domain)
    for (const entity of entities.slice(0, 3)) {
      const entityPath = entity.toLowerCase().replace(/\s+/g, '-')
      endpoints.push(
        { method: 'GET', path: `/api/${entityPath}s`, description: `List all ${entity}s`, requiresAuth: hasAuthRequirement, responseType: `{ ${entityPath}s[] }` },
        { method: 'GET', path: `/api/${entityPath}s/:id`, description: `Get ${entity} by ID`, requiresAuth: hasAuthRequirement, responseType: `{ ${entityPath} }` },
        { method: 'POST', path: `/api/${entityPath}s`, description: `Create new ${entity}`, requiresAuth: hasAuthRequirement, requestBody: `{ ...${entity}Data }`, responseType: `{ ${entityPath} }` },
        { method: 'PUT', path: `/api/${entityPath}s/:id`, description: `Update ${entity}`, requiresAuth: hasAuthRequirement, requestBody: `{ ...${entity}Data }`, responseType: `{ ${entityPath} }` },
        { method: 'DELETE', path: `/api/${entityPath}s/:id`, description: `Delete ${entity}`, requiresAuth: hasAuthRequirement, responseType: '{ success }' },
      )
    }

    return {
      endpoints,
      baseUrl: '/api/v1',
      hasAuthEndpoints: hasAuthRequirement,
      totalEndpoints: endpoints.length,
    }
  }

  private extractEntities(lower: string, domain: string): string[] {
    const DOMAIN_ENTITIES: Record<string, string[]> = {
      healthcare: ['appointment', 'patient', 'doctor'],
      ecommerce: ['product', 'order', 'cart'],
      education: ['course', 'lesson', 'student'],
      social: ['post', 'comment', 'user'],
      crm: ['contact', 'deal', 'lead'],
      hr: ['employee', 'leave', 'job'],
      general: ['item', 'user', 'record'],
    }

    const domainEntities = DOMAIN_ENTITIES[domain] || DOMAIN_ENTITIES.general
    return domainEntities
  }

  protected fallback(_: APIBrainInput): APIBrainOutput {
    return { endpoints: [], baseUrl: '/api', hasAuthEndpoints: false, totalEndpoints: 0 }
  }
}
