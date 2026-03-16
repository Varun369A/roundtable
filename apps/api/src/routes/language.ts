import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { detectLanguageWithAI, SUPPORTED_LANGUAGES } from '../lib/language-detector'
import { translate } from '../services/translation.service'
import { setUserLanguagePreference, getUserLanguagePreference } from '../orchestration/language-layer'

export async function languageRoutes(app: FastifyInstance) {

  // ─── GET /api/v1/language/supported ──────────────────────────────────────────
  // Public endpoint — no auth needed
  app.get('/supported', async (_request, reply) => {
    const languages = Object.entries(SUPPORTED_LANGUAGES).map(([code, lang]) => ({
      code,
      name: lang.name,
      nativeName: lang.nativeName,
      sarvamCode: lang.sarvamCode,
    }))

    return reply.send({ success: true, data: { languages } })
  })

  // ─── POST /api/v1/language/detect ────────────────────────────────────────────
  app.post('/detect', async (request, reply) => {
    const body = z.object({
      text: z.string().min(1).max(2000),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'text is required' },
      })
    }

    const detected = await detectLanguageWithAI(body.data.text)

    return reply.send({
      success: true,
      data: {
        language: detected,
        supported: Boolean(SUPPORTED_LANGUAGES[detected.code]),
      },
    })
  })

  // ─── POST /api/v1/language/translate ─────────────────────────────────────────
  // Quick translation endpoint (used by frontend for previews)
  app.post('/translate', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = z.object({
      text:       z.string().min(1).max(10000),
      sourceLang: z.string().default('en'),
      targetLang: z.string(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
      })
    }

    if (!SUPPORTED_LANGUAGES[body.data.targetLang]) {
      return reply.status(400).send({
        success: false,
        error: { code: 'UNSUPPORTED_LANGUAGE', message: `Language ${body.data.targetLang} is not supported` },
      })
    }

    const result = await translate({
      text:       body.data.text,
      sourceLang: body.data.sourceLang,
      targetLang: body.data.targetLang,
    })

    return reply.send({
      success: true,
      data: {
        original:   body.data.text,
        translated: result.translated,
        sourceLang: body.data.sourceLang,
        targetLang: body.data.targetLang,
        cached:     result.cached,
      },
    })
  })

  // ─── GET /api/v1/language/preference ──────────────────────────────────────────
  app.get('/preference', { preHandler: [requireAuth] }, async (request, reply) => {
    const lang = await getUserLanguagePreference(request.user!.id)
    return reply.send({ success: true, data: { language: lang } })
  })

  // ─── PUT /api/v1/language/preference ──────────────────────────────────────────
  app.put('/preference', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = z.object({
      language: z.string(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'language is required' },
      })
    }

    const lang = body.data.language
    if (lang !== 'auto' && !SUPPORTED_LANGUAGES[lang]) {
      return reply.status(400).send({
        success: false,
        error: { code: 'UNSUPPORTED_LANGUAGE', message: `${lang} is not a supported language` },
      })
    }

    await setUserLanguagePreference(request.user!.id, lang)
    return reply.send({ success: true, data: { language: lang } })
  })
}
