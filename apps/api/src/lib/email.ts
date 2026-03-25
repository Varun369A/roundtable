/**
 * Email service via Resend.
 * Falls back to console.log when RESEND_API_KEY is not set (dev/test).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM || 'Arivarangam <admin@arivarangam.com>'
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://arivarangam.com'

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
    throw new Error(`Resend ${res.status}: ${err}`)
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
      <div class="logo">Arivarangam<span>AI</span></div>
      ${content}
    </div>
    <div class="footer">
      Arivarangam · <a href="${BASE_URL}/unsubscribe">Unsubscribe</a>
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
    subject: 'Welcome to Arivarangam — your AI roundtable is ready',
    html: wrapHtml(`
      <h1>Welcome aboard, ${opts.name}!</h1>
      <p>You've been granted early access to Arivarangam — the AI orchestration platform that coordinates multiple AI models to tackle your biggest goals.</p>
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
    subject: `✅ Your Arivarangam task is complete — ${opts.taskTitle}`,
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
    subject: `${opts.inviterName} invited you to join ${opts.workspaceName} on Arivarangam`,
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
    subject: `${opts.fromName} invited you to try Arivarangam (early access)`,
    html: wrapHtml(`
      <h1>You're invited to Arivarangam</h1>
      <p><strong style="color:#fff">${opts.fromName}</strong> has invited you to join Arivarangam's private beta — coordinate multiple AI models to tackle complex goals.</p>
      <p>Your exclusive invite code:</p>
      <div class="code">${opts.code}</div>
      <br />
      <a href="${BASE_URL}/signup?code=${opts.code}" class="btn">Claim Your Spot →</a>
      <hr class="divider" />
      <p style="font-size:12px">Only ${100} beta spots available. First come, first served.</p>
    `),
  })
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Reset your Arivarangam password',
    html: wrapHtml(`
      <h1>Reset your password</h1>
      <p>Hi ${name},</p>
      <p>We received a request to reset the password for your Arivarangam account. Click the button below to set a new password.</p>
      <a href="${resetUrl}" class="btn">Reset Password →</a>
      <hr class="divider" />
      <p style="font-size:12px;color:#52525b">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will not change.</p>
      <p style="font-size:12px;color:#52525b">If the button above doesn't work, copy and paste this link into your browser:</p>
      <p style="font-size:12px;color:#71717a;word-break:break-all">${resetUrl}</p>
    `),
  })
}

export async function sendVerificationEmail(to: string, name: string, verifyUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Verify your Arivarangam email address',
    html: wrapHtml(`
      <h1>Verify your email</h1>
      <p>Hi ${name},</p>
      <p>Thanks for signing up! Please verify your email address to unlock all Arivarangam features.</p>
      <a href="${verifyUrl}" class="btn">Verify Email →</a>
      <hr class="divider" />
      <p style="font-size:12px;color:#52525b">This link expires in 24 hours. If you didn't create a Arivarangam account, you can safely ignore this email.</p>
      <p style="font-size:12px;color:#52525b">If the button above doesn't work, copy and paste this link into your browser:</p>
      <p style="font-size:12px;color:#71717a;word-break:break-all">${verifyUrl}</p>
    `),
  })
}

export async function sendPostVerificationWelcomeEmail(to: string, name: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Welcome to Arivarangam — your account is verified!',
    html: wrapHtml(`
      <h1>You're all set, ${name}!</h1>
      <p>Your email address has been verified. You now have full access to Arivarangam — your AI orchestration platform.</p>
      <p>Start by creating your first Roundtable task:</p>
      <a href="${BASE_URL}/dashboard" class="btn">Go to Dashboard →</a>
      <hr class="divider" />
      <p style="font-size:12px;color:#52525b">Need help getting started? Browse our <a href="${BASE_URL}/templates" style="color:#6366f1">templates library</a> to find a starting point for your first task.</p>
    `),
  })
}

export async function sendPaymentFailedEmail(to: string, name: string | null, planId: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Action required: your Arivarangam payment failed',
    html: wrapHtml(`
      <h1>Payment failed</h1>
      <p>Hi ${name || 'there'},</p>
      <p>We were unable to process your payment for the <strong style="color:#fff">${planId}</strong> plan. This may be due to an expired card, insufficient funds, or a bank decline.</p>
      <p>To keep your subscription active, please update your payment method:</p>
      <a href="${BASE_URL}/settings/billing" class="btn">Update Payment Method →</a>
      <hr class="divider" />
      <p style="font-size:12px;color:#52525b">If we cannot collect payment, your account will be downgraded to the free tier at the end of your current billing period. Your data will not be deleted.</p>
      <p style="font-size:12px;color:#52525b">If you have questions, reply to this email and our team will help.</p>
    `),
  })
}

export async function sendAdminNewUserNotification(opts: {
  userName: string
  userEmail: string
  userId: string
  totalUsers: number
  signupTime: Date
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@arivarangam.com'
  const time = opts.signupTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })

  await sendEmail({
    to: adminEmail,
    subject: `🎉 New signup — ${opts.userName} (${opts.userEmail})`,
    html: wrapHtml(`
      <h1>New user signed up</h1>
      <p>A new user just created an account on Arivarangam.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#71717a;font-size:13px">Name</td><td style="padding:8px 0;color:#fff;font-size:13px"><strong>${opts.userName}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#71717a;font-size:13px">Email</td><td style="padding:8px 0;color:#fff;font-size:13px">${opts.userEmail}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a;font-size:13px">Time (IST)</td><td style="padding:8px 0;color:#fff;font-size:13px">${time}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a;font-size:13px">Total users</td><td style="padding:8px 0;color:#6366f1;font-size:13px"><strong>${opts.totalUsers}</strong></td></tr>
      </table>
      <a href="${BASE_URL}/admin/users" class="btn">View in Admin →</a>
    `),
  })
}

export async function sendAccountDeletionEmail(to: string, name: string | null): Promise<void> {
  await sendEmail({
    to,
    subject: 'Your Arivarangam account has been deleted',
    html: wrapHtml(`
      <h1>Account deleted</h1>
      <p>Hi ${name || 'there'},</p>
      <p>Your Arivarangam account has been successfully deleted. All your personal data has been anonymized per our privacy policy.</p>
      <p>We're sorry to see you go. If you change your mind, you're always welcome to create a new account at:</p>
      <a href="${BASE_URL}/signup" class="btn">Create New Account →</a>
      <hr class="divider" />
      <p style="font-size:12px;color:#52525b">If you believe this was done in error, please contact us at <a href="mailto:support@arivarangam.com" style="color:#6366f1">support@arivarangam.com</a> within 30 days.</p>
    `),
  })
}
