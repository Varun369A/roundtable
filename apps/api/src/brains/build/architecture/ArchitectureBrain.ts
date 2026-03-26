/**
 * ArchitectureBrain — Decides folder structure and architecture pattern.
 * Zero API — pure pattern matching from a built-in pattern library.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { TaskCategory, Complexity } from '../../understanding/intent/IntentBrain'
import type { FileDefinition } from '../implementation/FileGeneratorBrain'

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
  fileManifest: FileDefinition[]
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

function generateFileManifest(pattern: string, language: string, hasAuth: boolean, hasDatabase: boolean): FileDefinition[] {
  const ext = language === 'python' ? 'py' : 'ts'
  const tsx = language === 'python' ? 'py' : 'tsx'

  const common: FileDefinition[] = [
    { path: '.env.example', purpose: 'Environment variable template', language: 'bash', dependsOn: [] },
    { path: 'README.md', purpose: 'Project documentation and setup instructions', language: 'markdown', dependsOn: [] },
  ]

  if (pattern === 'fullstack-next') {
    const files: FileDefinition[] = [
      { path: 'package.json', purpose: 'Project dependencies and scripts', language: 'json', dependsOn: [] },
      { path: 'next.config.ts', purpose: 'Next.js configuration', language: 'typescript', dependsOn: [] },
      { path: 'tailwind.config.ts', purpose: 'Tailwind CSS configuration', language: 'typescript', dependsOn: [] },
      { path: 'src/app/layout.tsx', purpose: 'Root layout with providers', language: 'tsx', dependsOn: ['src/lib/auth.ts'] },
      { path: 'src/app/page.tsx', purpose: 'Home page', language: 'tsx', dependsOn: [] },
      { path: 'src/app/(dashboard)/page.tsx', purpose: 'Dashboard main page', language: 'tsx', dependsOn: ['src/lib/db.ts'] },
      { path: 'src/app/(dashboard)/layout.tsx', purpose: 'Dashboard layout with sidebar', language: 'tsx', dependsOn: [] },
      { path: 'src/lib/db.ts', purpose: 'Prisma database client singleton', language: 'typescript', dependsOn: [] },
      { path: 'src/lib/utils.ts', purpose: 'Shared utility functions', language: 'typescript', dependsOn: [] },
      { path: 'src/types/index.ts', purpose: 'Shared TypeScript type definitions', language: 'typescript', dependsOn: [] },
    ]
    if (hasAuth) {
      files.push(
        { path: 'src/lib/auth.ts', purpose: 'NextAuth configuration and session helpers', language: 'typescript', dependsOn: ['src/lib/db.ts'] },
        { path: 'src/app/(auth)/login/page.tsx', purpose: 'Login page', language: 'tsx', dependsOn: ['src/lib/auth.ts'] },
        { path: 'src/app/(auth)/signup/page.tsx', purpose: 'Signup page', language: 'tsx', dependsOn: ['src/lib/auth.ts'] },
        { path: 'src/app/api/auth/[...nextauth]/route.ts', purpose: 'NextAuth API route handler', language: 'typescript', dependsOn: ['src/lib/auth.ts'] },
      )
    }
    if (hasDatabase) {
      files.push({ path: 'prisma/schema.prisma', purpose: 'Prisma database schema', language: 'prisma', dependsOn: [] })
    }
    return [...files, ...common]
  }

  if (pattern === 'api-only') {
    const files: FileDefinition[] = [
      { path: 'package.json', purpose: 'Project dependencies and scripts', language: 'json', dependsOn: [] },
      { path: `src/server.${ext}`, purpose: 'HTTP server entry point', language: 'typescript', dependsOn: [`src/routes/index.${ext}`] },
      { path: `src/routes/index.${ext}`, purpose: 'Route registration and router setup', language: 'typescript', dependsOn: [] },
      { path: `src/routes/health.${ext}`, purpose: 'Health check endpoint', language: 'typescript', dependsOn: [] },
      { path: `src/middleware/validation.${ext}`, purpose: 'Request validation middleware', language: 'typescript', dependsOn: [] },
      { path: `src/lib/logger.${ext}`, purpose: 'Logging configuration', language: 'typescript', dependsOn: [] },
      { path: `src/types/index.${ext}`, purpose: 'Shared TypeScript type definitions', language: 'typescript', dependsOn: [] },
    ]
    if (hasAuth) {
      files.push(
        { path: `src/routes/auth.${ext}`, purpose: 'Authentication endpoints (login, signup, refresh)', language: 'typescript', dependsOn: [`src/middleware/auth.${ext}`, `src/lib/db.${ext}`] },
        { path: `src/middleware/auth.${ext}`, purpose: 'JWT authentication middleware', language: 'typescript', dependsOn: [] },
      )
    }
    if (hasDatabase) {
      files.push(
        { path: `src/lib/db.${ext}`, purpose: 'Database client singleton', language: 'typescript', dependsOn: [] },
        { path: 'prisma/schema.prisma', purpose: 'Prisma database schema', language: 'prisma', dependsOn: [] },
      )
    }
    files.push({ path: 'Dockerfile', purpose: 'Docker container configuration', language: 'dockerfile', dependsOn: [] })
    return [...files, ...common]
  }

  if (pattern === 'frontend-only') {
    return [
      { path: 'package.json', purpose: 'Project dependencies and scripts', language: 'json', dependsOn: [] },
      { path: 'vite.config.ts', purpose: 'Vite build configuration', language: 'typescript', dependsOn: [] },
      { path: 'tailwind.config.ts', purpose: 'Tailwind CSS configuration', language: 'typescript', dependsOn: [] },
      { path: `src/main.${tsx}`, purpose: 'Application entry point', language: 'tsx', dependsOn: [] },
      { path: `src/App.${tsx}`, purpose: 'Root application component with routing', language: 'tsx', dependsOn: [] },
      { path: `src/components/ui/Button.${tsx}`, purpose: 'Reusable button component', language: 'tsx', dependsOn: [] },
      { path: `src/hooks/index.${ext}`, purpose: 'Custom React hooks', language: 'typescript', dependsOn: [] },
      { path: `src/utils/index.${ext}`, purpose: 'Utility functions', language: 'typescript', dependsOn: [] },
      { path: `src/types/index.${ext}`, purpose: 'TypeScript type definitions', language: 'typescript', dependsOn: [] },
      ...common,
    ]
  }

  if (pattern === 'fullstack-separate') {
    return [
      { path: 'package.json', purpose: 'Root workspace package.json', language: 'json', dependsOn: [] },
      { path: `backend/src/server.${ext}`, purpose: 'Express server entry point', language: 'typescript', dependsOn: [] },
      { path: `backend/src/routes/index.${ext}`, purpose: 'API route registration', language: 'typescript', dependsOn: [] },
      { path: `backend/src/lib/db.${ext}`, purpose: 'Database client', language: 'typescript', dependsOn: [] },
      { path: 'backend/prisma/schema.prisma', purpose: 'Database schema', language: 'prisma', dependsOn: [] },
      { path: `frontend/src/App.${tsx}`, purpose: 'React app root', language: 'tsx', dependsOn: [] },
      { path: `frontend/src/main.${tsx}`, purpose: 'React entry point', language: 'tsx', dependsOn: [] },
      { path: `frontend/src/api/client.${ext}`, purpose: 'API client for backend calls', language: 'typescript', dependsOn: [] },
      ...common,
    ]
  }

  // script / library
  return [
    { path: 'package.json', purpose: 'Project dependencies and scripts', language: 'json', dependsOn: [] },
    { path: `src/index.${ext}`, purpose: 'Main entry point', language: 'typescript', dependsOn: [`src/lib/core.${ext}`] },
    { path: `src/lib/core.${ext}`, purpose: 'Core business logic', language: 'typescript', dependsOn: [] },
    { path: `src/types/index.${ext}`, purpose: 'Type definitions', language: 'typescript', dependsOn: [] },
    ...common,
  ]
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

    const fileManifest = generateFileManifest(pattern, language, input.hasAuthRequirement, input.hasDatabaseRequirement)

    return {
      pattern,
      folderStructure,
      fileManifest,
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
      fileManifest: [
        { path: 'src/index.ts', purpose: 'Main entry point', language: 'typescript', dependsOn: [] },
        { path: 'package.json', purpose: 'Project dependencies', language: 'json', dependsOn: [] },
        { path: 'README.md', purpose: 'Project documentation', language: 'markdown', dependsOn: [] },
      ],
      mainTechStack: ['Node.js', 'TypeScript'],
      packageManager: 'npm',
      language: 'typescript',
      framework: 'Node.js',
      cssFramework: '',
    }
  }
}
