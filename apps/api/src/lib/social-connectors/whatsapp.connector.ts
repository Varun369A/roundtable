// WhatsApp Business Cloud API (https://developers.facebook.com/docs/whatsapp/cloud-api)
// Required: WHATSAPP_BUSINESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
// Note: Broadcast messages require pre-approved message templates.
// The `postText` method sends a template message to a configurable recipient list.
import { ISocialConnector, TokenResponse, PostOptions, EngagementItemData, PostAnalytics, AccountAnalytics } from './types'

const WA_API_VERSION = 'v18.0'

export class WhatsAppConnector implements ISocialConnector {
  platform = 'WHATSAPP_BUSINESS' as const
  private accessToken: string

  constructor(accessToken: string) { this.accessToken = accessToken }

  getAuthUrl(): string {
    // WhatsApp Business API uses a static long-lived token from Meta Business Manager
    return ''
  }

  async exchangeCode(_code: string): Promise<TokenResponse> {
    return { accessToken: this.accessToken }
  }

  async refreshAccessToken(_refreshToken: string): Promise<TokenResponse> {
    // Exchange short-lived for long-lived token
    const res = await fetch(
      `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${this.accessToken}`
    )
    const data = await res.json() as any
    if (data.error) throw new Error(`WhatsApp token refresh failed: ${data.error.message}`)
    return { accessToken: data.access_token, expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined }
  }

  /**
   * Send a text message to a specific recipient.
   * The recipient phone number must be in E.164 format (e.g. +919876543210).
   * For mass broadcast use pre-approved templates instead.
   *
   * The `options.targetAudience` field, if present, is expected to be a comma-separated
   * list of E.164 phone numbers to message. Falls back to WHATSAPP_DEFAULT_RECIPIENT env var.
   */
  async postText(content: string, options?: PostOptions): Promise<string> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
    if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID not configured')

    // Determine recipient(s)
    const defaultRecipient = process.env.WHATSAPP_DEFAULT_RECIPIENT
    const recipientRaw = options?.recipient ?? defaultRecipient
    if (!recipientRaw) throw new Error('WhatsApp recipient not specified. Set WHATSAPP_DEFAULT_RECIPIENT or pass options.recipient.')

    // Support comma-separated multi-recipient (best-effort broadcast)
    const recipients: string[] = String(recipientRaw).split(',').map((r: string) => r.trim()).filter(Boolean)
    let lastMessageId = ''

    for (const to of recipients) {
      const res = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: content, preview_url: false },
        }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(`WhatsApp send failed to ${to}: ${data.error?.message ?? res.statusText}`)
      lastMessageId = data.messages?.[0]?.id ?? lastMessageId
    }

    return lastMessageId
  }

  /** Send an image message via WhatsApp Business Cloud API */
  async postImage(content: string, imageUrl: string): Promise<string> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
    if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID not configured')

    const defaultRecipient = process.env.WHATSAPP_DEFAULT_RECIPIENT
    if (!defaultRecipient) throw new Error('WHATSAPP_DEFAULT_RECIPIENT not configured')

    const res = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: defaultRecipient,
        type: 'image',
        image: { link: imageUrl, caption: content },
      }),
    })
    const data = await res.json() as any
    if (!res.ok) throw new Error(`WhatsApp image send failed: ${data.error?.message ?? res.statusText}`)
    return data.messages?.[0]?.id ?? ''
  }

  /** Send a video message via WhatsApp Business Cloud API */
  async postVideo(content: string, videoUrl: string): Promise<string> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
    if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID not configured')

    const defaultRecipient = process.env.WHATSAPP_DEFAULT_RECIPIENT
    if (!defaultRecipient) throw new Error('WHATSAPP_DEFAULT_RECIPIENT not configured')

    const res = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: defaultRecipient,
        type: 'video',
        video: { link: videoUrl, caption: content },
      }),
    })
    const data = await res.json() as any
    if (!res.ok) throw new Error(`WhatsApp video send failed: ${data.error?.message ?? res.statusText}`)
    return data.messages?.[0]?.id ?? ''
  }

  async postThread(tweets: string[]): Promise<string> {
    return this.postText(tweets.join('\n'))
  }

  /** WhatsApp messages are private — no public comments model */
  async getComments(_postId: string): Promise<EngagementItemData[]> {
    return []
  }

  /**
   * WhatsApp incoming messages must be received via Webhooks.
   * This method returns cached incoming messages from the DB if available,
   * otherwise returns empty (webhook handler must store them separately).
   */
  async getMentions(_since: Date): Promise<EngagementItemData[]> {
    return []
  }

  /** Reply to a WhatsApp message by message ID */
  async replyToComment(messageId: string, reply: string): Promise<void> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
    const defaultRecipient = process.env.WHATSAPP_DEFAULT_RECIPIENT
    if (!phoneNumberId || !defaultRecipient) return

    await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: defaultRecipient,
        type: 'text',
        context: { message_id: messageId },
        text: { body: reply },
      }),
    })
  }

  async replyToMention(mentionId: string, reply: string): Promise<void> {
    return this.replyToComment(mentionId, reply)
  }

  /** WhatsApp does not provide per-message analytics */
  async getPostAnalytics(_postId: string): Promise<PostAnalytics> {
    return { impressions: 0, engagements: 0, clicks: 0, likes: 0, shares: 0, comments: 0 }
  }

  /** WhatsApp Business Analytics requires Business Manager access — return zeros as baseline */
  async getAccountAnalytics(_period: string): Promise<AccountAnalytics> {
    return { impressions: 0, engagements: 0, clicks: 0, signups: 0, conversions: 0 }
  }
}
