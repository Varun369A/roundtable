/**
 * Integration Executor
 * Executes approved integration actions: GitHub, Gmail, Notion, Slack, Webhooks.
 * Uses the user's stored (encrypted) integration tokens.
 */
import { prisma } from '@arivarangam/db'
import { Octokit } from '@octokit/rest'
import { google } from 'googleapis'
import { decryptByoai } from './encrypt'

// ─── Token decryption ─────────────────────────────────────────────────────────

async function decryptIntegrationToken(integrationId: string): Promise<string> {
  const integration = await prisma.userIntegration.findUnique({
    where: { id: integrationId },
    select: { encryptedToken: true, tokenIv: true, tokenAuthTag: true },
  })

  if (!integration) {
    throw new Error(`Integration ${integrationId} not found`)
  }

  return decryptByoai(integration.encryptedToken, integration.tokenIv, integration.tokenAuthTag)
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────

async function executeGithubPush(
  octokit: Octokit,
  payload: {
    owner: string
    repo: string
    branch: string
    files: Array<{ path: string; content: string }>
    commitMessage: string
  },
): Promise<unknown> {
  const results: unknown[] = []

  for (const file of payload.files) {
    // Check if file exists to get its SHA (required for updates)
    let existingSha: string | undefined
    try {
      const { data } = await octokit.repos.getContent({
        owner: payload.owner,
        repo: payload.repo,
        path: file.path,
        ref: payload.branch,
      })
      if (!Array.isArray(data) && data.type === 'file') {
        existingSha = data.sha
      }
    } catch {
      // File doesn't exist — create it
    }

    const result = await octokit.repos.createOrUpdateFileContents({
      owner: payload.owner,
      repo: payload.repo,
      path: file.path,
      message: payload.commitMessage,
      content: Buffer.from(file.content, 'utf8').toString('base64'),
      branch: payload.branch,
      ...(existingSha ? { sha: existingSha } : {}),
    })
    results.push({ path: file.path, sha: result.data.content?.sha })
  }

  return { filesUploaded: results.length, files: results }
}

async function executeGithubPr(
  octokit: Octokit,
  payload: { owner: string; repo: string; head: string; base: string; title: string; body: string },
): Promise<unknown> {
  const { data } = await octokit.pulls.create({
    owner: payload.owner,
    repo: payload.repo,
    head: payload.head,
    base: payload.base,
    title: payload.title,
    body: payload.body,
  })
  return { pullRequestNumber: data.number, url: data.html_url }
}

async function executeGithubIssue(
  octokit: Octokit,
  payload: { owner: string; repo: string; title: string; body: string; labels?: string[] },
): Promise<unknown> {
  const { data } = await octokit.issues.create({
    owner: payload.owner,
    repo: payload.repo,
    title: payload.title,
    body: payload.body,
    labels: payload.labels || [],
  })
  return { issueNumber: data.number, url: data.html_url }
}

// ─── Gmail helpers ────────────────────────────────────────────────────────────

function buildRfc2822Email(opts: {
  to: string
  subject: string
  body: string
  cc?: string
  bcc?: string
  from?: string
}): string {
  const lines: string[] = []
  if (opts.from) lines.push(`From: ${opts.from}`)
  lines.push(`To: ${opts.to}`)
  if (opts.cc) lines.push(`Cc: ${opts.cc}`)
  if (opts.bcc) lines.push(`Bcc: ${opts.bcc}`)
  lines.push(`Subject: ${opts.subject}`)
  lines.push('Content-Type: text/plain; charset=utf-8')
  lines.push('')
  lines.push(opts.body)
  return lines.join('\r\n')
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function executeGmailSend(
  accessToken: string,
  payload: { to: string; subject: string; body: string; cc?: string; bcc?: string },
): Promise<unknown> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })

  const rawEmail = buildRfc2822Email(payload)
  const encodedEmail = base64UrlEncode(rawEmail)

  const { data } = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedEmail },
  })

  return { messageId: data.id, threadId: data.threadId }
}

async function executeGmailDraft(
  accessToken: string,
  payload: { to: string; subject: string; body: string },
): Promise<unknown> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth })

  const rawEmail = buildRfc2822Email(payload)
  const encodedEmail = base64UrlEncode(rawEmail)

  const { data } = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw: encodedEmail },
    },
  })

  return { draftId: data.id }
}

// ─── Notion helpers ───────────────────────────────────────────────────────────

async function executeNotionPage(
  token: string,
  payload: { parentPageId: string; title: string; content: string },
): Promise<unknown> {
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { page_id: payload.parentPageId },
      properties: {
        title: {
          title: [{ text: { content: payload.title } }],
        },
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: payload.content.slice(0, 2000) } }],
          },
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Notion API error ${response.status}: ${err}`)
  }

  const data = await response.json() as { id?: string; url?: string }
  return { pageId: data.id, url: data.url }
}

async function executeNotionDbRow(
  token: string,
  payload: { databaseId: string; properties: Record<string, unknown> },
): Promise<unknown> {
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: payload.databaseId },
      properties: payload.properties,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Notion API error ${response.status}: ${err}`)
  }

  const data = await response.json() as { id?: string }
  return { rowId: data.id }
}

// ─── Slack helpers ────────────────────────────────────────────────────────────

