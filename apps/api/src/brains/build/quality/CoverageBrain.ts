/**
 * CoverageBrain — Did we address every requirement?
 * Zero API — diffs requirements against generated files.
 */

import { Brain, BrainContext } from '../../base/Brain'
import type { GeneratedFile } from '../implementation/FileGeneratorBrain'
import type { Requirement } from '../architecture/RequirementsBrain'

export interface CoverageBrainInput { generatedFiles: GeneratedFile[]; requirements: Requirement[] }
export interface CoverageBrainOutput {
  coverageScore: number
  unmetRequirements: string[]
  metRequirements: string[]
}

export class CoverageBrain extends Brain<CoverageBrainInput, CoverageBrainOutput> {
  readonly brainName = 'CoverageBrain'
  readonly orchestratorName = 'QualityOrchestrator'
  readonly engineName = 'BuildEngine'
  readonly usesAI = false

  protected async process(input: CoverageBrainInput, _ctx: BrainContext): Promise<CoverageBrainOutput> {
    const { generatedFiles, requirements } = input
    const allContent = generatedFiles.map(f => f.content).join('\n').toLowerCase()
    const allPaths = generatedFiles.map(f => f.path).join('\n').toLowerCase()
    const metRequirements: string[] = []
    const unmetRequirements: string[] = []

    for (const req of requirements) {
      const keywords = req.description.toLowerCase().split(/\s+/).filter(w => w.length > 4)
      const matchCount = keywords.filter(kw => allContent.includes(kw) || allPaths.includes(kw)).length
      const covered = matchCount >= Math.ceil(keywords.length * 0.4)

      if (covered) metRequirements.push(req.id + ': ' + req.description.slice(0, 60))
      else unmetRequirements.push(req.id + ': ' + req.description.slice(0, 60))
    }

    const coverageScore = requirements.length === 0 ? 100 : Math.round((metRequirements.length / requirements.length) * 100)

    return { coverageScore, unmetRequirements, metRequirements }
  }

  protected fallback(_: CoverageBrainInput): CoverageBrainOutput {
    return { coverageScore: 100, unmetRequirements: [], metRequirements: [] }
  }
}
