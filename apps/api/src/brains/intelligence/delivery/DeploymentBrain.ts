/**
 * DeploymentBrain — Generates Dockerfile, docker-compose, and CI/CD configs.
 * Zero API — template generation from stack analysis.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../../build/implementation/FileGeneratorBrain'

export interface DeploymentBrainInput {
  mainTechStack: string[]
  projectName: string
  envVariables: string[]
  hasDatabase: boolean
  architecturePattern: string
  packageJsonScripts: Record<string, string>
}

export interface DeploymentBrainOutput {
  dockerFiles: GeneratedFile[]
  ciFile: GeneratedFile | null
}

export class DeploymentBrain extends Brain<DeploymentBrainInput, DeploymentBrainOutput> {
  readonly brainName = 'DeploymentBrain'
  readonly orchestratorName = 'DeliveryOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: DeploymentBrainInput, _ctx: BrainContext): Promise<DeploymentBrainOutput> {
    const { mainTechStack, projectName, envVariables, hasDatabase, packageJsonScripts } = input
    const isNext = mainTechStack.some(t => t.toLowerCase().includes('next'))
    const isNode = mainTechStack.some(t => ['node', 'express', 'fastify', 'nestjs'].some(x => t.toLowerCase().includes(x)))
    const isPython = mainTechStack.some(t => t.toLowerCase().includes('python'))

    const dockerFiles: GeneratedFile[] = []

    // Dockerfile
    let dockerfileContent = ''
    if (isPython) {
      dockerfileContent = [
        'FROM python:3.11-slim',
        'WORKDIR /app',
        'COPY requirements.txt .',
        'RUN pip install --no-cache-dir -r requirements.txt',
        'COPY . .',
        'EXPOSE 8000',
        'CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]',
      ].join('\n')
    } else if (isNext) {
      dockerfileContent = [
        'FROM node:20-alpine AS base',
        '',
        '# Install dependencies',
        'FROM base AS deps',
        'RUN apk add --no-cache libc6-compat',
        'WORKDIR /app',
        'COPY package.json package-lock.json* ./',
        'RUN npm ci',
        '',
        '# Build',
        'FROM base AS builder',
        'WORKDIR /app',
        'COPY --from=deps /app/node_modules ./node_modules',
        'COPY . .',
        'RUN npm run build',
        '',
        '# Production image',
        'FROM base AS runner',
        'WORKDIR /app',
        'ENV NODE_ENV production',
        'COPY --from=builder /app/.next/standalone ./',
        'COPY --from=builder /app/.next/static ./.next/static',
        'COPY --from=builder /app/public ./public',
        'EXPOSE 3000',
        'CMD ["node", "server.js"]',
      ].join('\n')
    } else {
      // Node.js API
      const startScript = packageJsonScripts['start'] ? 'npm start' : 'node dist/index.js'
      dockerfileContent = [
        'FROM node:20-alpine AS builder',
        'WORKDIR /app',
        'COPY package.json package-lock.json* ./',
        'RUN npm ci',
        'COPY . .',
        'RUN npm run build 2>/dev/null || true',
        '',
        'FROM node:20-alpine AS runner',
        'WORKDIR /app',
        'ENV NODE_ENV production',
        'COPY --from=builder /app/node_modules ./node_modules',
        'COPY --from=builder /app/dist ./dist',
        'COPY --from=builder /app/package.json .',
        'EXPOSE 3001',
        `CMD ["${startScript.split(' ')[0]}", "${startScript.split(' ').slice(1).join('", "')}"]`,
      ].join('\n')
    }

    dockerFiles.push({
      path: 'Dockerfile',
      content: dockerfileContent,
      language: 'dockerfile',
      linesOfCode: dockerfileContent.split('\n').length,
      purpose: 'Docker container definition',
    })

    // .dockerignore
    const dockerignore = [
      'node_modules',
      '.next',
      '.git',
      '*.log',
      '.env',
      '.env.local',
      'coverage',
      'dist',
    ].join('\n')

    dockerFiles.push({
      path: '.dockerignore',
      content: dockerignore,
      language: 'plaintext',
      linesOfCode: dockerignore.split('\n').length,
      purpose: 'Docker build exclusions',
    })

    // docker-compose.yml
    const dbService = hasDatabase ? `
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${projectName.toLowerCase().replace(/\s+/g, '_')}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:` : ''

    const appEnv = envVariables.length > 0
      ? `    environment:\n${envVariables.map(v => `      - ${v}=\${${v}}`).join('\n')}`
      : ''

    const dbDep = hasDatabase ? `\n    depends_on:\n      - db` : ''

    const composeContent = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
${appEnv}${dbDep}
${dbService}
`.trim()

    dockerFiles.push({
      path: 'docker-compose.yml',
      content: composeContent,
      language: 'yaml',
      linesOfCode: composeContent.split('\n').length,
      purpose: 'Docker Compose for local development',
    })

    // GitHub Actions CI
    const ciContent = `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Test
        run: npm test --if-present
        env:
${envVariables.slice(0, 5).map(v => `          ${v}: \${{ secrets.${v} }}`).join('\n') || '          NODE_ENV: test'}
`

    const ciFile: GeneratedFile = {
      path: '.github/workflows/ci.yml',
      content: ciContent,
      language: 'yaml',
      linesOfCode: ciContent.split('\n').length,
      purpose: 'GitHub Actions CI pipeline',
    }

    return { dockerFiles, ciFile }
  }

  protected fallback(_: DeploymentBrainInput): DeploymentBrainOutput {
    return { dockerFiles: [], ciFile: null }
  }
}
