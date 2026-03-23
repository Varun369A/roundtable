// TODO: Implement using WhatsApp Business Cloud API (https://developers.facebook.com/docs/whatsapp/cloud-api)
// Required: WHATSAPP_BUSINESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
import { ISocialConnector, TokenResponse, PostOptions, EngagementItemData, PostAnalytics, AccountAnalytics } from './types'

export class WhatsAppConnector implements ISocialConnector {
  platform = 'WHATSAPP_BUSINESS' as const
  private accessToken: string

  constructor(accessToken: string) { this.accessToken = accessToken }

  getAuthUrl(): string {
    // WhatsApp Business API uses a static token, not OAuth
    // Token is generated in Meta Business Manager
    return ''
  }

  async exchangeCode(_code: string): Promise<TokenResponse> {
    // WhatsApp Business API uses long-lived tokens from Meta Business Manager
    return { accessToken: this.accessToken }
  }

  async refreshAccessToken(_refreshToken: string): Promise<TokenResponse> {
    // TODO: Refresh via Meta Graph API
    // GET https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&...
    return { accessToken: this.accessToken }
  }

  async postText(content: string, _options?: PostOptions): Promise<string> {
    // TODO: Send broadcast/template message via WhatsApp Business Cloud API
    // POST https://graph.facebook.com/v18.0/{phone-number-id}/messages
    // Note: WhatsApp requires pre-approved message templates for broadcast
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: 'broadcast', // Replace with actual recipient in production
        type: 'text',
        text: { body: content }
      })
    })
    const data = await res.json() as any
    return data.messages?.[0]?.id ?? ''
  }

  async postImage(_content: string, _imageUrl: string): Promise<string> {
    // TODO: Send image message via WhatsApp Business Cloud API
    return ''
  }

  async postVideo(_content: string, _videoUrl: string): Promise<string> {
    // TODO: Send video message via WhatsApp Business Cloud API
    return ''
  }

  async postThread(tweets: string[]): Promise<string> {
    return this.postText(tweets.join('\n'))
  }

  async getComments(_postId: string): Promise<EngagementItemData[]> {
    // WhatsApp does not support public comments; messages are private
    return []
  }

  async getMentions(_since: Date): Promise<EngagementItemData[]> {
    // TODO: Use WhatsApp Webhook to receive incoming messages
    // https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
    return []
  }

  async replyToComment(commentId: string, reply: string): Promise<void> {
    // TODO: Reply to a WhatsApp message
    void commentId
    void reply
  }

  async replyToMention(mentionId: string, reply: string): Promise<void> {
    return this.replyToComment(mentionId, reply)
  }

  async getPostAnalytics(_postId: string): Promise<PostAnalytics> {
    // WhatsApp does not provide per-message analytics via API
    return { impressions: 0, engagements: 0, clicks: 0, likes: 0, shares: 0, comments: 0 }
  }

  async getAccountAnalytics(_period: string): Promise<AccountAnalytics> {
    // TODO: WhatsApp Business Analytics — requires Business Manager access
    return { impressions: 0, engagements: 0, clicks: 0, signups: 0, conversions: 0 }
  }
}
