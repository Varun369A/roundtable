/**
 * FileGeneratorBrain — THE CORE BRAIN.
 * Generates one complete file at a time using Groq (Llama 3.3 70B, free tier).
 *
 * This is the only brain that uses AI.
 * All other context (architecture, schema, patterns) is pre-built by other brains
 * so prompts are focused and token-efficient.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { callGroq } from '../../../connectors/groq.connector'
import type { APIEndpoint } from '../architecture/APIBrain'
import type { DBModel } from '../architecture/SchemaBrain'

export interface FileDefinition {
  path: string
  purpose: string
  language: string
  dependsOn: string[]
}

export interface GeneratedFile {
  path: string
  content: string
  language: string
  linesOfCode: number
  purpose: string
}

export interface FileGeneratorBrainInput {
  goal: string
  fileManifest: FileDefinition[]
  mainTechStack: string[]
  authPattern: string
  dbPattern: string
  prismaSchema: string
  endpoints: APIEndpoint[]
  models: DBModel[]
  bestPractices: string[]
  patterns: Array<{ name: string; appliesTo: string }>
  injectedUserContext: string
  communicationDirective: { codeCommentDensity: string; explanationDepth: string }
  alreadyGeneratedFiles: GeneratedFile[]
}

export interface FileGeneratorBrainOutput {
  generatedFiles: GeneratedFile[]
  totalFiles: number
  totalLinesOfCode: number
}

export class FileGeneratorBrain extends Brain<FileGeneratorBrainInput, FileGeneratorBrainOutput> {
  readonly brainName = 'FileGeneratorBrain'
  readonly orchestratorName = 'ImplementationOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = true
  private _tokensUsed = 0

  protected getTokensUsed(): number { return this._tokensUsed }

  protected async process(input: FileGeneratorBrainInput, ctx: BrainContext): Promise<FileGeneratorBrainOutput> {
    const { fileManifest, alreadyGeneratedFiles } = input
    const generatedFiles: GeneratedFile[] = [...(alreadyGeneratedFiles ?? [])]

    // Process files in dependency order
    for (const fileDef of fileManifest) {
      // Skip if already generated
      if (generatedFiles.some(f => f.path === fileDef.path)) continue

      const prompt = this.buildPrompt(fileDef, generatedFiles, input)

      try {
        const content = await callGroq(prompt, { maxTokens: 6000 })
        this._tokensUsed += 6000

        const cleanedContent = this.extractCode(content, fileDef.path)
        generatedFiles.push({
          path: fileDef.path,
          content: cleanedContent,
          language: fileDef.language,
          linesOfCode: cleanedContent.split('\n').length,
          purpose: fileDef.purpose,
        })

        console.log(`[FileGeneratorBrain] Generated ${fileDef.path} (${cleanedContent.split('\n').length} lines) — task ${ctx.taskId}`)
      } catch (err) {
        console.error(`[FileGeneratorBrain] Failed to generate ${fileDef.path}:`, err)
        // Generate a stub file so the manifest is complete
        generatedFiles.push({
          path: fileDef.path,
          content: `// TODO: ${fileDef.purpose}\n// Generation failed — please implement manually\n`,
          language: fileDef.language,
          linesOfCode: 2,
          purpose: fileDef.purpose,
        })
      }
    }

    return {
      generatedFiles,
      totalFiles: generatedFiles.length,
      totalLinesOfCode: generatedFiles.reduce((sum, f) => sum + f.linesOfCode, 0),
    }
  }

  private buildPrompt(
    fileDef: FileDefinition,
    alreadyGenerated: GeneratedFile[],
    input: FileGeneratorBrainInput,
  ): string {
    const { goal, mainTechStack, authPattern, prismaSchema, endpoints, bestPractices, patterns, injectedUserContext, communicationDirective } = input

    const commentDensity = communicationDirective.codeCommentDensity
    const commentInstruction = commentDensity === 'heavy' ? 'Add detailed comments explaining every section.' :
      commentDensity === 'normal' ? 'Add comments for non-obvious logic.' :
      'Minimal comments — code should be self-documenting.'

    // Include relevant already-generated files as context
    const relevantGenerated = alreadyGenerated
      .filter(f => fileDef.dependsOn.includes(f.path) || fileDef.dependsOn.some(d => f.path.includes(d)))
      .slice(0, 3)
      .map(f => `// --- ${f.path} ---\n${f.content.slice(0, 800)}`)
      .join('\n\n')

    const schemaContext = prismaSchema ? `\nDatabase Schema (Prisma):\n\`\`\`prisma\n${prismaSchema.slice(0, 1000)}\n\`\`\`` : ''

    const endpointContext = endpoints.length > 0
      ? `\nAPI Endpoints:\n${endpoints.slice(0, 10).map(e => `${e.method} ${e.path} — ${e.description}`).join('\n')}`
      : ''

    const patternContext = patterns.length > 0
      ? `\nApply these patterns: ${patterns.map(p => p.name).join(', ')}`
      : ''

    const practicesContext = bestPractices.length > 0
      ? `\nBest practices to follow:\n${bestPractices.slice(0, 5).map(p => `- ${p}`).join('\n')}`
      : ''

    const relevantContext = relevantGenerated ? `\nRelated files already generated:\n${relevantGenerated}` : ''

    return `You are generating ONE specific file for a software project.

Project goal: ${goal}
Tech stack: ${mainTechStack.join(', ')}
Auth: ${authPattern}
${injectedUserContext ? `\n${injectedUserContext}` : ''}
${schemaContext}
${endpointContext}
${patternContext}
${practicesContext}
${relevantContext}

FILE TO GENERATE:
Path: ${fileDef.path}
Purpose: ${fileDef.purpose}
Language: ${fileDef.language}

STRICT REQUIREMENTS:
1. Output ONLY the complete file content — no explanations, no markdown
2. The file must be complete and immediately runnable
3. ${commentInstruction}
4. Do NOT truncate — write the complete implementation
5. Use the tech stack specified — do not add unlisted dependencies
6. Handle errors properly
7. Export the correct symbols that other files will import

Write the complete ${fileDef.path} file now:`
  }

  /**
   * Extracts raw code from the AI response.
   * Handles cases where the model wraps output in markdown fences.
   */
  private extractCode(content: string, filePath: string): string {
    // Try to strip markdown code fences if present
    const fenceMatch = content.match(/```(?:typescript|javascript|python|tsx|jsx|ts|js|prisma|yaml|json|bash)?\n([\s\S]+?)```/)
    if (fenceMatch) return fenceMatch[1].trim()

    // If no fences, return as-is (model followed instructions)
    return content.trim()
  }

  protected fallback(input: FileGeneratorBrainInput): FileGeneratorBrainOutput {
    const stubs = input.fileManifest.map(f => ({
      path: f.path,
      content: `// ${f.purpose}\n// TODO: implement\n`,
      language: f.language,
      linesOfCode: 2,
      purpose: f.purpose,
    }))
    return { generatedFiles: stubs, totalFiles: stubs.length, totalLinesOfCode: stubs.length * 2 }
  }
}
