/**
 * Global type augmentations for Sabha API.
 */

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string
      email: string
      tier: string
      status: string
      currentWorkspaceId?: string | null
    }
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      id: string
      email: string
      tier: string
      status: string
      currentWorkspaceId?: string | null
    }
  }
}

export {}
