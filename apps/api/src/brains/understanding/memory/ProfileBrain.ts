/**
 * ProfileBrain — Reads user profile: name, role, industry, domain expertise.
 * Zero API — DB read.
 */

import { Brain, BrainContext } from '../../base/Brain'
import { prisma } from '@arivarangam/db'

export interface ProfileBrainInput { userId: string }
export interface ProfileBrainOutput {
  name: string
  role: string
  industry: string
  location: string
  timezone: string
  businessName: string
}

const PROFILE_KEYS = ['name', 'role', 'industry', 'location', 'timezone', 'business_name', 'business_type']

export class ProfileBrain extends Brain<ProfileBrainInput, ProfileBrainOutput> {
  readonly brainName = 'ProfileBrain'
  readonly orchestratorName = 'MemoryOrchestrator'
  readonly engineName = 'UnderstandingEngine'
  readonly usesAI = false

  protected async process(input: ProfileBrainInput, _ctx: BrainContext): Promise<ProfileBrainOutput> {
    const [memories, user] = await Promise.all([
      prisma.userMemory.findMany({ where: { userId: input.userId, key: { in: PROFILE_KEYS }, isActive: true } }),
      prisma.user.findUnique({ where: { id: input.userId }, select: { name: true, email: true } }),
    ])

    const get = (key: string) => memories.find(m => m.key === key)?.value || ''

    return {
      name: get('name') || user?.name || '',
      role: get('role') || '',
      industry: get('industry') || '',
      location: get('location') || '',
      timezone: get('timezone') || 'Asia/Kolkata',
      businessName: get('business_name') || '',
    }
  }

  protected fallback(_: ProfileBrainInput): ProfileBrainOutput {
    return { name: '', role: '', industry: '', location: '', timezone: 'Asia/Kolkata', businessName: '' }
  }
}
