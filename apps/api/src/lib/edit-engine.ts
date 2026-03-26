/**
 * edit-engine.ts — Interactive Edit Mode engine
 *
 * Phase 1: After initial code generation, users can request targeted edits.
 * The engine reads the current project files, plans specific changes using Groq,
 * awaits user approval, then applies changes file-by-file with SSE progress.
 */

import { prisma } from '@arivarangam/db'
import { redis } from './redis'
import { callGroq } from '../connectors/groq.connector'

interface PlannedEdit {
  path: string
  description: string
  newContent: string
}

interface EditPlan {
  explanation: string
  files: PlannedEdit[]
}

/**
 * Step 1: Plan edits.
 * Reads current project files, calls Groq to produce a diff plan,
 * saves it to the EditSession, and publishes SSE so the UI can show an approval card.
 */
export async function planEdits(
  projectId: string,
  sessionId: string,
  taskId: string,
): Promise<void> {
  // Load the project files
  const project = await prisma.codeProject.findUnique({
    where: { id: projectId },
    select: { files: true, name: true },
  })
  if (!project) throw new Error(`CodeProject ${projectId} not found`)

  // Load the edit session message
  const session = await prisma.editSession.findUnique({
    where: { id: sessionId },
    select: { message: true },
  })
  if (!session) throw new Error(`EditSession ${sessionId} not found`)

  const files = project.files as Array<{ path: string; content: string; language: string }>

  // Build file context — cap each file at 3000 chars to stay within token budget
  const fileContext = files
    .map((f) => {
      const content = f.content.length > 3000 ? f.content.slice(0, 3000) + '\n…[truncated]' : f.content
      return `--- ${f.path} ---\n${content}`
    })
    .join('\n\n')

  const prompt = `You are an expert code editor modifying an existing project called "${project.name}".

USER REQUEST: "${session.message}"

CURRENT PROJECT FILES:
${fileContext}

Your job: Identify which files need to change to fulfill the user request. For each file that needs changes, write the complete new file content.

Respond ONLY with valid JSON (no markdown, no explanation outside JSON):
{
  "explanation": "one sentence: what you are changing and why",
  "files": [
    {
      "path": "exact/file/path.ts",
      "description": "what changed in this file",
      "newContent": "complete new file content here"
    }
  ]
}

Rules:
- Only include files that actually need to change
- Write COMPLETE file content, not diffs or snippets
- Keep existing code that doesn't need to change
- Match the coding style of the existing files
- If no files need to change, return: {"explanation":"No changes needed","files":[]}`

  let planJson: EditPlan
  try {
    const raw = await callGroq(prompt, { maxTokens: 8000 })
    // Strip markdown code blocks if Groq wraps in them
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    planJson = JSON.parse(cleaned) as EditPlan
  } catch (err) {
    await prisma.editSession.update({
      where: { id: sessionId },
      data: { status: 'FAILED', error: 'Failed to generate edit plan' },
    })
    redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
      event: 'edit_failed',
      taskId,
      sessionId,
      error: 'Failed to generate edit plan',
    })).catch(() => {})
    throw err
  }

  // Save plan + move to AWAITING_APPROVAL
  await prisma.editSession.update({
    where: { id: sessionId },
    data: {
      status: 'AWAITING_APPROVAL',
      plan: planJson as object,
    },
  })

  // Publish plan_ready event so frontend shows the approval card
  redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
    event: 'edit_plan_ready',
    taskId,
    sessionId,
    explanation: planJson.explanation,
    files: planJson.files.map((f) => ({ path: f.path, description: f.description })),
    fileCount: planJson.files.length,
  })).catch(() => {})
}

/**
 * Step 2: Apply approved edits.
 * Reads the saved plan, applies each file change to CodeProject.files,
 * streams SSE progress events, and completes the session.
 */
export async function applyEdits(
  sessionId: string,
  taskId: string,
): Promise<void> {
  const session = await prisma.editSession.findUnique({
    where: { id: sessionId },
    select: { projectId: true, plan: true, status: true },
  })
  if (!session) throw new Error(`EditSession ${sessionId} not found`)
  if (session.status !== 'AWAITING_APPROVAL') {
    throw new Error(`EditSession ${sessionId} is not awaiting approval (status: ${session.status})`)
  }

  const plan = session.plan as EditPlan
  if (!plan?.files?.length) {
    // Nothing to apply — mark complete
    await prisma.editSession.update({ where: { id: sessionId }, data: { status: 'COMPLETED' } })
    redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
      event: 'edit_completed', taskId, sessionId, filesChanged: 0,
    })).catch(() => {})
    return
  }

  // Mark session as applying
  await prisma.editSession.update({ where: { id: sessionId }, data: { status: 'APPLYING' } })
  redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
    event: 'edit_applying',
    taskId,
    sessionId,
    totalFiles: plan.files.length,
  })).catch(() => {})

  // Load current project files
  const project = await prisma.codeProject.findUnique({
    where: { id: session.projectId },
    select: { files: true },
  })
  if (!project) throw new Error(`CodeProject ${session.projectId} not found`)

  const currentFiles = project.files as Array<{ path: string; content: string; language: string; linesOfCode?: number; purpose?: string }>

  // Apply each planned edit
  for (let i = 0; i < plan.files.length; i++) {
    const edit = plan.files[i]

    // Detect language from extension
    const ext = edit.path.split('.').pop() ?? 'ts'
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
      py: 'python', prisma: 'prisma', json: 'json', md: 'markdown',
      css: 'css', html: 'html', sh: 'bash', yml: 'yaml', yaml: 'yaml',
      env: 'bash', dockerfile: 'dockerfile',
    }
    const language = langMap[ext] ?? ext

    // Find and update the file in currentFiles, or add if new
    const existingIdx = currentFiles.findIndex((f) => f.path === edit.path)
    const linesOfCode = edit.newContent.split('\n').length
    if (existingIdx >= 0) {
      currentFiles[existingIdx] = {
        ...currentFiles[existingIdx],
        content: edit.newContent,
        language,
        linesOfCode,
      }
    } else {
      currentFiles.push({
        path: edit.path,
        content: edit.newContent,
        language,
        linesOfCode,
        purpose: edit.description,
      })
    }

    // Publish per-file progress
    redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
      event: 'edit_file_completed',
      taskId,
      sessionId,
      filePath: edit.path,
      fileIndex: i + 1,
      totalFiles: plan.files.length,
    })).catch(() => {})
  }

  // Persist updated files to DB
  await prisma.codeProject.update({
    where: { id: session.projectId },
    data: { files: currentFiles as object[] },
  })

  // Mark session complete
  await prisma.editSession.update({ where: { id: sessionId }, data: { status: 'COMPLETED' } })

  redis.publish(`arivarangam:task:${taskId}`, JSON.stringify({
    event: 'edit_completed',
    taskId,
    sessionId,
    filesChanged: plan.files.length,
  })).catch(() => {})
}
