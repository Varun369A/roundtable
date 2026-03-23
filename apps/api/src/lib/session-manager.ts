/**
 * Roundtable Session Manager — Enterprise Grade
 *
 * Manages multiplayer roundtable sessions where multiple users
 * (team members or clients) watch and react to AI task execution live.
 *
 * Architecture:
 * - Session has an access code (6-char, shareable link)
 * - Participants join as owner/collaborator/viewer
 * - All SSE events broadcast to arivarangam:session:{sessionId} channel
 * - Presence tracked via heartbeat (participant marks lastSeenAt every 30s)
 * - Reactions broadcast instantly via Valkey pub/sub
 */
import { prisma } from '@arivarangam/db'
import { redis } from './redis'
import crypto from 'node:crypto'

// ─── Access code generation ───────────────────────────────────────────────────

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars (0/O, 1/I)
  let code = ''
  const bytes = crypto.randomBytes(6)
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length]
  }
  return code
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

export interface CreateSessionOptions {
  taskId:       string
  ownerId:      string
  ownerName:    string
  ownerAvatar?: string
  isPublic?:    boolean
  allowSteering?: boolean
  expiresInHours?: number  // default: no expiry
}

export async function createSession(opts: CreateSessionOptions) {
  // Ensure unique access code
  let accessCode: string
  let attempts = 0
  do {
    accessCode = generateAccessCode()
    attempts++
    if (attempts > 20) throw new Error('Could not generate unique access code')
  } while (await prisma.roundtableSession.findUnique({ where: { accessCode } }))

  const expiresAt = opts.expiresInHours
    ? new Date(Date.now() + opts.expiresInHours * 60 * 60 * 1000)
    : undefined

  const session = await prisma.roundtableSession.create({
    data: {
      taskId:       opts.taskId,
      ownerId:      opts.ownerId,
      accessCode,
      isPublic:     opts.isPublic ?? false,
      allowSteering: opts.allowSteering ?? false,
      expiresAt,
    },
  })

  // Auto-add owner as participant
  await prisma.roundtableParticipant.create({
    data: {
      sessionId:   session.id,
      userId:      opts.ownerId,
      displayName: opts.ownerName,
      avatarUrl:   opts.ownerAvatar,
      role:        'owner',
      isOnline:    true,
    },
  })

  return session
}

export async function getSessionByCode(accessCode: string) {
  const session = await prisma.roundtableSession.findUnique({
    where:   { accessCode: accessCode.toUpperCase() },
    include: {
      participants: { where: { isOnline: true } },
      task: { select: { id: true, title: true, status: true, originalGoal: true } },
    },
  })

  if (!session) return null
  if (session.expiresAt && session.expiresAt < new Date()) return null

  return session
}

// ─── Participant management ───────────────────────────────────────────────────

export async function joinSession(
  sessionId:   string,
  userId:      string | null,
  displayName: string,
  avatarUrl?:  string,
): Promise<{ participantId: string; role: string }> {
  const session = await prisma.roundtableSession.findUnique({
    where: { id: sessionId },
  })
  if (!session) throw new Error('Session not found')
  if (!session.isPublic && !userId) throw new Error('Private session requires authentication')

  // Check if user already a participant
  const existing = userId
    ? await prisma.roundtableParticipant.findFirst({ where: { sessionId, userId } })
    : null

  if (existing) {
    await prisma.roundtableParticipant.update({
      where: { id: existing.id },
      data:  { isOnline: true, lastSeenAt: new Date() },
    })
    await broadcastParticipantEvent(sessionId, 'participant_rejoined', {
      participantId: existing.id,
      displayName:   existing.displayName,
      role:          existing.role,
    })
    return { participantId: existing.id, role: existing.role }
  }

  const role = userId === session.ownerId ? 'owner' : 'viewer'

  const participant = await prisma.roundtableParticipant.create({
    data: { sessionId, userId, displayName, avatarUrl, role, isOnline: true },
  })

  await broadcastParticipantEvent(sessionId, 'participant_joined', {
    participantId: participant.id,
    displayName,
    role,
    avatarUrl,
  })

  return { participantId: participant.id, role }
}

export async function leaveSession(sessionId: string, participantId: string): Promise<void> {
  const p = await prisma.roundtableParticipant.update({
    where: { id: participantId },
    data:  { isOnline: false, lastSeenAt: new Date() },
  })

  await broadcastParticipantEvent(sessionId, 'participant_left', {
    participantId,
    displayName: p.displayName,
  })
}

export async function heartbeat(participantId: string): Promise<void> {
  await prisma.roundtableParticipant.update({
    where: { id: participantId },
    data:  { isOnline: true, lastSeenAt: new Date() },
  })
}

/**
 * Mark participants as offline if no heartbeat in 45 seconds.
 * Run every minute by cron worker.
 */
export async function pruneStaleParticipants(): Promise<void> {
  const cutoff = new Date(Date.now() - 45 * 1000)
  await prisma.roundtableParticipant.updateMany({
    where: { isOnline: true, lastSeenAt: { lt: cutoff } },
    data:  { isOnline: false },
  })
}

// ─── Reactions ────────────────────────────────────────────────────────────────

const ALLOWED_REACTIONS = new Set(['👍', '🔥', '✨', '❓', '👎', '💡', '⚡'])

export async function addReaction(
  sessionId:  string,
  subtaskId:  string | null,
  userId:     string | null,
  reaction:   string,
): Promise<void> {
  if (!ALLOWED_REACTIONS.has(reaction)) throw new Error(`Invalid reaction: ${reaction}`)

  const saved = await prisma.roundtableReaction.create({
    data: { sessionId, subtaskId, userId, reaction },
  })

  // Broadcast to all session participants
  await redis.publish(`arivarangam:session:${sessionId}`, JSON.stringify({
    event:     'reaction_added',
    reactionId: saved.id,
    subtaskId,
    userId,
    reaction,
    timestamp: Date.now(),
  }))
}

export async function getReactions(sessionId: string) {
  return prisma.roundtableReaction.findMany({
    where:   { sessionId },
    orderBy: { createdAt: 'asc' },
  })
}

// ─── Broadcast helpers ────────────────────────────────────────────────────────

/**
 * Forward all task SSE events to the session channel so all participants see them.
 */
export async function forwardTaskEventToSession(
  taskId:  string,
  payload: string,
): Promise<void> {
  const session = await prisma.roundtableSession.findUnique({
    where: { taskId },
    select: { id: true },
  })
  if (!session) return

  await redis.publish(`arivarangam:session:${session.id}`, payload)
}

async function broadcastParticipantEvent(
  sessionId: string,
  event:     string,
  data:      Record<string, unknown>,
): Promise<void> {
  await redis.publish(`arivarangam:session:${sessionId}`, JSON.stringify({
    event,
    sessionId,
    ...data,
    timestamp: Date.now(),
  }))
}

/**
 * Get online participants for a session — for presence display.
 */
export async function getOnlineParticipants(sessionId: string) {
  return prisma.roundtableParticipant.findMany({
    where:   { sessionId, isOnline: true },
    orderBy: { joinedAt: 'asc' },
    select:  { id: true, displayName: true, avatarUrl: true, role: true, joinedAt: true },
  })
}
