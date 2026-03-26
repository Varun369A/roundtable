/**
 * FixGeneratorBrain — Generates code patches for auto-fixable errors.
 * Zero API — pattern-based code transformation.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../../build/implementation/FileGeneratorBrain'
import type { ClassifiedError } from './ErrorClassificationBrain'

export interface FixGeneratorBrainInput {
  autoFixable: ClassifiedError[]
  generatedFiles: GeneratedFile[]
}

export interface AppliedFix {
  file: string
  type: string
  line: number
  original: string
  fixed: string
  applied: boolean
}

export interface FixGeneratorBrainOutput {
  fixedFiles: GeneratedFile[]
  appliedFixes: AppliedFix[]
  fixCount: number
}

export class FixGeneratorBrain extends Brain<FixGeneratorBrainInput, FixGeneratorBrainOutput> {
  readonly brainName = 'FixGeneratorBrain'
  readonly orchestratorName = 'ErrorOrchestrator'
  readonly engineName = 'IntelligenceEngine'
  readonly usesAI = false

  protected async process(input: FixGeneratorBrainInput, _ctx: BrainContext): Promise<FixGeneratorBrainOutput> {
    const { autoFixable, generatedFiles } = input

    // Build a map for fast file lookup
    const fileMap = new Map<string, GeneratedFile>(generatedFiles.map(f => [f.path, f]))
    const appliedFixes: AppliedFix[] = []

    // Group fixes by file
    const fixesByFile = new Map<string, ClassifiedError[]>()
    for (const fix of autoFixable) {
      if (!fixesByFile.has(fix.file)) fixesByFile.set(fix.file, [])
      fixesByFile.get(fix.file)!.push(fix)
    }

    for (const [filePath, fixes] of fixesByFile) {
      const file = fileMap.get(filePath)
      if (!file) continue

      let lines = file.content.split('\n')

      for (const fix of fixes) {
        const lineIdx = fix.line - 1
        if (lineIdx < 0 || lineIdx >= lines.length) continue
        const originalLine = lines[lineIdx]
        const fixedLine = this.applyFix(fix.type, originalLine)

        if (fixedLine !== originalLine) {
          lines[lineIdx] = fixedLine
          appliedFixes.push({
            file: filePath,
            type: fix.type,
            line: fix.line,
            original: originalLine.trim(),
            fixed: fixedLine.trim(),
            applied: true,
          })
        }
      }

      const newContent = lines.join('\n')
      fileMap.set(filePath, {
        ...file,
        content: newContent,
        linesOfCode: lines.length,
      })
    }

    return {
      fixedFiles: Array.from(fileMap.values()),
      appliedFixes,
      fixCount: appliedFixes.length,
    }
  }

  private applyFix(type: string, line: string): string {
    switch (type) {
      case 'STRING_THROW': {
        // throw "message" → throw new Error("message")
        return line.replace(/throw\s+(['"`])(.*?)\1/, 'throw new Error($1$2$1)')
      }
      case 'EMPTY_CATCH': {
        // catch(e) {} → catch(e) { throw e }
        return line.replace(/catch\s*\((\w+)\)\s*\{\s*\}/, 'catch($1) { throw $1 }')
      }
      case 'ENV_NO_DEFAULT': {
        // process.env.VAR → process.env.VAR ?? ''
        return line.replace(/(process\.env\.\w+)(?!\s*\?\?)(?!\s*\|\|)(?!\s*!)/, '$1 ?? \'\'')
      }
      case 'UNHANDLED_PROMISE': {
        // .then(fn) → .then(fn).catch(console.error)
        return line.replace(/\.then\(([^)]+)\)\s*$/, '.then($1).catch(console.error)')
      }
      default:
        return line
    }
  }

  protected fallback(input: FixGeneratorBrainInput): FixGeneratorBrainOutput {
    return { fixedFiles: input.generatedFiles, appliedFixes: [], fixCount: 0 }
  }
}
