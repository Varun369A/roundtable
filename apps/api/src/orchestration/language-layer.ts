import { prisma } from '@arivarangam/db'
import { detectLanguageWithAI, detectLanguage, type DetectedLanguage } from '../lib/language-detector'
import { translateToEnglish, translateOutput } from '../services/translation.service'
import { redis } from '../lib/redis'

export interface LanguageContext {
  originalLanguage: DetectedLanguage
  originalGoal: string           // in user's language
  translatedGoal: string         // in English for AI processing
  requiresTranslation: boolean
  translationCostUsd: number
}

const LANG_CONTEXT_KEY = (taskId: string) => `arivarangam:lang:${taskId}`
const LANG_CONTEXT_TTL = 60 * 60 * 24 // 24 hours

/**
 * Step 1: Detect language and translate user goal to English.
 * Called by orchestrateTask before intent parsing.
 */
export async function processInputLanguage(params: {
  taskId: string
  userId: string
  originalGoal: string
  preferredLanguage?: string  // from user profile settings
}): Promise<LanguageContext> {
  // Use preferred language if explicitly set, otherwise detect
  let detected: DetectedLanguage

  if (params.preferredLanguage && params.preferredLanguage !== 'auto') {
    // User has set a preferred language — trust it
    const { SUPPORTED_LANGUAGES } = await import('../lib/language-detector')
    const lang = SUPPORTED_LANGUAGES[params.preferredLanguage]
    if (lang) {
      detected = {
        code: params.preferredLanguage,
        sarvamCode: lang.sarvamCode,
        name: lang.name,
        confidence: 'high',
        needsTranslation: params.preferredLanguage !== 'en',
      }
    } else {
      detected = await detectLanguageWithAI(params.originalGoal)
    }
  } else {
    // Auto-detect
    detected = await detectLanguageWithAI(params.originalGoal)
  }

  let translatedGoal = params.originalGoal
  let translationCostUsd = 0

  if (detected.needsTranslation) {
    const result = await translateToEnglish({
      text: params.originalGoal,
      sourceLang: detected.code,
    })
    translatedGoal = result.translated
    translationCostUsd = result.costUsd
  }

  const context: LanguageContext = {
    originalLanguage: detected,
    originalGoal: params.originalGoal,
    translatedGoal,
    requiresTranslation: detected.needsTranslation,
    translationCostUsd,
  }

  // Store in Redis
  await redis.setex(LANG_CONTEXT_KEY(params.taskId), LANG_CONTEXT_TTL, JSON.stringify(context))

  // Update task with language info
  await prisma.task.update({
    where: { id: params.taskId },
    data: {
      contextObject: {
        // This gets merged in orchestrator
        detectedLanguage: detected.code,
        requiresTranslation: detected.needsTranslation,
      },
    },
  })

  return context
}

/**
 * Step 2: Translate a completed subtask output back to user's language.
 * Called by the job queue after each subtask completes.
 */
export async function translateSubtaskOutput(params: {
  taskId: string
  subtaskId: string
  content: string
  outputType: string
}): Promise<{ translatedContent: string; costUsd: number }> {
  // Only translate text outputs
  if (params.outputType !== 'text') {
    return { translatedContent: params.content, costUsd: 0 }
  }

  const cached = await redis.get(LANG_CONTEXT_KEY(params.taskId))
  if (!cached) {
    return { translatedContent: params.content, costUsd: 0 }
  }

  const langContext = JSON.parse(cached) as LanguageContext

  if (!langContext.requiresTranslation) {
    return { translatedContent: params.content, costUsd: 0 }
  }

  const { translated, costUsd } = await translateOutput({
    text: params.content,
    targetLang: langContext.originalLanguage.code,
  })

  return { translatedContent: translated, costUsd }
}

/**
 * Get the language context for a task.
 */
export async function getLanguageContext(taskId: string): Promise<LanguageContext | null> {
  const cached = await redis.get(LANG_CONTEXT_KEY(taskId))
  if (!cached) return null
  return JSON.parse(cached) as LanguageContext
}

/**
 * Get user's preferred language from their profile.
 */
export async function getUserLanguagePreference(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  })
  const prefs = (user?.preferences as Record<string, unknown>) || {}
  return (prefs.language as string) || 'auto'
}

/**
 * Save user's language preference.
 */
export async function setUserLanguagePreference(userId: string, language: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  })
  const prefs = (user?.preferences as Record<string, unknown>) || {}
  await prisma.user.update({
    where: { id: userId },
    data: { preferences: { ...prefs, language } },
  })
}
