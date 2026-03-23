import { decryptToken } from '../social-crypto'
import { ISocialConnector, SocialPlatformType } from './types'
import { LinkedInConnector } from './linkedin.connector'
import { TwitterConnector } from './twitter.connector'
import { InstagramConnector } from './instagram.connector'
import { YouTubeConnector } from './youtube.connector'
import { WhatsAppConnector } from './whatsapp.connector'
import { FacebookConnector } from './facebook.connector'

export function getConnector(platform: SocialPlatformType, encryptedToken: string): ISocialConnector {
  const token = decryptToken(encryptedToken)
  switch (platform) {
    case 'LINKEDIN': return new LinkedInConnector(token)
    case 'TWITTER': return new TwitterConnector(token)
    case 'INSTAGRAM': return new InstagramConnector(token)
    case 'YOUTUBE': return new YouTubeConnector(token)
    case 'WHATSAPP_BUSINESS': return new WhatsAppConnector(token)
    case 'FACEBOOK': return new FacebookConnector(token)
    default: throw new Error(`Unknown platform: ${platform}`)
  }
}

export { LinkedInConnector, TwitterConnector, InstagramConnector }
export * from './types'
