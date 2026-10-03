import type { ConversationList, ConversationSummary, MessagePage, ReadResult, SendResult } from '@/types/chat'
import { api } from '@/lib/api'

/** Real-time 1-to-1 messaging API. The sender is always the signed-in user (from the JWT). */
export const chatService = {
  async list(): Promise<ConversationList> {
    const { data } = await api.get<ConversationList>('/conversations')
    return data
  },

  /** Open the conversation with a friend, creating it on first use. */
  async open(userId: number): Promise<ConversationSummary> {
    const { data } = await api.post<{ data: ConversationSummary }>('/conversations', { user_id: userId })
    return data.data
  },

  async get(conversationId: number): Promise<ConversationSummary> {
    const { data } = await api.get<{ data: ConversationSummary }>(`/conversations/${conversationId}`)
    return data.data
  },

  /** Latest 50 messages, or the 50 before `before` (a message id). */
  async messages(conversationId: number, before?: number): Promise<MessagePage> {
    const { data } = await api.get<MessagePage>(`/conversations/${conversationId}/messages`, {
      params: before ? { before } : undefined,
    })
    return data
  },

  async send(conversationId: number, message: string, clientId: string): Promise<SendResult> {
    const { data } = await api.post<SendResult>(`/conversations/${conversationId}/messages`, {
      message,
      client_id: clientId,
    })
    return data
  },

  async markRead(conversationId: number): Promise<ReadResult> {
    const { data } = await api.post<ReadResult>(`/conversations/${conversationId}/read`)
    return data
  },
}
