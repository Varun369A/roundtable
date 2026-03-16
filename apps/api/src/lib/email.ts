/**
 * Email service via Resend.
 * Falls back to console.log when RESEND_API_KEY is not set (dev/test).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM || 'Sabha <no-reply@sabhaai.com>'
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sabhaai.com'

interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log('[email:dev]', payload.subject, '->', payload.to)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      reply_to: payload.replyTo,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[email] Resend error:', err)
    // Don't throw — email failure is non-fatal
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

const wrapHtml = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e4e4e7; }
    .container { max-width: 560px; margin: 40px auto; padding: 0 20px; }
    .card { background: #18181b; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; }
    .logo { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 24px; }
    .logo span { color: #6366f1; }
    h1 { font-size: 20px; font-weight: 600; color: #fff; margin: 0 0 8px; }
    p { font-size: 14px; color: #a1a1aa; line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; padding: 12px 24px; background: #6366f1; color: #fff; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 500; }
    .code { font-family: monospace; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); color: #818cf8; padding: 12px 16px; border-radius: 8px; font-size: 18px; letter-spacing: 2px; text-align: center; }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 24px 0; }
    .footer { text-align: center; font-size: 12px; color: #52525b; margin-top: 24px; }
    .footer a { color: #6366f1; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">Sabha<span>AI</span></div>
      ${content}
    </div>
    <div class="footer">
      Sabha AI · <a href="${BASE_URL}/unsubscribe">Unsubscribe</a>
    </div>
  </div>
</body>
</html>
`

// ─── Specific email senders ───────────────────────────────────────────────────

export async function sendWelcomeEmail(opts: {
  to: string
  name: string
  betaCode?: string
}): Promise<void> {
  await sendEmail({
    to: opts.to,
    subject: 'Welcome to Sabha — your AI roundtable is ready',
    html: wrapHtml(`
      <h1>Welcome aboard, ${opts.name}!</h1>
      <p>You've been granted early access to Sabha — the AI orchestration platform that coordinates multiple AI models to tackle your biggest goals.</p>
      <p>Get started by creating your first roundtable task:</p>
      <a href="${BASE_URL}/dashboard" class="btn">Open Dashboard →</a>
      <hr class="divider" />
      <p>Your invite code: <strong>${opts.betaCode || 'N/A'}</strong></p>
      <p style="font-size:12px">Share with a colleague to invite them to the beta.</p>
    `),
  })
}

export async function sendTaskCompletionEmail(opts: {
  to: string
  name: string
  taskTitle: string
  taskId: string
  subtaskCount: number
  costUsd: number
}): Promise<void> {
  await sendEmail({
    to: opts.to,
    subject: `✅ Your Sabha task is complete — ${opts.taskTitle}`,
    html: wrapHtml(`
      <h1>Task complete!</h1>
      <p>Your AI roundtable finished working on:</p>
      <p><strong style="color:#fff">${opts.taskTitle}</strong></p>
      <p>${opts.subtaskCount} AI subtasks ran · $${opts.costUsd.toFixed(4)} total cost</p>
      <a href="${BASE_URL}/dashboard?task=${opts.taskId}" class="btn">View Results →</a>
    `),
  })
}

export async function sendWorkspaceInviteEmail(opts: {
  to: string
  inviterName: string
  workspaceName: string
  role: string
  inviteUrl: string
  expiresAt: Date
}): Promise<void> {
  await sendEmail({
    to: opts.to,
    subject: `${opts.inviterName} invited you to join ${opts.workspaceName} on Sabha`,
    html: wrapHtml(`
      <h1>You've been invited!</h1>
      <p><strong style="color:#fff">${opts.inviterName}</strong> has invited you to join <strong style="color:#fff">${opts.workspaceName}</strong> as a <strong style="color:#fff">${opts.role}</strong>.</p>
      <p>This invite expires ${opts.expiresAt.toLocaleDateString()}.</p>
      <a href="${opts.inviteUrl}" class="btn">Accept Invite →</a>
      <hr class="divider" />
      <p>Or copy this link:</p>
      <div style="font-family:monospace;font-size:12px;color:#71717a;word-break:break-all">${opts.inviteUrl}</div>
    `),
  })
}

export async function sendBetaInviteEmail(opts: {
  to: string
  fromName: string
  code: string
}): Promise<void> {
  await sendEmail({
    to: opts.to,
    subject: `${opts.fromName} invited you to try Sabha AI (early access)`,
    html: wrapHtml(`
      <h1>You're invited to Sabha</h1>
      <p><strong style="color:#fff">${opts.fromName}</strong> has invited you to join Sabha AI's private beta — coordinate multiple AI models to tackle complex goals.</p>
      <p>Your exclusive invite code:</p>
      <div class="code">${opts.code}</div>
      <br />
      <a href="${BASE_URL}/signup?code=${opts.code}" class="btn">Claim Your Spot →</a>
      <hr class="divider" />
      <p style="font-size:12px">Only ${100} beta spots available. First come, first served.</p>
    `),
  })
}
