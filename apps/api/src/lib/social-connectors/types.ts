export type SocialPlatformType = 'LINKEDIN' | 'TWITTER' | 'INSTAGRAM' | 'YOUTUBE' | 'WHATSAPP_BUSINESS' | 'FACEBOOK'

export interface TokenResponse {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  accountId?: string
  accountName?: string
}

export interface PostOptions {
  hashtags?: string[]
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  /** WhatsApp: E.164 phone number(s), comma-separated, e.g. "+919876543210" */
  recipient?: string
}

export interface PostContent {
  text: string
  mediaUrl?: string
  mediaType?: string
  hashtags?: string[]
}

export interface EngagementItemData {
  id: string
  authorName: string
  authorHandle: string
  content: string
  createdAt: Date
}

export interface PostAnalytics {
  impressions: number
  engagements: number
  clicks: number
  likes: number
  shares: number
  comments: number
}

export interface AccountAnalytics {
  impressions: number
  engagements: number
  clicks: number
  signups: number
  conversions: number
  topPostId?: string
}

export interface ISocialConnector {
  platform: SocialPlatformType
  getAuthUrl(): string
  exchangeCode(code: string): Promise<TokenResponse>
  refreshAccessToken(refreshToken: string): Promise<TokenResponse>
  postText(content: string, options?: PostOptions): Promise<string>
  postImage(content: string, imageUrl: string): Promise<string>
  postVideo(content: string, videoUrl: string): Promise<string>
  postThread(tweets: string[]): Promise<string>
  getComments(postId: string): Promise<EngagementItemData[]>
  getMentions(since: Date): Promise<EngagementItemData[]>
  replyToComment(commentId: string, reply: string): Promise<void>
  replyToMention(mentionId: string, reply: string): Promise<void>
  getPostAnalytics(postId: string): Promise<PostAnalytics>
  getAccountAnalytics(period: string): Promise<AccountAnalytics>
}
