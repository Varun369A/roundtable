/**
 * ArchitectureBrain — Decides folder structure and architecture pattern.
 * Zero API — pure pattern matching from a built-in pattern library.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { TaskCategory, Complexity } from '../../understanding/intent/IntentBrain'

export interface ArchitectureBrainInput {
  goal: string
  primaryCategory: TaskCategory
  complexity: Complexity
  techStack: string[]
  hasAuthRequirement: boolean
  hasDatabaseRequirement: boolean
  hasAPIRequirement: boolean
  domain: string
}

export interface ArchitectureBrainOutput {
  pattern: 'fullstack-next' | 'api-only' | 'frontend-only' | 'fullstack-separate' | 'script' | 'library'
  folderStructure: string
  mainTechStack: string[]
  packageManager: 'npm' | 'pnpm' | 'yarn'
  language: 'typescript' | 'javascript' | 'python'
  framework: string
  cssFramework: string
}

// Pattern library — maps task characteristics to architecture
function selectPattern(input: ArchitectureBrainInput): ArchitectureBrainOutput['pattern'] {
  const { primaryCategory, hasAuthRequirement, hasDatabaseRequirement, hasAPIRequirement, goal } = input
  const lower = goal.toLowerCase()

  if (primaryCategory !== 'code') return 'script'

  const hasFrontend = /ui|frontend|interface|dashboard|page|website|app|portal/i.test(goal)
  const hasBackend = hasDatabaseRequirement || hasAPIRequirement || hasAuthRequirement

  if (hasFrontend && hasBackend) {
    // Check if Next.js is natural choice (full-stack)
    if (/next\.?js|nextjs/i.test(goal) || (!hasSeparateBackend(lower) && hasFrontend)) return 'fullstack-next'
    return 'fullstack-separate'
  }
  if (hasBackend && !hasFrontend) return 'api-only'
  if (hasFrontend && !hasBackend) return 'frontend-only'
  return 'script'
}

function hasSeparateBackend(lower: string): boolean {
  return /express|fastapi|django|nestjs|fastify|node.*server/i.test(lower)
}

function selectTechStack(input: ArchitectureBrainInput, pattern: string): string[] {
  const { techStack, goal } = input
  if (techStack.length > 0) return techStack  // user preference wins

  const lower = goal.toLowerCase()

  if (pattern === 'fullstack-next') return ['Next.js', 'TypeScript', 'Tailwind CSS', 'Prisma', 'PostgreSQL']
  if (pattern === 'api-only') {
    if (/python|fastapi|django/i.test(lower)) return ['Python', 'FastAPI', 'SQLAlchemy', 'PostgreSQL']
    return ['Node.js', 'TypeScript', 'Fastify', 'Prisma', 'PostgreSQL']
  }
  if (pattern === 'frontend-only') return ['React', 'TypeScript', 'Tailwind CSS', 'Vite']
  if (pattern === 'fullstack-separate') return ['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL']
  return ['Node.js', 'TypeScript']
}

function generateFolderStructure(pattern: string, stack: string[]): string {
  const structures: Record<string, string> = {
    'fullstack-next': `
src/
  app/
    (auth)/
      login/page.tsx
      signup/page.tsx
    (dashboard)/
      page.tsx
      layout.tsx
    api/
      auth/[...nextauth]/route.ts
      [feature]/route.ts
    layout.tsx
    page.tsx
  components/
    ui/
    forms/
    layout/
  lib/
    db.ts
    auth.ts
    utils.ts
  types/
    index.ts
prisma/
  schema.prisma
  migrations/
.env.example
next.config.ts
tailwind.config.ts
package.json
README.md`,

    'api-only': `
src/
  routes/
    index.ts
    [feature].ts
  services/
    [feature].service.ts
  middleware/
    auth.ts
    validation.ts
  lib/
    db.ts
    logger.ts
  types/
    index.ts
prisma/
  schema.prisma
.env.example
package.json
Dockerfile
README.md`,

    'frontend-only': `
src/
  components/
    ui/
    layout/
    [feature]/
  pages/ (or app/)
  hooks/
  utils/
  types/
  styles/
.env.example
package.json
README.md`,

    'script': `
src/
  index.ts
  lib/
    core.ts
  utils/
  types/
package.json
README.md`,
  }

  return structures[pattern] || structures['script']
}

export class ArchitectureBrain extends Brain<ArchitectureBrainInput, ArchitectureBrainOutput> {
  readonly brainName = 'ArchitectureBrain'
  readonly orchestratorName = 'ArchitectureOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: ArchitectureBrainInput, _ctx: BrainContext): Promise<ArchitectureBrainOutput> {
    const pattern = selectPattern(input)
    const mainTechStack = selectTechStack(input, pattern)
    const folderStructure = generateFolderStructure(pattern, mainTechStack)

    const lower = input.goal.toLowerCase()
    const language = /python|fastapi|django/i.test(lower) ? 'python' : 'typescript'
    const framework = pattern === 'fullstack-next' ? 'Next.js' :
      pattern === 'api-only' ? (/python/i.test(lower) ? 'FastAPI' : 'Fastify') :
      pattern === 'frontend-only' ? 'React + Vite' : 'Express'
    const cssFramework = language !== 'python' ? 'Tailwind CSS' : ''

    return {
      pattern,
      folderStructure,
      mainTechStack,
      packageManager: 'npm',
      language,
      framework,
      cssFramework,
    }
  }

  protected fallback(_: ArchitectureBrainInput): ArchitectureBrainOutput {
    return {
      pattern: 'script',
      folderStructure: 'src/\n  index.ts\npackage.json',
      mainTechStack: ['Node.js', 'TypeScript'],
      packageManager: 'npm',
      language: 'typescript',
      framework: 'Node.js',
      cssFramework: '',
    }
  }
}
