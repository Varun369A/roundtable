import { ISocialConnector, TokenResponse, PostOptions, EngagementItemData, PostAnalytics, AccountAnalytics } from './types'

export class TwitterConnector implements ISocialConnector {
  platform = 'TWITTER' as const
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.TWITTER_CLIENT_ID ?? '',
      redirect_uri: process.env.TWITTER_REDIRECT_URI ?? '',
      scope: 'tweet.read tweet.write users.read offline.access',
      state: crypto.randomUUID(),
      code_challenge: 'challenge',
      code_challenge_method: 'plain'
    })
    return `https://twitter.com/i/oauth2/authorize?${params}`
  }

  async exchangeCode(code: string): Promise<TokenResponse> {
    const credentials = Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString('base64')
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${credentials}` },
      body: new URLSearchParams({ code, grant_type: 'authorization_code', redirect_uri: process.env.TWITTER_REDIRECT_URI ?? '', code_verifier: 'challenge' })
    })
    const data = await res.json() as any
    const meRes = await fetch('https://api.twitter.com/2/users/me', { headers: { Authorization: `Bearer ${data.access_token}` } })
    const me = await meRes.json() as any
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      accountId: me.data?.id,
      accountName: me.data?.username
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const credentials = Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString('base64')
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${credentials}` },
      body: new URLSearchParams({ refresh_token: refreshToken, grant_type: 'refresh_token' })
    })
    const data = await res.json() as any
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined }
  }

  async postText(content: string, options?: PostOptions): Promise<string> {
    const text = options?.hashtags?.length ? `${content}\n${options.hashtags.map(h => `#${h}`).join(' ')}` : content
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 280) })
    })
    const data = await res.json() as any
    return data.data?.id ?? ''
  }

  async postImage(content: string, _imageUrl: string): Promise<string> {
    return this.postText(content)
  }

  async postVideo(content: string, _videoUrl: string): Promise<string> {
    return this.postText(content)
  }

  async postThread(tweets: string[]): Promise<string> {
    let lastId: string | undefined
    let firstId = ''
    for (const tweet of tweets) {
      const body: any = { text: tweet.slice(0, 280) }
      if (lastId) body.reply = { in_reply_to_tweet_id: lastId }
      const res = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json() as any
      const id = data.data?.id ?? ''
      if (!firstId) firstId = id
      lastId = id
    }
    return firstId
  }

  async getComments(postId: string): Promise<EngagementItemData[]> {
    const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${postId}&tweet.fields=author_id,created_at,text&expansions=author_id&user.fields=name,username`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    })
    const data = await res.json() as any
    const users: Record<string, any> = {}
    for (const u of data.includes?.users ?? []) users[u.id] = u
    return (data.data ?? []).map((t: any) => ({
      id: t.id,
      authorName: users[t.author_id]?.name ?? '',
      authorHandle: `@${users[t.author_id]?.username ?? ''}`,
      content: t.text,
      createdAt: new Date(t.created_at)
    }))
  }

  async getMentions(since: Date): Promise<EngagementItemData[]> {
    const meRes = await fetch('https://api.twitter.com/2/users/me', { headers: { Authorization: `Bearer ${this.accessToken}` } })
    const me = await meRes.json() as any
    const userId = me.data?.id
    if (!userId) return []
    const startTime = since.toISOString()
    const res = await fetch(`https://api.twitter.com/2/users/${userId}/mentions?start_time=${startTime}&tweet.fields=author_id,created_at&expansions=author_id&user.fields=name,username`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    })
    const data = await res.json() as any
    const users: Record<string, any> = {}
    for (const u of data.includes?.users ?? []) users[u.id] = u
    return (data.data ?? []).map((t: any) => ({
      id: t.id,
      authorName: users[t.author_id]?.name ?? '',
      authorHandle: `@${users[t.author_id]?.username ?? ''}`,
      content: t.text,
      createdAt: new Date(t.created_at)
    }))
  }

  async replyToComment(commentId: string, reply: string): Promise<void> {
    await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: reply.slice(0, 280), reply: { in_reply_to_tweet_id: commentId } })
    })
  }

  async replyToMention(mentionId: string, reply: string): Promise<void> {
    return this.replyToComment(mentionId, reply)
  }

  async getPostAnalytics(postId: string): Promise<PostAnalytics> {
    const res = await fetch(`https://api.twitter.com/2/tweets/${postId}?tweet.fields=public_metrics`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    })
    const data = await res.json() as any
    const m = data.data?.public_metrics ?? {}
    return { impressions: m.impression_count ?? 0, engagements: (m.like_count ?? 0) + (m.reply_count ?? 0) + (m.retweet_count ?? 0), clicks: m.url_link_clicks ?? 0, likes: m.like_count ?? 0, shares: m.retweet_count ?? 0, comments: m.reply_count ?? 0 }
  }

  async getAccountAnalytics(_period: string): Promise<AccountAnalytics> {
    return { impressions: 0, engagements: 0, clicks: 0, signups: 0, conversions: 0 }
  }
}
