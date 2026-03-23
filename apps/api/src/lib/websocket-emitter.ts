import { redis } from './redis'

export interface WSEvent {
  type: 'message.new' | 'message.edit' | 'message.delete' |
        'member.join' | 'member.leave' |
        'typing.start' | 'typing.stop' |
        'conversation.archive' | 'group.collab.invite'
  conversationId: string
  payload: object
  timestamp: string
}

export async function emitToConversation(
  conversationId: string,
  event: WSEvent
): Promise<void> {
  try {
    await redis.publish(
      `arivarangam:ws:${conversationId}`,
      JSON.stringify(event)
    )
  } catch (err) {
    console.error('[WS Emitter] Failed to publish event:', err)
  }
}
