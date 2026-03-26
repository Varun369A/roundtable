/**
 * DatabaseBrain — Validates database schema and generates migration files.
 * Minimal AI (Groq) for complex schema generation if needed.
 * Falls back to template-based generation.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from './FileGeneratorBrain'
import type { DBModel } from '../architecture/SchemaBrain'

export interface DatabaseBrainInput {
  prismaSchema: string
  models: DBModel[]
  dbPattern: string
  generatedFiles: GeneratedFile[]
}

export interface DatabaseBrainOutput {
  schemaValid: boolean
  migrationFiles: GeneratedFile[]
  seedFile: GeneratedFile | null
  issues: string[]
}

export class DatabaseBrain extends Brain<DatabaseBrainInput, DatabaseBrainOutput> {
  readonly brainName = 'DatabaseBrain'
  readonly orchestratorName = 'ImplementationOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: DatabaseBrainInput, _ctx: BrainContext): Promise<DatabaseBrainOutput> {
    const { prismaSchema, models, dbPattern } = input
    const migrationFiles: GeneratedFile[] = []
    const issues: string[] = []

    if (dbPattern !== 'prisma-orm' || !prismaSchema) {
      return { schemaValid: true, migrationFiles: [], seedFile: null, issues: [] }
    }

    // Validate schema has required elements
    const hasGenerator = prismaSchema.includes('generator client')
    const hasDatasource = prismaSchema.includes('datasource db')
    if (!hasGenerator) issues.push('Missing generator client block in schema')
    if (!hasDatasource) issues.push('Missing datasource block in schema')

    // Generate seed file
    const seedContent = this.generateSeedFile(models)
    const seedFile: GeneratedFile = {
      path: 'prisma/seed.ts',
      content: seedContent,
      language: 'typescript',
      linesOfCode: seedContent.split('\n').length,
      purpose: 'Database seed file with sample data',
    }

    return {
      schemaValid: issues.length === 0,
      migrationFiles,
      seedFile,
      issues,
    }
  }

  private generateSeedFile(models: DBModel[]): string {
    const lines = [
      `import { PrismaClient } from '@prisma/client'`,
      ``,
      `const prisma = new PrismaClient()`,
      ``,
      `async function main() {`,
      `  console.log('Seeding database...')`,
      ``,
    ]

    for (const model of models.slice(0, 3)) {
      if (model.name === 'User') {
        lines.push(
          `  // Create sample user`,
          `  await prisma.user.upsert({`,
          `    where: { email: 'admin@example.com' },`,
          `    update: {},`,
          `    create: {`,
          `      email: 'admin@example.com',`,
          `      password: 'hashed_password_here', // use bcrypt in production`,
          `      name: 'Admin User',`,
          `    },`,
          `  })`,
          ``,
        )
      }
    }

    lines.push(
      `  console.log('Seeding complete.')`,
      `}`,
      ``,
      `main()`,
      `  .catch(console.error)`,
      `  .finally(() => prisma.$disconnect())`,
    )

    return lines.join('\n')
  }

  protected fallback(_: DatabaseBrainInput): DatabaseBrainOutput {
    return { schemaValid: true, migrationFiles: [], seedFile: null, issues: [] }
  }
}