async function executeSlackMessage(
  token: string,
  payload: { channel: string; text: string; blocks?: unknown[] },
): Promise<unknown> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: payload.channel,
      text: payload.text,
      ...(payload.blocks ? { blocks: payload.blocks } : {}),
    }),
  })

  const data = await response.json() as { ok: boolean; error?: string; ts?: string }
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`)
  }

  return { timestamp: data.ts }
}

// ─── Webhook helper ───────────────────────────────────────────────────────────

async function executeWebhook(
  payload: {
    url: string
    method: string
    headers?: Record<string, string>
    body?: unknown
  },
): Promise<unknown> {
  const response = await fetch(payload.url, {
    method: payload.method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      ...(payload.headers || {}),
    },
    ...(payload.body ? { body: JSON.stringify(payload.body) } : {}),
  })

  const responseText = await response.text()
  let responseBody: unknown = responseText
  try { responseBody = JSON.parse(responseText) } catch { /* keep as text */ }

  return { status: response.status, body: responseBody }
}

// ─── Main execute function ─────────────────────────────────────────────────────

export async function executeAction(actionId: string): Promise<{ success: boolean; result: unknown }> {
  const action = await prisma.executionAction.findUnique({
    where: { id: actionId },
    include: { integration: true },
  })

  if (!action) {
    throw new Error(`Action ${actionId} not found`)
  }

  // Mark as executing
  await prisma.executionAction.update({
    where: { id: actionId },
    data: { status: 'EXECUTING' },
  })

  try {
    const payload = action.payload as Record<string, unknown>
    let result: unknown

    switch (action.type) {
      case 'GITHUB_PUSH':
      case 'GITHUB_PR':
      case 'GITHUB_ISSUE': {
        const token = action.integrationId
          ? await decryptIntegrationToken(action.integrationId)
          : (() => { throw new Error('No integration linked for GitHub action') })()

        const octokit = new Octokit({ auth: token })

        if (action.type === 'GITHUB_PUSH') {
          result = await executeGithubPush(octokit, payload as Parameters<typeof executeGithubPush>[1])
        } else if (action.type === 'GITHUB_PR') {
          result = await executeGithubPr(octokit, payload as Parameters<typeof executeGithubPr>[1])
        } else {
          result = await executeGithubIssue(octokit, payload as Parameters<typeof executeGithubIssue>[1])
        }
        break
      }

      case 'GMAIL_SEND':
      case 'GMAIL_DRAFT': {
        const token = action.integrationId
          ? await decryptIntegrationToken(action.integrationId)
          : (() => { throw new Error('No integration linked for Gmail action') })()

        if (action.type === 'GMAIL_SEND') {
          result = await executeGmailSend(token, payload as Parameters<typeof executeGmailSend>[1])
        } else {
          result = await executeGmailDraft(token, payload as Parameters<typeof executeGmailDraft>[1])
        }
        break
      }

      case 'NOTION_PAGE': {
        const token = action.integrationId
          ? await decryptIntegrationToken(action.integrationId)
          : (() => { throw new Error('No integration linked for Notion action') })()

        result = await executeNotionPage(token, payload as Parameters<typeof executeNotionPage>[1])
        break
      }

      case 'NOTION_DB_ROW': {
        const token = action.integrationId
          ? await decryptIntegrationToken(action.integrationId)
          : (() => { throw new Error('No integration linked for Notion action') })()

        result = await executeNotionDbRow(token, payload as Parameters<typeof executeNotionDbRow>[1])
        break
      }

      case 'SLACK_MESSAGE': {
        const token = action.integrationId
          ? await decryptIntegrationToken(action.integrationId)
          : (() => { throw new Error('No integration linked for Slack action') })()

        result = await executeSlackMessage(token, payload as Parameters<typeof executeSlackMessage>[1])
        break
      }

      case 'WEBHOOK': {
        result = await executeWebhook(payload as Parameters<typeof executeWebhook>[0])
        break
      }

      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }

    // Update action as COMPLETED
    await prisma.executionAction.update({
      where: { id: actionId },
      data: {
        status: 'COMPLETED',
        result: result as any,
        executedAt: new Date(),
      },
    })

    // Update integration lastUsedAt if linked
    if (action.integrationId) {
      prisma.userIntegration.update({
        where: { id: action.integrationId },
        data: { lastUsedAt: new Date() },
      }).catch(() => {})
    }

    return { success: true, result }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    await prisma.executionAction.update({
      where: { id: actionId },
      data: {
        status: 'FAILED',
        errorMessage,
        executedAt: new Date(),
      },
    })

    return { success: false, result: { error: errorMessage } }
  }
}

// ─── Approve + execute ────────────────────────────────────────────────────────

export async function approveAction(actionId: string, userId: string): Promise<void> {
  await prisma.executionAction.update({
    where: { id: actionId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: userId,
    },
  })

  // Execute immediately (non-blocking error handling)
  executeAction(actionId).catch((err) => {
    console.error(`[IntegrationExecutor] Failed to execute approved action ${actionId}:`, err)
  })
}

// ─── Reject ────────────────────────────────────────────────────────────────────

export async function rejectAction(actionId: string, userId: string, reason: string): Promise<void> {
  await prisma.executionAction.update({
    where: { id: actionId },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectedReason: reason,
      approvedBy: userId, // record who rejected
    },
  })
}
