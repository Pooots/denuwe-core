import type { FeedAuthor } from '@/types/feed'

/** The other person in a 1-to-1 conversation. */
export type ChatPerson = FeedAuthor & {
  banner_url?: string | null
  headline?: string | null
  location?: string | null
}

/** A saved message, as returned by the API and pushed by the `MessageSent` broadcast. */
export type ChatMessage = {
  id: number
  conversation_id: number
  sender_id: number
  sender: FeedAuthor | null
  message: string
  message_type: 'text'
  is_read: boolean
  read_at: string | null
  created_at: string | null
  /** Echoed back to the sender so its optimistic copy can be swapped for the saved one. */
  client_id?: string | null
}

/** A message you sent that isn't saved yet: `sending`, or `failed` with a retry. */
export type PendingMessage = {
  client_id: string
  conversation_id: number
  message: string
  created_at: string
  status: 'sending' | 'failed'
  error?: string
}

export type ConversationSummary = {
  id: number
  other_participant: ChatPerson | null
  latest_message: ChatMessage | null
  latest_message_at: string | null
  unread_count: number
  created_at: string | null
}

export type ConversationList = {
  data: Array<ConversationSummary>
  unread_count: number
}

/** One page of messages, oldest to newest. Ask for `before: next_before` to get the page before it. */
export type MessagePage = {
  data: Array<ChatMessage>
  has_more: boolean
  next_before: number | null
}

export type SendResult = {
  data: ChatMessage
  /** False when Reverb couldn't be reached; the message is saved either way. */
  live: boolean
}

export type ReadResult = {
  conversation_id: number
  message_ids: Array<number>
  read_at: string | null
  unread_count: number
}

/** Broadcast when someone reads the messages sent to them. */
export type MessagesReadEvent = {
  conversation_id: number
  reader_id: number
  message_ids: Array<number>
  read_at: string
}
