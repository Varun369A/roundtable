import { ISocialConnector, TokenResponse, PostOptions, EngagementItemData, PostAnalytics, AccountAnalytics } from './types'

export class InstagramConnector implements ISocialConnector {
  platform = 'INSTAGRAM' as const
  private accessToken: string

  constructor(accessToken: string) { this.accessToken = accessToken }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID ?? '',
      redirect_uri: `${process.env.API_BASE_URL ?? 'http://localhost:3001'}/api/v1/social/auth/instagram/callback`,
      scope: 'instagram_basic,instagram_content_publish,pages_read_engagement',
      response_type: 'code'
    })
    return `https://www.facebook.com/v18.0/dialog/oauth?${params}`
  }

  async exchangeCode(code: string): Promise<TokenResponse> {
    const res = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${process.env.INSTAGRAM_APP_ID}&client_secret=${process.env.INSTAGRAM_APP_SECRET}&redirect_uri=${process.env.API_BASE_URL}/api/v1/social/auth/instagram/callback&code=${code}`)
    const data = await res.json() as any
    return { accessToken: data.access_token, expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined }
  }

  async refreshAccessToken(_refreshToken: string): Promise<TokenResponse> {
    const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${this.accessToken}`)
    const data = await res.json() as any
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) }
  }

  async postText(content: string, _options?: PostOptions): Promise<string> {
    const meRes = await fetch(`https://graph.instagram.com/me?fields=id&access_token=${this.accessToken}`)
    const me = await meRes.json() as any
    const mediaRes = await fetch(`https://graph.instagram.com/${me.id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: content, media_type: 'REELS', access_token: this.accessToken })
    })
    const media = await mediaRes.json() as any
    const publishRes = await fetch(`https://graph.instagram.com/${me.id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: media.id, access_token: this.accessToken })
    })
    const published = await publishRes.json() as any
    return published.id ?? ''
  }

  async postImage(content: string, imageUrl: string): Promise<string> {
    const meRes = await fetch(`https://graph.instagram.com/me?fields=id&access_token=${this.accessToken}`)
    const me = await meRes.json() as any
    const mediaRes = await fetch(`https://graph.instagram.com/${me.id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption: content, access_token: this.accessToken })
    })
    const media = await mediaRes.json() as any
    const publishRes = await fetch(`https://graph.instagram.com/${me.id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: media.id, access_token: this.accessToken })
    })
    const published = await publishRes.json() as any
    return published.id ?? ''
  }

  async postVideo(content: string, _videoUrl: string): Promise<string> { return this.postText(content) }
  async postThread(tweets: string[]): Promise<string> { return this.postText(tweets.join('\n')) }

  async getComments(postId: string): Promise<EngagementItemData[]> {
    const res = await fetch(`https://graph.instagram.com/${postId}/comments?fields=id,text,username,timestamp&access_token=${this.accessToken}`)
    const data = await res.json() as any
    return (data.data ?? []).map((c: any) => ({ id: c.id, authorName: c.username, authorHandle: `@${c.username}`, content: c.text, createdAt: new Date(c.timestamp) }))
  }

  async getMentions(_since: Date): Promise<EngagementItemData[]> { return [] }

  async replyToComment(commentId: string, reply: string): Promise<void> {
    await fetch(`https://graph.instagram.com/${commentId}/replies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: reply, access_token: this.accessToken }) })
  }

  async replyToMention(mentionId: string, reply: string): Promise<void> { return this.replyToComment(mentionId, reply) }

  async getPostAnalytics(postId: string): Promise<PostAnalytics> {
    const res = await fetch(`https://graph.instagram.com/${postId}/insights?metric=impressions,reach,likes_count,comments_count&access_token=${this.accessToken}`)
    const data = await res.json() as any
    const metrics: Record<string, number> = {}
    for (const m of data.data ?? []) metrics[m.name] = m.values?.[0]?.value ?? 0
    return { impressions: metrics.impressions ?? 0, engagements: (metrics.likes_count ?? 0) + (metrics.comments_count ?? 0), clicks: 0, likes: metrics.likes_count ?? 0, shares: 0, comments: metrics.comments_count ?? 0 }
  }

  async getAccountAnalytics(_period: string): Promise<AccountAnalytics> { return { impressions: 0, engagements: 0, clicks: 0, signups: 0, conversions: 0 } }
}
