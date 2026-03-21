import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@sabha/db'

/**
 * Resolves the active workspace for the current user.
 * Attaches `request.workspace` with the workspace and the user's role in it.
 *
 * Accepts workspace ID via:
 *   1. `X-Workspace-Id` header
 *   2. `workspaceId` query param
 *
 * Falls back to the user's `currentWorkspaceId` (personal workspace).
 * Must run AFTER requireAuth.
 */
export async function resolveWorkspace(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.user
  if (!user) return // requireAuth handles this

  const workspaceId =
    (request.headers['x-workspace-id'] as string) ||
    (request.query as Record<string, string>)?.workspaceId ||
    user.currentWorkspaceId

  if (!workspaceId) {
    // No workspace set — fall through to personal context
    return
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: user.id,
      acceptedAt: { not: null },
    },
    include: {
      workspace: true,
    },
  })

  if (!membership) {
    reply.status(403).send({
      success: false,
      error: { code: 'WORKSPACE_ACCESS_DENIED', message: 'You do not have access to this workspace' },
    })
    return
  }

  ;(request as { workspace?: typeof membership }).workspace = membership
}

/**
 * Ensures the current user has at least the specified role in the resolved workspace.
 * Must run AFTER resolveWorkspace.
 */
const ROLE_HIERARCHY = ['VIEWER', 'MEMBER', 'ADMIN', 'OWNER'] as const
type WorkspaceRole = typeof ROLE_HIERARCHY[number]

export function requireWorkspaceRole(minRole: WorkspaceRole) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const ws = (request as { workspace?: { role: string } }).workspace

    if (!ws) {
      reply.status(403).send({
        success: false,
        error: { code: 'NO_WORKSPACE', message: 'No workspace context' },
      })
      return
    }

    const userRoleIndex = ROLE_HIERARCHY.indexOf(ws.role as WorkspaceRole)
    const minRoleIndex  = ROLE_HIERARCHY.indexOf(minRole)

    if (userRoleIndex < minRoleIndex) {
      reply.status(403).send({
        success: false,
        error: { code: 'INSUFFICIENT_ROLE', message: `This action requires ${minRole} role or higher` },
      })
      return
    }
  }
}
