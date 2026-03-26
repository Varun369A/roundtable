/**
 * SchemaBrain — Defines database models and relationships.
 * Zero API — derived from requirements, domain, and API endpoints.
 */

import { Brain, BrainContext } from '../../base/Brain'

export interface SchemaBrainInput {
  goal: string
  domain: string
  hasAuthRequirement: boolean
  hasDatabaseRequirement: boolean
  dbPattern: string
  endpoints: Array<{ path: string; method: string }>
}

export interface DBModel {
  name: string
  fields: DBField[]
  relationships: string[]
}

export interface DBField {
  name: string
  type: string
  required: boolean
  unique?: boolean
  default?: string
}

export interface SchemaBrainOutput {
  models: DBModel[]
  prismaSchema: string    // ready-to-use Prisma schema (if prisma stack)
  hasUserModel: boolean
}

const DOMAIN_MODELS: Record<string, DBModel[]> = {
  healthcare: [
    { name: 'Patient', fields: [{ name: 'id', type: 'String', required: true, default: 'cuid()' }, { name: 'name', type: 'String', required: true }, { name: 'email', type: 'String', required: true, unique: true }, { name: 'phone', type: 'String', required: false }, { name: 'createdAt', type: 'DateTime', required: true, default: 'now()' }], relationships: ['appointments: Appointment[]'] },
    { name: 'Doctor', fields: [{ name: 'id', type: 'String', required: true, default: 'cuid()' }, { name: 'name', type: 'String', required: true }, { name: 'specialization', type: 'String', required: true }, { name: 'email', type: 'String', required: true, unique: true }], relationships: ['appointments: Appointment[]'] },
    { name: 'Appointment', fields: [{ name: 'id', type: 'String', required: true, default: 'cuid()' }, { name: 'patientId', type: 'String', required: true }, { name: 'doctorId', type: 'String', required: true }, { name: 'scheduledAt', type: 'DateTime', required: true }, { name: 'status', type: 'String', required: true, default: '"PENDING"' }, { name: 'notes', type: 'String', required: false }], relationships: ['patient: Patient', 'doctor: Doctor'] },
  ],
  ecommerce: [
    { name: 'Product', fields: [{ name: 'id', type: 'String', required: true, default: 'cuid()' }, { name: 'name', type: 'String', required: true }, { name: 'price', type: 'Decimal', required: true }, { name: 'stock', type: 'Int', required: true, default: '0' }, { name: 'description', type: 'String', required: false }], relationships: ['orderItems: OrderItem[]'] },
    { name: 'Order', fields: [{ name: 'id', type: 'String', required: true, default: 'cuid()' }, { name: 'userId', type: 'String', required: true }, { name: 'total', type: 'Decimal', required: true }, { name: 'status', type: 'String', required: true, default: '"PENDING"' }, { name: 'createdAt', type: 'DateTime', required: true, default: 'now()' }], relationships: ['items: OrderItem[]', 'user: User'] },
  ],
  general: [
    { name: 'Item', fields: [{ name: 'id', type: 'String', required: true, default: 'cuid()' }, { name: 'title', type: 'String', required: true }, { name: 'description', type: 'String', required: false }, { name: 'createdAt', type: 'DateTime', required: true, default: 'now()' }, { name: 'updatedAt', type: 'DateTime', required: true, default: 'now()' }], relationships: [] },
  ],
}

const USER_MODEL: DBModel = {
  name: 'User',
  fields: [
    { name: 'id', type: 'String', required: true, default: 'cuid()' },
    { name: 'email', type: 'String', required: true, unique: true },
    { name: 'password', type: 'String', required: true },
    { name: 'name', type: 'String', required: false },
    { name: 'createdAt', type: 'DateTime', required: true, default: 'now()' },
    { name: 'updatedAt', type: 'DateTime', required: true, default: 'now()' },
  ],
  relationships: [],
}

function generatePrismaSchema(models: DBModel[]): string {
  const lines: string[] = [
    'generator client {',
    '  provider = "prisma-client-js"',
    '}',
    '',
    'datasource db {',
    '  provider = "postgresql"',
    '  url      = env("DATABASE_URL")',
    '}',
    '',
  ]

  for (const model of models) {
    lines.push(`model ${model.name} {`)
    for (const field of model.fields) {
      const optional = field.required ? '' : '?'
      const defaultVal = field.default ? ` @default(${field.default})` : ''
      const unique = field.unique ? ' @unique' : ''
      const id = field.name === 'id' ? ' @id' : ''
      lines.push(`  ${field.name}  ${field.type}${optional}${id}${unique}${defaultVal}`)
    }
    if (model.relationships.length > 0) {
      lines.push('')
      for (const rel of model.relationships) {
        lines.push(`  ${rel}`)
      }
    }
    lines.push('}')
    lines.push('')
  }

  return lines.join('\n')
}

export class SchemaBrain extends Brain<SchemaBrainInput, SchemaBrainOutput> {
  readonly brainName = 'SchemaBrain'
  readonly orchestratorName = 'ArchitectureOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: SchemaBrainInput, _ctx: BrainContext): Promise<SchemaBrainOutput> {
    const { hasAuthRequirement, hasDatabaseRequirement, domain, dbPattern } = input

    if (!hasDatabaseRequirement) {
      return { models: [], prismaSchema: '', hasUserModel: false }
    }

    const domainModels = DOMAIN_MODELS[domain] || DOMAIN_MODELS.general
    const models: DBModel[] = []

    if (hasAuthRequirement) models.push(USER_MODEL)
    models.push(...domainModels)

    const prismaSchema = dbPattern === 'prisma-orm' ? generatePrismaSchema(models) : ''

    return {
      models,
      prismaSchema,
      hasUserModel: hasAuthRequirement,
    }
  }

  protected fallback(_: SchemaBrainInput): SchemaBrainOutput {
    return { models: [], prismaSchema: '', hasUserModel: false }
  }
}
