/**
 * Voice Input routes — Phase 3
 *
 * POST   /api/v1/voice/transcribe             Upload audio, receive transcription
 * GET    /api/v1/voice/transcriptions         List user's transcriptions (last 50, paginated)
 * GET    /api/v1/voice/transcriptions/:id     Fetch a single transcription
 * DELETE /api/v1/voice/transcriptions/:id     Delete a transcription
 * GET    /api/v1/voice/languages              List supported languages & provider info
 *
 * NOTE: This file requires @fastify/multipart to be registered on the Fastify
 * instance (done in server.ts) before these routes are used.  If multipart is
 * not present in package.json, add it:
 *   pnpm --filter @arivarangam/api add @fastify/multipart
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@arivarangam/db'
import { requireAuth } from '../middleware/auth'
import {
  transcribeAudio,
  getTranscription,
  SARVAM_LANGUAGES,
  WHISPER_LANGUAGES,
} from '../lib/voice-transcriber'

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB — Whisper hard limit
const DEFAULT_PAGE_SIZE = 50

/** Recommended provider per language */
const RECOMMENDED_PROVIDER: Record<string, 'sarvam' | 'whisper'> = {
  en: 'whisper',
  ...Object.fromEntries(
    Object.keys(SARVAM_LANGUAGES).map((lang) => [lang, 'sarvam' as const]),
  ),
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function voiceRoutes(app: FastifyInstance) {
  // All voice routes require authentication
  app.addHook('preHandler', requireAuth)

  // ─── POST /voice/transcribe ────────────────────────────────────────────────
  /**
   * Upload an audio file and receive its transcription.
   *
   * Multipart fields:
   *   file     (required) — audio file (audio/*)
   *   language (optional) — ISO 639-1 code; defaults to 'en'
   *   taskId   (optional) — UUID of an existing task to associate
   *
   * Response:
   *   { transcriptionId, text, language, provider, confidence, durationSecs }
   */
  app.post('/voice/transcribe', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id

    // @fastify/multipart attaches .file() to the request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const multipart = (request as any).file as (() => Promise<any>) | undefined
    if (typeof multipart !== 'function') {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MULTIPART_REQUIRED',
          message: 'Request must be multipart/form-data',
        },
      })
    }

    const data = await multipart()

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: { code: 'FILE_REQUIRED', message: 'Audio file is required' },
      })
    }

    // ── Collect additional fields that arrive AFTER the file part ─────────────
    // With @fastify/multipart the non-file fields are available on data.fields
    // when using request.file(); cast to any for flexibility.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields = (data.fields ?? {}) as Record<string, any>
    const language: string = fields.language?.value?.trim() ?? 'en'
    const taskId: string | undefined = fields.taskId?.value?.trim() || undefined

    // ── Validate MIME type ────────────────────────────────────────────────────
    const mimeType: string = data.mimetype ?? ''
    if (!mimeType.startsWith('audio/')) {
      // Drain the stream to free resources before replying
      data.file.resume()
      return reply.status(415).send({
        success: false,
        error: {
          code: 'INVALID_MIME_TYPE',
          message: `Unsupported media type "${mimeType}". Must be audio/*.`,
        },
      })
    }

    // ── Buffer the upload, enforcing 25 MB limit ──────────────────────────────
    const chunks: Buffer[] = []
    let totalBytes = 0

    for await (const chunk of data.file) {
      totalBytes += chunk.length
      if (totalBytes > MAX_FILE_SIZE) {
        // Drain remaining stream data
        data.file.resume()
        return reply.status(413).send({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `Audio file exceeds the 25 MB limit (received at least ${(totalBytes / 1_048_576).toFixed(1)} MB)`,
          },
        })
      }
      chunks.push(chunk)
    }

    const audioBuffer = Buffer.concat(chunks)

    if (audioBuffer.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: 'EMPTY_FILE', message: 'Uploaded audio file is empty' },
      })
    }

    // ── Transcribe ────────────────────────────────────────────────────────────
    const result = await transcribeAudio({
      audioBuffer,
      mimeType,
      language,
      userId,
      taskId,
    })

    return reply.status(201).send({
      success: true,
      data: {
        transcriptionId: result.transcriptionId,
        text: result.processedText,
        language: result.language,
        provider: result.provider,
        confidence: result.confidence,
        durationSecs: result.durationSecs,
      },
    })
  })

  // ─── GET /voice/transcriptions ────────────────────────────────────────────
  /**
   * List the authenticated user's transcriptions, most recent first.
   * Querystring: page (1-based, default 1), limit (default 50, max 50)
   */
  app.get(
    '/voice/transcriptions',
    async (
      request: FastifyRequest<{
        Querystring: { page?: string; limit?: string; taskId?: string }
      }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id
      const query = request.query as { page?: string; limit?: string; taskId?: string }

      const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
      const limit = Math.min(DEFAULT_PAGE_SIZE, Math.max(1, parseInt(query.limit ?? '50', 10) || DEFAULT_PAGE_SIZE))
      const skip = (page - 1) * limit

      const where: Record<string, unknown> = { userId }
      if (query.taskId) where.taskId = query.taskId

      const [transcriptions, total] = await Promise.all([
        prisma.voiceTranscription.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            provider: true,
            language: true,
            durationSecs: true,
            processedText: true,
            confidence: true,
            taskId: true,
            createdAt: true,
          },
        }),
        prisma.voiceTranscription.count({ where }),
      ])

      return reply.send({
        success: true,
        data: {
          transcriptions,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      })
    },
  )

  // ─── GET /voice/transcriptions/:id ───────────────────────────────────────
  /** Fetch a single transcription by ID (must belong to the requesting user). */
  app.get(
    '/voice/transcriptions/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id
      const { id } = request.params

      const transcription = await getTranscription(id, userId)

      if (!transcription) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Transcription not found' },
        })
      }

      return reply.send({
        success: true,
        data: { transcription },
      })
    },
  )

  // ─── DELETE /voice/transcriptions/:id ────────────────────────────────────
  /** Permanently delete a transcription (scoped to requesting user). */
  app.delete(
    '/voice/transcriptions/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id
      const { id } = request.params

      // Verify ownership before deleting
      const existing = await prisma.voiceTranscription.findUnique({
        where: { id },
        select: { userId: true },
      })

      if (!existing || existing.userId !== userId) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Transcription not found' },
        })
      }

      await prisma.voiceTranscription.delete({ where: { id } })

      return reply.status(204).send()
    },
  )

  // ─── GET /voice/languages ─────────────────────────────────────────────────
  /**
   * Return supported languages and which provider handles each.
   * The `recommended` map surfaces the best provider per language so clients
   * can display guidance to users.
   */
  app.get('/voice/languages', async (_request: FastifyRequest, reply: FastifyReply) => {
    const sarvamAvailable = Boolean(process.env.SARVAM_API_KEY?.trim())

    return reply.send({
      success: true,
      data: {
        whisper: WHISPER_LANGUAGES,
        sarvam: SARVAM_LANGUAGES,
        recommended: RECOMMENDED_PROVIDER,
        sarvamAvailable,
        note: sarvamAvailable
          ? 'Sarvam AI is active — Indian language transcriptions will use Sarvam for higher accuracy.'
          : 'Sarvam AI is not configured. Set SARVAM_API_KEY to enable higher-accuracy Indian language transcription.',
      },
    })
  })
}
