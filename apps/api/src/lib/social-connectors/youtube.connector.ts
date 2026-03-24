// YouTube Data API v3 (https://developers.google.com/youtube/v3)
// Required scopes: youtube.upload, youtube.force-ssl, youtube.readonly
import { ISocialConnector, TokenResponse, PostOptions, EngagementItemData, PostAnalytics, AccountAnalytics } from './types'

export class YouTubeConnector implements ISocialConnector {
  platform = 'YOUTUBE' as const
  private accessToken: string

  constructor(accessToken: string) { this.accessToken = accessToken }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID ?? '',
      redirect_uri: `${process.env.API_BASE_URL ?? 'http://localhost:3001'}/api/v1/social/auth/youtube/callback`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/youtube.readonly',
      access_type: 'offline',
      prompt: 'consent',
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  async exchangeCode(code: string): Promise<TokenResponse> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.YOUTUBE_CLIENT_ID ?? '',
        client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? '',
        redirect_uri: `${process.env.API_BASE_URL ?? 'http://localhost:3001'}/api/v1/social/auth/youtube/callback`,
        grant_type: 'authorization_code',
      }),
    })
    const data = await res.json() as any
    if (data.error) throw new Error(`YouTube OAuth error: ${data.error_description ?? data.error}`)
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.YOUTUBE_CLIENT_ID ?? '',
        client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? '',
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json() as any
    if (data.error) throw new Error(`YouTube token refresh error: ${data.error_description ?? data.error}`)
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    }
  }

  /** YouTube text-only → Community post (requires channel with 500+ subscribers) */
  async postText(content: string, options?: PostOptions): Promise<string> {
    const text = options?.hashtags?.length
      ? `${content}\n\n${options.hashtags.map(h => `#${h}`).join(' ')}`
      : content

    // Community posts API
    const res = await fetch('https://www.googleapis.com/youtube/v3/communityPosts?part=snippet', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          type: 'textPost',
          textOriginalPost: { text },
        },
      }),
    })
    const data = await res.json() as any
    if (!res.ok) throw new Error(`YouTube community post failed: ${data.error?.message ?? res.statusText}`)
    return data.id ?? ''
  }

  /** YouTube image community post */
  async postImage(content: string, imageUrl: string): Promise<string> {
    const res = await fetch('https://www.googleapis.com/youtube/v3/communityPosts?part=snippet', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          type: 'imagePost',
          imagePost: { imageUrl },
          textOriginalPost: { text: content },
        },
      }),
    })
    const data = await res.json() as any
    if (!res.ok) throw new Error(`YouTube image post failed: ${data.error?.message ?? res.statusText}`)
    return data.id ?? ''
  }

  /**
   * Upload a video via the YouTube resumable upload API.
   * videoUrl must be a publicly accessible URL; we fetch it and upload to YouTube.
   */
  async postVideo(content: string, videoUrl: string): Promise<string> {
    // Step 1: Fetch the video bytes
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Failed to fetch video from ${videoUrl}: ${videoRes.statusText}`)
    const videoBuffer = await videoRes.arrayBuffer()
    const contentType = videoRes.headers.get('content-type') ?? 'video/mp4'

    // Step 2: Initiate resumable upload session
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': contentType,
          'X-Upload-Content-Length': String(videoBuffer.byteLength),
        },
        body: JSON.stringify({
          snippet: {
            title: content.slice(0, 100),
            description: content,
            categoryId: '22', // People & Blogs
          },
          status: { privacyStatus: 'public' },
        }),
      }
    )
    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({})) as any
      throw new Error(`YouTube upload init failed: ${err.error?.message ?? initRes.statusText}`)
    }

    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) throw new Error('YouTube did not return upload URL')

    // Step 3: Upload the video bytes
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(videoBuffer.byteLength),
      },
      body: videoBuffer,
    })
    const uploadData = await uploadRes.json() as any
    if (!uploadRes.ok) throw new Error(`YouTube video upload failed: ${uploadData.error?.message ?? uploadRes.statusText}`)
    return uploadData.id ?? ''
  }

  async postThread(tweets: string[]): Promise<string> {
    return this.postText(tweets.join('\n'))
  }

  async getComments(postId: string): Promise<EngagementItemData[]> {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(postId)}&maxResults=100`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    )
    const data = await res.json() as any
    if (!res.ok) throw new Error(`YouTube getComments failed: ${data.error?.message ?? res.statusText}`)
    return (data.items ?? []).map((item: any) => {
      const c = item.snippet?.topLevelComment?.snippet ?? {}
      return {
        id: item.id,
        authorName: c.authorDisplayName ?? '',
        authorHandle: c.authorChannelId?.value ?? '',
        content: c.textDisplay ?? '',
        createdAt: new Date(c.publishedAt),
      }
    })
  }

  /** YouTube has no direct mentions API; return empty list */
  async getMentions(_since: Date): Promise<EngagementItemData[]> {
    return []
  }

  async replyToComment(commentId: string, reply: string): Promise<void> {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/comments?part=snippet',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            parentId: commentId,
            textOriginal: reply,
          },
        }),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any
      throw new Error(`YouTube reply failed: ${err.error?.message ?? res.statusText}`)
    }
  }

  async replyToMention(mentionId: string, reply: string): Promise<void> {
    return this.replyToComment(mentionId, reply)
  }

  async getPostAnalytics(postId: string): Promise<PostAnalytics> {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(postId)}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    )
    const data = await res.json() as any
    const stats = data.items?.[0]?.statistics ?? {}
    return {
      impressions: Number(stats.viewCount ?? 0),
      engagements: Number(stats.likeCount ?? 0) + Number(stats.commentCount ?? 0),
      clicks: 0,
      likes: Number(stats.likeCount ?? 0),
      shares: 0,
      comments: Number(stats.commentCount ?? 0),
    }
  }

  async getAccountAnalytics(_period: string): Promise<AccountAnalytics> {
    // YouTube Analytics API requires separate OAuth scope (youtube.readonly)
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true',
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    )
    const data = await res.json() as any
    const stats = data.items?.[0]?.statistics ?? {}
    return {
      impressions: Number(stats.viewCount ?? 0),
      engagements: Number(stats.commentCount ?? 0),
      clicks: 0,
      signups: 0,
      conversions: Number(stats.subscriberCount ?? 0),
    }
  }
}
