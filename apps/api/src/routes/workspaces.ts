import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { prisma } from '@sabha/db'
import { requireAuth } from '../middleware/auth'
import { PLANS } from '@sabha/types'
import type { UserTier, PlanId } from '@sabha/types'
import { isEnabled, FLAGS } from '../lib/feature-flags'
import { sendWorkspaceInviteEmail } from '../lib/email'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string, suffix: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + suffix
}

const TIER_TO_PLAN: Record<UserTier, PlanId> = {
  FREE: 'free', STARTER: 'starter', PRO: 'pro', POWER: 'power', ENTERPRISE: 'enterprise',
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
})

const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(200).optional(),
  settings: z.object({
    allowMemberInvite: z.boolean().optional(),
    defaultTaskVisibility: z.enum(['private', 'workspace']).optional(),
    requireApprovalForPublish: z.boolean().optional(),
  }).optional(),
})

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
})

const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function workspaceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // ─── GET /my — list workspaces the user belongs to ──────────────────────────
  app.get('/my', async (request, reply) => {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: request.user!.id, acceptedAt: { not: null } },
      include: {
        workspace: {
          include: {
            _count: { select: { members: true, tasks: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send({
      success: true,
      data: memberships.map((m) => ({
        ...m.workspace,
        role: m.role,
        memberCount: m.workspace._count.members,
        taskCount: m.workspace._count.tasks,
      })),
    })
  })

  // ─── POST / — create a team workspace ───────────────────────────────────────
  app.post('/', async (request, reply) => {
    const body = createWorkspaceSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const user = request.user!
    const plan = PLANS[TIER_TO_PLAN[user.tier as UserTier]]

    // Check team workspace eligibility
    if (plan.teamMembers === 1) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'PLAN_LIMIT',
          message: 'Team workspaces require Power plan or higher. Upgrade to collaborate.',
          details: { upgradeUrl: '/pricing' },
        },
      })
    }

    const suffix = randomBytes(3).toString('hex')
    const slug = toSlug(body.data.name, suffix)

    const workspace = await prisma.workspace.create({
      data: {
        name: body.data.name,
        description: body.data.description,
        slug,
        type: 'TEAM',
        ownerId: user.id,
      },
    })

    // Add creator as OWNER
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'OWNER',
        acceptedAt: new Date(),
      },
    })

    return reply.status(201).send({ success: true, data: workspace })
  })

  // ─── GET /:id — workspace details ───────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: request.params.id, userId: request.user!.id, acceptedAt: { not: null } },
      include: {
        workspace: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, tier: true } } },
              orderBy: { createdAt: 'asc' },
            },
            _count: { select: { tasks: true } },
          },
        },
      },
    })

    if (!membership) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      })
    }

    return reply.send({
      success: true,
      data: {
        ...membership.workspace,
        role: membership.role,
        taskCount: membership.workspace._count.tasks,
      },
    })
  })

  // ─── PATCH /:id — update workspace (ADMIN+) ─────────────────────────────────
  app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = updateWorkspaceSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: request.params.id, userId: request.user!.id },
    })

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins can update workspace settings' },
      })
    }

    const { settings, ...rest } = body.data
    const updateData: Record<string, unknown> = { ...rest }
    if (settings) {
      const existing = await prisma.workspace.findUnique({ where: { id: request.params.id }, select: { settings: true } })
      updateData.settings = { ...(existing?.settings as object || {}), ...settings }
    }

    const workspace = await prisma.workspace.update({
      where: { id: request.params.id },
      data: updateData,
    })

    return reply.send({ success: true, data: workspace })
  })

  // ─── DELETE /:id — delete workspace (OWNER only) ────────────────────────────
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: request.params.id, userId: request.user!.id, role: 'OWNER' },
    })

    if (!membership) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the workspace owner can delete it' },
      })
    }

    // Prevent deleting personal workspace
    const workspace = await prisma.workspace.findUnique({ where: { id: request.params.id } })
    if (workspace?.type === 'PERSONAL') {
      return reply.status(400).send({
        success: false,
        error: { code: 'CANNOT_DELETE_PERSONAL', message: 'Cannot delete your personal workspace' },
      })
    }

    await prisma.workspace.delete({ where: { id: request.params.id } })
    return reply.send({ success: true, data: { deleted: true } })
  })

  // ─── POST /:id/invite — invite a member ─────────────────────────────────────
  app.post<{ Params: { id: string } }>('/:id/invite', async (request, reply) => {
    const body = inviteMemberSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: request.params.id, userId: request.user!.id },
    })

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins can invite members' },
      })
    }

    // Check team size limit
    const user = request.user!
    const plan = PLANS[TIER_TO_PLAN[user.tier as UserTier]]
    if (plan.teamMembers !== -1) {
      const currentCount = await prisma.workspaceMember.count({
        where: { workspaceId: request.params.id, acceptedAt: { not: null } },
      })
      if (currentCount >= plan.teamMembers) {
        return reply.status(403).send({
          success: false,
          error: { code: 'TEAM_LIMIT_REACHED', message: `Your plan allows up to ${plan.teamMembers} members. Upgrade for more.` },
        })
      }
    }

    // Check if already a member
    const inviteeUser = await prisma.user.findUnique({ where: { email: body.data.email }, select: { id: true } })
    if (inviteeUser) {
      const existing = await prisma.workspaceMember.findFirst({
        where: { workspaceId: request.params.id, userId: inviteeUser.id },
      })
      if (existing?.acceptedAt) {
        return reply.status(409).send({
          success: false,
          error: { code: 'ALREADY_MEMBER', message: 'This user is already a workspace member' },
        })
      }
    }

    // Create invite token
    const token = randomBytes(32).toString('hex')
    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId: request.params.id,
        email: body.data.email,
        role: body.data.role,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        invitedById: request.user!.id,
      },
    })

    const inviteUrl = `${process.env.WEB_URL || 'https://sabhaai.com'}/workspace/join?token=${token}`

    // Send invite email if enabled (non-blocking)
    if (await isEnabled(FLAGS.EMAIL_NOTIFICATIONS)) {
      const [inviter, workspace] = await Promise.all([
        prisma.user.findUnique({ where: { id: request.user!.id }, select: { name: true } }),
        prisma.workspace.findUnique({ where: { id: request.params.id }, select: { name: true } }),
      ])
      if (inviter && workspace) {
        sendWorkspaceInviteEmail({
          to: body.data.email,
          inviterName: inviter.name,
          workspaceName: workspace.name,
          role: body.data.role,
          inviteUrl,
          expiresAt: invite.expiresAt,
        }).catch(() => {})
      }
    }

    return reply.status(201).send({
      success: true,
      data: {
        inviteId: invite.id,
        email: body.data.email,
        role: body.data.role,
        inviteToken: token,
        inviteUrl,
        expiresAt: invite.expiresAt,
      },
    })
  })

  // ─── POST /join — accept an invite ──────────────────────────────────────────
  app.post<{ Body: { token: string } }>('/join', async (request, reply) => {
    const { token } = (request.body as { token: string }) || {}
    if (!token) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Invite token is required' },
      })
    }

    const invite = await prisma.workspaceInvite.findUnique({ where: { token } })

    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INVITE', message: 'This invite is invalid, already used, or expired' },
      })
    }

    const user = request.user!

    // Verify email matches
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return reply.status(403).send({
        success: false,
        error: { code: 'EMAIL_MISMATCH', message: 'This invite was sent to a different email address' },
      })
    }

    // Create membership
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
      update: { role: invite.role, acceptedAt: new Date() },
      create: {
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: invite.role,
        invitedBy: invite.invitedById,
        acceptedAt: new Date(),
      },
    })

    // Mark invite as accepted
    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    })

    // Switch user to this workspace
    await prisma.user.update({
      where: { id: user.id },
      data: { currentWorkspaceId: invite.workspaceId },
    })

    return reply.send({
      success: true,
      data: { workspaceId: invite.workspaceId, role: invite.role },
    })
  })

  // ─── PATCH /:id/members/:userId — update member role ───────────────────────
  app.patch<{ Params: { id: string; userId: string } }>('/:id/members/:userId', async (request, reply) => {
    const body = updateMemberRoleSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    const myMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: request.params.id, userId: request.user!.id },
    })

    if (!myMembership || myMembership.role !== 'OWNER') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the workspace owner can change member roles' },
      })
    }

    // Can't demote yourself as owner
    if (request.params.userId === request.user!.id) {
      return reply.status(400).send({
        success: false,
        error: { code: 'CANNOT_CHANGE_OWN_ROLE', message: 'You cannot change your own role' },
      })
    }

    await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: request.params.id, userId: request.params.userId } },
      data: { role: body.data.role },
    })

    return reply.send({ success: true, data: { updated: true } })
  })

  // ─── DELETE /:id/members/:userId — remove member ────────────────────────────
  app.delete<{ Params: { id: string; userId: string } }>('/:id/members/:userId', async (request, reply) => {
    const myMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: request.params.id, userId: request.user!.id },
    })

    const isRemovingSelf = request.params.userId === request.user!.id
    const canRemove = myMembership && (['OWNER', 'ADMIN'].includes(myMembership.role) || isRemovingSelf)

    if (!canRemove) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You cannot remove this member' },
      })
    }

    // Can't remove the owner
    const targetMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: request.params.id, userId: request.params.userId },
    })
    if (targetMembership?.role === 'OWNER') {
      return reply.status(400).send({
        success: false,
        error: { code: 'CANNOT_REMOVE_OWNER', message: 'Cannot remove the workspace owner' },
      })
    }

    await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId: request.params.id, userId: request.params.userId } },
    })

    return reply.send({ success: true, data: { removed: true } })
  })

  // ─── PUT /current — switch active workspace ──────────────────────────────────
  app.put<{ Body: { workspaceId: string } }>('/current', async (request, reply) => {
    const { workspaceId } = (request.body as { workspaceId: string }) || {}

    if (!workspaceId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_FIELD', message: 'workspaceId is required' },
      })
    }

    // Verify membership
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: request.user!.id, acceptedAt: { not: null } },
    })

    if (!membership) {
      return reply.status(403).send({
        success: false,
        error: { code: 'WORKSPACE_ACCESS_DENIED', message: 'You are not a member of this workspace' },
      })
    }

    await prisma.user.update({
      where: { id: request.user!.id },
      data: { currentWorkspaceId: workspaceId },
    })

    return reply.send({ success: true, data: { currentWorkspaceId: workspaceId } })
  })
}
