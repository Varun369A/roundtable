// TODO: Implement using Facebook Graph API (https://developers.facebook.com/docs/graph-api)
// Required: FACEBOOK_APP_ID, FACEBOOK_APP_SECRET
// Required scopes: pages_manage_posts, pages_read_engagement, pages_manage_engagement
import { ISocialConnector, TokenResponse, PostOptions, EngagementItemData, PostAnalytics, AccountAnalytics } from './types'

export class FacebookConnector implements ISocialConnector {
  platform = 'FACEBOOK' as const
  private accessToken: string

  constructor(accessToken: string) { this.accessToken = accessToken }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID ?? '',
      redirect_uri: `${process.env.API_BASE_URL ?? 'http://localhost:3001'}/api/v1/social/auth/facebook/callback`,
      scope: 'pages_manage_posts,pages_read_engagement,pages_manage_engagement',
      response_type: 'code'
    })
    return `https://www.facebook.com/v18.0/dialog/oauth?${params}`
  }

  async exchangeCode(code: string): Promise<TokenResponse> {
    // TODO: Exchange code for token via Facebook OAuth
    const res = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&redirect_uri=${process.env.API_BASE_URL}/api/v1/social/auth/facebook/callback&code=${code}`)
    const data = await res.json() as any
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined
    }
  }

  async refreshAccessToken(_refreshToken: string): Promise<TokenResponse> {
    // TODO: Exchange short-lived token for long-lived token
    // GET https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&...
    const res = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${this.accessToken}`)
    const data = await res.json() as any
    return { accessToken: data.access_token, expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined }
  }

  async postText(content: string, options?: PostOptions): Promise<string> {
    // TODO: POST https://graph.facebook.com/v18.0/{page-id}/feed
    const hashtags = options?.hashtags?.map(h => `#${h}`).join(' ') ?? ''
    const fullContent = options?.hashtags?.length ? `${content}\n\n${hashtags}` : content
    const res = await fetch(`https://graph.facebook.com/v18.0/me/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: fullContent, access_token: this.accessToken })
    })
    const data = await res.json() as any
    return data.id ?? ''
  }

  async postImage(content: string, imageUrl: string): Promise<string> {
    // TODO: POST https://graph.facebook.com/v18.0/{page-id}/photos
    const res = await fetch(`https://graph.facebook.com/v18.0/me/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: content, url: imageUrl, access_token: this.accessToken })
    })
    const data = await res.json() as any
    return data.id ?? ''
  }

  async postVideo(content: string, videoUrl: string): Promise<string> {
    // POST https://graph.facebook.com/v18.0/{page-id}/videos
    const res = await fetch('https://graph.facebook.com/v18.0/me/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: content, file_url: videoUrl, access_token: this.accessToken }),
    })
    const data = await res.json() as any
    if (!res.ok) throw new Error(`Facebook postVideo failed: ${data.error?.message ?? res.statusText}`)
    return data.id ?? ''
  }

  async postThread(tweets: string[]): Promise<string> {
    return this.postText(tweets.join('\n\n'))
  }

  async getComments(postId: string): Promise<EngagementItemData[]> {
    // TODO: GET https://graph.facebook.com/v18.0/{post-id}/comments
    const res = await fetch(`https://graph.facebook.com/v18.0/${postId}/comments?fields=id,message,from,created_time&access_token=${this.accessToken}`)
    const data = await res.json() as any
    return (data.data ?? []).map((c: any) => ({
      id: c.id,
      authorName: c.from?.name ?? '',
      authorHandle: c.from?.id ?? '',
      content: c.message ?? '',
      createdAt: new Date(c.created_time)
    }))
  }

  async getMentions(since: Date): Promise<EngagementItemData[]> {
    // GET https://graph.facebook.com/v18.0/me/tagged
    const sinceTs = Math.floor(since.getTime() / 1000)
    const res = await fetch(
      `https://graph.facebook.com/v18.0/me/tagged?fields=id,message,from,created_time&since=${sinceTs}&access_token=${this.accessToken}`
    )
    const data = await res.json() as any
    if (!res.ok) return []
    return (data.data ?? []).map((p: any) => ({
      id: p.id,
      authorName: p.from?.name ?? '',
      authorHandle: p.from?.id ?? '',
      content: p.message ?? '',
      createdAt: new Date(p.created_time),
    }))
  }

  async replyToComment(commentId: string, reply: string): Promise<void> {
    // TODO: POST https://graph.facebook.com/v18.0/{comment-id}/comments
    await fetch(`https://graph.facebook.com/v18.0/${commentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply, access_token: this.accessToken })
    })
  }

  async replyToMention(mentionId: string, reply: string): Promise<void> {
    return this.replyToComment(mentionId, reply)
  }

  async getPostAnalytics(postId: string): Promise<PostAnalytics> {
    // TODO: GET https://graph.facebook.com/v18.0/{post-id}/insights
    const res = await fetch(`https://graph.facebook.com/v18.0/${postId}/insights?metric=post_impressions,post_engaged_users,post_clicks&access_token=${this.accessToken}`)
    const data = await res.json() as any
    const metrics: Record<string, number> = {}
    for (const m of data.data ?? []) metrics[m.name] = m.values?.[0]?.value ?? 0
    return { impressions: metrics.post_impressions ?? 0, engagements: metrics.post_engaged_users ?? 0, clicks: metrics.post_clicks ?? 0, likes: 0, shares: 0, comments: 0 }
  }

  async getAccountAnalytics(period: string): Promise<AccountAnalytics> {
    // GET https://graph.facebook.com/v18.0/{page-id}/insights
    const periodMap: Record<string, string> = { day: 'day', week: 'week', month: 'days_28' }
    const rzPeriod = periodMap[period] ?? 'days_28'
    const res = await fetch(
      `https://graph.facebook.com/v18.0/me/insights?metric=page_impressions,page_engaged_users,page_post_engagements&period=${rzPeriod}&access_token=${this.accessToken}`
    )
    const data = await res.json() as any
    if (!res.ok) return { impressions: 0, engagements: 0, clicks: 0, signups: 0, conversions: 0 }

    const metrics: Record<string, number> = {}
    for (const m of data.data ?? []) {
      const latest = m.values?.[m.values.length - 1]?.value
      metrics[m.name] = typeof latest === 'number' ? latest : 0
    }

    return {
      impressions: metrics.page_impressions ?? 0,
      engagements: metrics.page_engaged_users ?? 0,
      clicks: metrics.page_post_engagements ?? 0,
      signups: 0,
      conversions: 0,
    }
  }
}
