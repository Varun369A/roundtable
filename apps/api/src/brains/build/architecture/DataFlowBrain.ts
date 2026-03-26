/**
 * DataFlowBrain — Maps how data flows through the system.
 * Zero API — derived from architecture and pattern choices.
 */

import { Brain, BrainContext } from '../../base/Brain'

export interface DataFlowBrainInput {
  pattern: string
  authPattern: string
  dbPattern: string
  apiPattern: string
  hasAuthRequirement: boolean
  hasDatabaseRequirement: boolean
}

export interface DataFlowBrainOutput {
  dataFlow: string           // human-readable flow description
  layers: string[]           // ordered layers: UI → API → Service → DB
  hasMiddlewareLayer: boolean
  dataFlowDiagram: string    // ASCII diagram
}

export class DataFlowBrain extends Brain<DataFlowBrainInput, DataFlowBrainOutput> {
  readonly brainName = 'DataFlowBrain'
  readonly orchestratorName = 'ArchitectureOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: DataFlowBrainInput, _ctx: BrainContext): Promise<DataFlowBrainOutput> {
    const { pattern, hasAuthRequirement, hasDatabaseRequirement, authPattern, dbPattern } = input
    const layers: string[] = []
    const flowSteps: string[] = []

    if (pattern === 'fullstack-next' || pattern === 'fullstack-separate' || pattern === 'frontend-only') {
      layers.push('UI Layer (React/Next.js components)')
      flowSteps.push('User interacts with UI component')
    }

    if (hasAuthRequirement) {
      layers.push(`Auth Layer (${authPattern === 'jwt' ? 'JWT middleware' : authPattern === 'oauth' ? 'OAuth callback' : 'Session middleware'})`)
      flowSteps.push(`Request passes through auth middleware → verify ${authPattern} token`)
    }

    if (pattern !== 'frontend-only') {
      layers.push('API Layer (Route handlers / Controllers)')
      flowSteps.push('API route receives validated request')
    }

    layers.push('Service Layer (Business logic)')
    flowSteps.push('Service processes business logic')

    if (hasDatabaseRequirement) {
      layers.push(`Data Layer (${dbPattern === 'prisma-orm' ? 'Prisma ORM' : dbPattern === 'sqlalchemy' ? 'SQLAlchemy' : 'Mongoose'})`)
      flowSteps.push('Data layer queries database')
      layers.push('Database (PostgreSQL / MongoDB)')
    }

    const dataFlow = flowSteps.join(' → ')

    // ASCII diagram
    const diagramLines = layers.map((l, i) => {
      const prefix = i === 0 ? '┌─' : i === layers.length - 1 ? '└─' : '├─'
      const connector = i < layers.length - 1 ? '\n│' : ''
      return `${prefix} ${l}${connector}`
    })
    const dataFlowDiagram = diagramLines.join('\n')

    return {
      dataFlow,
      layers,
      hasMiddlewareLayer: hasAuthRequirement,
      dataFlowDiagram,
    }
  }

  protected fallback(_: DataFlowBrainInput): DataFlowBrainOutput {
    return { dataFlow: 'Input → Process → Output', layers: ['Service Layer'], hasMiddlewareLayer: false, dataFlowDiagram: '└─ Service Layer' }
  }
}
