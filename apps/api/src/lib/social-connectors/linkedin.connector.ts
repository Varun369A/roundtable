import { ISocialConnector, TokenResponse, PostOptions, EngagementItemData, PostAnalytics, AccountAnalytics } from './types'

export class LinkedInConnector implements ISocialConnector {
  platform = 'LINKEDIN' as const
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI ?? '',
      scope: 'r_liteprofile r_emailaddress w_member_social',
      state: crypto.randomUUID()
    })
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`
  }

  async exchangeCode(code: string): Promise<TokenResponse> {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI ?? '',
        client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? ''
      })
    })
    const data = await res.json() as any
    const profileRes = await fetch('https://api.linkedin.com/v2/me', { headers: { Authorization: `Bearer ${data.access_token}` } })
    const profile = await profileRes.json() as any
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      accountId: profile.id,
      accountName: `${profile.localizedFirstName} ${profile.localizedLastName}`
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? ''
      })
    })
    const data = await res.json() as any
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined
    }
  }

  async postText(content: string, options?: PostOptions): Promise<string> {
    // Get author URN first
    const meRes = await fetch('https://api.linkedin.com/v2/me', { headers: { Authorization: `Bearer ${this.accessToken}` } })
    const me = await meRes.json() as any
    const authorUrn = `urn:li:person:${me.id}`
    const hashtagText = options?.hashtags?.map(h => `#${h}`).join(' ') ?? ''
    const fullContent = options?.hashtags?.length ? `${content}\n\n${hashtagText}` : content
    const body = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: fullContent }, shareMediaCategory: 'NONE' } },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    }
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
      body: JSON.stringify(body)
    })
    const data = await res.json() as any
    return data.id ?? ''
  }

  async postImage(content: string, _imageUrl: string): Promise<string> {
    return this.postText(content)
  }

  async postVideo(content: string, _videoUrl: string): Promise<string> {
    return this.postText(content)
  }

  async postThread(tweets: string[]): Promise<string> {
    return this.postText(tweets.join('\n\n'))
  }

  async getComments(postId: string): Promise<EngagementItemData[]> {
    const res = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postId)}/comments`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    })
    const data = await res.json() as any
    return (data.elements ?? []).map((c: any) => ({
      id: c.$URN ?? '',
      authorName: c.actor ?? '',
      authorHandle: c.actor ?? '',
      content: c.message?.text ?? '',
      createdAt: new Date(c.created?.time ?? Date.now())
    }))
  }

  async getMentions(_since: Date): Promise<EngagementItemData[]> {
    return []
  }

  async replyToComment(commentId: string, reply: string): Promise<void> {
    const meRes = await fetch('https://api.linkedin.com/v2/me', { headers: { Authorization: `Bearer ${this.accessToken}` } })
    const me = await meRes.json() as any
    await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(commentId)}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: `urn:li:person:${me.id}`, message: { text: reply } })
    })
  }

  async replyToMention(mentionId: string, reply: string): Promise<void> {
    return this.replyToComment(mentionId, reply)
  }

  async getPostAnalytics(postId: string): Promise<PostAnalytics> {
    const res = await fetch(`https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(postId)}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    })
    const data = await res.json() as any
    const s = data.elements?.[0]?.totalShareStatistics ?? {}
    return { impressions: s.impressionCount ?? 0, engagements: s.engagement ?? 0, clicks: s.clickCount ?? 0, likes: s.likeCount ?? 0, shares: s.shareCount ?? 0, comments: s.commentCount ?? 0 }
  }

  async getAccountAnalytics(_period: string): Promise<AccountAnalytics> {
    return { impressions: 0, engagements: 0, clicks: 0, signups: 0, conversions: 0 }
  }
}
