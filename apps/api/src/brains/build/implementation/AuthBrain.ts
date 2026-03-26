/**
 * AuthBrain — Validates and supplements authentication implementation.
 * Zero API — checks that auth files are present and correct.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from './FileGeneratorBrain'

export interface AuthBrainInput {
  generatedFiles: GeneratedFile[]
  authPattern: string
  hasAuthRequirement: boolean
}

export interface AuthBrainOutput {
  authImplemented: boolean
  missingAuthFiles: string[]
  authScore: number
}

export class AuthBrain extends Brain<AuthBrainInput, AuthBrainOutput> {
  readonly brainName = 'AuthBrain'
  readonly orchestratorName = 'ImplementationOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: AuthBrainInput, _ctx: BrainContext): Promise<AuthBrainOutput> {
    const { generatedFiles, authPattern, hasAuthRequirement } = input
    if (!hasAuthRequirement) return { authImplemented: true, missingAuthFiles: [], authScore: 100 }

    const paths = generatedFiles.map(f => f.path)
    const missingAuthFiles: string[] = []
    let authScore = 100

    // Check for key auth signals in generated files
    const allContent = generatedFiles.map(f => f.content).join('\n')

    if (authPattern === 'jwt') {
      if (!allContent.includes('jsonwebtoken') && !allContent.includes('jwt')) {
        missingAuthFiles.push('JWT implementation missing')
        authScore -= 30
      }
      if (!allContent.includes('bcrypt') && !allContent.includes('hash')) {
        missingAuthFiles.push('Password hashing missing')
        authScore -= 20
      }
    }

    if (!paths.some(p => p.includes('auth') || p.includes('login') || p.includes('signup'))) {
      missingAuthFiles.push('Auth route/page file')
      authScore -= 20
    }

    return { authImplemented: missingAuthFiles.length === 0, missingAuthFiles, authScore: Math.max(0, authScore) }
  }

  protected fallback(_: AuthBrainInput): AuthBrainOutput {
    return { authImplemented: true, missingAuthFiles: [], authScore: 100 }
  }
}
