/**
 * DependencyBrain — Determines exact npm/pip packages needed.
 * Zero API — rule-based dependency resolution from patterns.
 */

import { Brain, BrainContext } from '../../base/Brain'

export interface DependencyBrainInput {
  mainTechStack: string[]
  authPattern: string
  dbPattern: string
  apiPattern: string
  cssFramework: string
  language: 'typescript' | 'javascript' | 'python'
  pattern: string
}

export interface DependencyBrainOutput {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  packageJsonScripts: Record<string, string>
  envVariables: string[]
}

export class DependencyBrain extends Brain<DependencyBrainInput, DependencyBrainOutput> {
  readonly brainName = 'DependencyBrain'
  readonly orchestratorName = 'ArchitectureOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: DependencyBrainInput, _ctx: BrainContext): Promise<DependencyBrainOutput> {
    const { mainTechStack, authPattern, dbPattern, cssFramework, language, pattern } = input
    const stack = mainTechStack.map(s => s.toLowerCase())

    if (language === 'python') {
      return this.pythonDeps(input)
    }

    const deps: Record<string, string> = {}
    const devDeps: Record<string, string> = {}
    const envVars: string[] = ['NODE_ENV', 'PORT']

    // Base framework
    if (pattern === 'fullstack-next' || stack.includes('next.js')) {
      deps['next'] = '^15.0.0'
      deps['react'] = '^19.0.0'
      deps['react-dom'] = '^19.0.0'
    } else if (stack.includes('react')) {
      deps['react'] = '^19.0.0'
      deps['react-dom'] = '^19.0.0'
      devDeps['vite'] = '^6.0.0'
      devDeps['@vitejs/plugin-react'] = '^4.0.0'
    } else if (stack.some(s => s.includes('fastify') || s.includes('node'))) {
      deps['fastify'] = '^5.0.0'
      deps['@fastify/cors'] = '^10.0.0'
    } else if (stack.includes('express')) {
      deps['express'] = '^4.18.0'
      deps['cors'] = '^2.8.5'
    }

    // Database
    if (dbPattern === 'prisma-orm') {
      deps['@prisma/client'] = '^6.0.0'
      devDeps['prisma'] = '^6.0.0'
      envVars.push('DATABASE_URL')
    } else if (dbPattern === 'mongoose') {
      deps['mongoose'] = '^8.0.0'
      envVars.push('MONGODB_URI')
    }

    // Auth
    if (authPattern === 'jwt') {
      deps['jsonwebtoken'] = '^9.0.0'
      deps['bcrypt'] = '^5.1.0'
      devDeps['@types/jsonwebtoken'] = '^9.0.0'
      devDeps['@types/bcrypt'] = '^5.0.0'
      envVars.push('JWT_SECRET')
    } else if (authPattern === 'oauth' && pattern === 'fullstack-next') {
      deps['next-auth'] = '^5.0.0'
      envVars.push('NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')
    }

    // CSS
    if (cssFramework === 'Tailwind CSS') {
      devDeps['tailwindcss'] = '^4.0.0'
      devDeps['@tailwindcss/postcss'] = '^4.0.0'
    }

    // TypeScript
    devDeps['typescript'] = '^5.0.0'
    devDeps['@types/node'] = '^22.0.0'
    if (stack.some(s => s.includes('express'))) devDeps['@types/express'] = '^4.17.0'

    // Validation
    deps['zod'] = '^3.22.0'

    // Scripts
    const scripts: Record<string, string> = {
      dev: pattern === 'fullstack-next' ? 'next dev' : 'tsx watch src/index.ts',
      build: pattern === 'fullstack-next' ? 'next build' : 'tsc',
      start: pattern === 'fullstack-next' ? 'next start' : 'node dist/index.js',
    }
    if (dbPattern === 'prisma-orm') {
      scripts['db:push'] = 'prisma db push'
      scripts['db:generate'] = 'prisma generate'
      scripts['db:migrate'] = 'prisma migrate dev'
    }

    return { dependencies: deps, devDependencies: devDeps, packageJsonScripts: scripts, envVariables: [...new Set(envVars)] }
  }

  private pythonDeps(input: DependencyBrainInput): DependencyBrainOutput {
    return {
      dependencies: { fastapi: '>=0.115.0', uvicorn: '>=0.32.0', sqlalchemy: '>=2.0.0', pydantic: '>=2.0.0', 'python-jose': '>=3.3.0', passlib: '>=1.7.4' },
      devDependencies: { pytest: '>=8.0.0', httpx: '>=0.27.0' },
      packageJsonScripts: { start: 'uvicorn main:app --reload', test: 'pytest' },
      envVariables: ['DATABASE_URL', 'SECRET_KEY'],
    }
  }

  protected fallback(_: DependencyBrainInput): DependencyBrainOutput {
    return { dependencies: { zod: '^3.22.0' }, devDependencies: { typescript: '^5.0.0' }, packageJsonScripts: { build: 'tsc' }, envVariables: [] }
  }
}
