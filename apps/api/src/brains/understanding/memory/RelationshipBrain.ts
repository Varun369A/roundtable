/**
 * RelationshipBrain — Trust level and account age.
 * Zero API — DB read.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface RelationshipBrainInput { userId: string }
export interface RelationshipBrainOutput {
  accountAgeDays: number
  trustLevel: 'new' | 'regular' | 'power'
  isFoundingMember: boolean
  tier: string
}

export class RelationshipBrain extends Brain<RelationshipBrainInput, RelationshipBrainOutput> {
  readonly brainName = 'RelationshipBrain'
  readonly orchestratorName = 'MemoryOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: RelationshipBrainInput, _ctx: BrainContext): Promise<RelationshipBrainOutput> {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { createdAt: true, tier: true, foundingMember: true },
    })

    const accountAgeDays = user
      ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    let trustLevel: 'new' | 'regular' | 'power' = 'new'
    if (accountAgeDays > 60 || user?.tier === 'ENTERPRISE') trustLevel = 'power'
    else if (accountAgeDays > 7) trustLevel = 'regular'

    return {
      accountAgeDays,
      trustLevel,
      isFoundingMember: user?.foundingMember || false,
      tier: user?.tier || 'FREE',
    }
  }

  protected fallback(_: RelationshipBrainInput): RelationshipBrainOutput {
    return { accountAgeDays: 0, trustLevel: 'new', isFoundingMember: false, tier: 'FREE' }
  }
}
