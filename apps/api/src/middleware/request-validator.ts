import { FastifyRequest, FastifyReply } from 'fastify'

/**
 * Input sanitization and validation helpers.
 * Used as preHandler hooks on routes that accept user-generated text.
 */

// Characters that are safe-but-suspicious in goal/text inputs
const SCRIPT_TAG_RE = /<\s*script[\s\S]*?>/gi
const NULL_BYTE_RE  = /\0/g
const CONTROL_RE    = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

export function sanitizeText(input: string): string {
  return input
    .replace(NULL_BYTE_RE, '')
    .replace(CONTROL_RE, '')
    .replace(SCRIPT_TAG_RE, '[removed]')
    .trim()
}

/**
 * Validates that a task goal:
 *   - Is present and non-empty
 *   - Does not exceed 4000 characters
 *   - Does not contain null bytes or control characters
 */
export async function validateTaskGoal(
  request: FastifyRequest<{ Body: { goal?: unknown } }>,
  reply: FastifyReply
): Promise<void> {
  const body = request.body as Record<string, unknown>

  if (!body.goal || typeof body.goal !== 'string') {
    reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'goal is required and must be a string' },
    })
    return
  }

  if (body.goal.length > 4000) {
    reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'goal must be 4000 characters or fewer' },
    })
    return
  }

  // Sanitize in place
  body.goal = sanitizeText(body.goal)

  if ((body.goal as string).length === 0) {
    reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'goal is empty after sanitization' },
    })
  }
}

/**
 * Adds security-oriented response headers that Helmet doesn't cover
 * (or that we want to set more specifically).
 */
export async function addSecurityHeaders(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('X-Frame-Options', 'DENY')
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  reply.header('Cross-Origin-Resource-Policy', 'cross-origin')
}
