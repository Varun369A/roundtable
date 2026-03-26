/**
 * TestingBrain — Generates test files for the codebase.
 * Zero API — template-based test generation from API contracts.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../implementation/FileGeneratorBrain'
import type { APIEndpoint } from '../architecture/APIBrain'

export interface TestingBrainInput {
  generatedFiles: GeneratedFile[]
  endpoints: APIEndpoint[]
  hasAuthRequirement: boolean
}

export interface TestingBrainOutput {
  testFiles: GeneratedFile[]
  testCount: number
  coverageEstimate: number
}

export class TestingBrain extends Brain<TestingBrainInput, TestingBrainOutput> {
  readonly brainName = 'TestingBrain'
  readonly orchestratorName = 'QualityOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: TestingBrainInput, _ctx: BrainContext): Promise<TestingBrainOutput> {
    const { endpoints, hasAuthRequirement } = input
    const testFiles: GeneratedFile[] = []
    let testCount = 0

    if (endpoints.length > 0) {
      const testContent = this.generateAPITests(endpoints, hasAuthRequirement)
      testCount = endpoints.length * 2
      testFiles.push({
        path: 'src/__tests__/api.test.ts',
        content: testContent,
        language: 'typescript',
        linesOfCode: testContent.split('\n').length,
        purpose: 'API endpoint tests',
      })
    }

    return { testFiles, testCount, coverageEstimate: Math.min(80, testCount * 5) }
  }

  private generateAPITests(endpoints: APIEndpoint[], hasAuth: boolean): string {
    const lines = [
      `import { describe, it, expect, beforeAll } from 'vitest'`,
      ``,
      `const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'`,
      hasAuth ? `let authToken = ''` : '',
      ``,
    ]

    if (hasAuth) {
      lines.push(
        `beforeAll(async () => {`,
        `  const res = await fetch(\`\${BASE_URL}/api/auth/login\`, {`,
        `    method: 'POST',`,
        `    headers: { 'Content-Type': 'application/json' },`,
        `    body: JSON.stringify({ email: 'test@example.com', password: 'testpassword' }),`,
        `  })`,
        `  const data = await res.json()`,
        `  authToken = data.token || ''`,
        `})`,
        ``,
      )
    }

    for (const endpoint of endpoints.slice(0, 6)) {
      const testName = `${endpoint.method} ${endpoint.path}`
      lines.push(
        `describe('${testName}', () => {`,
        `  it('should return valid response', async () => {`,
        `    const res = await fetch(\`\${BASE_URL}${endpoint.path.replace(/:id/g, 'test-id')}\`, {`,
        `      method: '${endpoint.method}',`,
        `      headers: {`,
        `        'Content-Type': 'application/json',`,
        endpoint.requiresAuth ? `        'Authorization': \`Bearer \${authToken}\`,` : '',
        `      },`,
        endpoint.requestBody ? `      body: JSON.stringify({}),` : '',
        `    })`,
        `    expect(res.status).toBeLessThan(500)`,
        `  })`,
        `})`,
        ``,
      )
    }

    return lines.filter(l => l !== null).join('\n')
  }

  protected fallback(_: TestingBrainInput): TestingBrainOutput {
    return { testFiles: [], testCount: 0, coverageEstimate: 0 }
  }
}
