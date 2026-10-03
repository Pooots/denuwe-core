import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ChatMessage, MessagesReadEvent } from '@/types/chat'
import {
  addPending,
  applyRead,
  chatRefetchInterval,
  chatStaleTime,
  findPending,
  markRead,
  messagesKey,
  receiveMessage,
  removePending,
  showConversation,
  updatePending,
  usePending,
} from '@/components/chat/chatCache'
import { useTypers, useTypingNotifier } from '@/components/chat/typing'
import { toast } from '@/components/feed/Toaster'
import { apiErrorMessage, authService } from '@/services/authService'
import { chatService } from '@/services/chatService'
import { isRealtimeConfigured, joinPrivate, leavePrivate, watchPresence } from '@/services/realtime'

function subscribeVisibility(listener: () => void): () => void {
  document.addEventListener('visibilitychange', listener)
  return () => document.removeEventListener('visibilitychange', listener)
}

function newClientId(): string {
  // randomUUID only exists on secure origins (https / localhost), not e.g. http://192.168.x.x.
  return window.isSecureContext
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * One conversation: its messages (newest 50 first, older pages on demand), live updates on
 * `private-conversation.{id}`, who's typing, read marking while it's on screen, and sending with retry.
 */
export function useChatThread(conversationId: number, active = true) {
  const qc = useQueryClient()
  const viewer = useSyncExternalStore(authService.subscribe, authService.getUser)
  const viewerId = viewer?.id ?? 0
  const visible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState === 'visible')

  const query = useInfiniteQuery({
    queryKey: messagesKey(conversationId),
    queryFn: ({ pageParam }) => chatService.messages(conversationId, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.has_more && last.next_before ? last.next_before : undefined),
    staleTime: chatStaleTime,
    refetchInterval: chatRefetchInterval,
  })

  const messages = useMemo(
    () => (query.data ? [...query.data.pages].reverse().flatMap((page) => page.data) : []),
    [query.data],
  )
  const allPending = usePending(conversationId)
  const pending = useMemo(() => {
    const saved = new Set(messages.map((m) => m.client_id).filter(Boolean))
    return allPending.filter((p) => !saved.has(p.client_id))
  }, [messages, allPending])

  const [liveError, setLiveError] = useState<string | null>(null)

  useEffect(() => {
    if (!viewerId) return
    const name = `conversation.${conversationId}`
    const channel = joinPrivate(name)
    if (!channel) return

    const onMessage = (message: ChatMessage) => receiveMessage(qc, message, viewerId)
    const onRead = (event: MessagesReadEvent) => applyRead(qc, event, viewerId)
    const onSubscribed = () => setLiveError(null)
    const onError = (error: { error?: string } | undefined) =>
      setLiveError(error?.error || 'Live updates for this chat are unavailable.')

    channel.listen('.MessageSent', onMessage).listen('.MessagesRead', onRead)
    channel.subscription.bind('pusher:subscription_succeeded', onSubscribed)
    channel.subscription.bind('pusher:subscription_error', onError)

    return () => {
      channel.stopListening('.MessageSent', onMessage).stopListening('.MessagesRead', onRead)
      channel.subscription.unbind('pusher:subscription_succeeded', onSubscribed)
      channel.subscription.unbind('pusher:subscription_error', onError)
      leavePrivate(name)
    }
  }, [conversationId, viewerId, qc])

  useEffect(() => watchPresence(conversationId), [conversationId])

  const reading = active && visible
  useEffect(() => (reading ? showConversation(conversationId) : undefined), [conversationId, reading])

  const hasUnread = messages.some((m) => m.sender_id !== viewerId && !m.is_read)
  useEffect(() => {
    if (reading && hasUnread && viewerId) markRead(qc, conversationId, viewerId)
  }, [reading, hasUnread, conversationId, viewerId, qc])

  // Typing travels as whispers on the conversation's presence channel (watched above), so lists can show it too.
  const typing = useTypers(`c:${conversationId}`)
  const { notify: notifyTyping, stop: stopTyping } = useTypingNotifier(`c:${conversationId}`)

  // ---- Sending ----

  const warnedOffline = useRef(false)

  const deliver = useCallback(
    async (clientId: string, text: string) => {
      try {
        const result = await chatService.send(conversationId, text, clientId)
        receiveMessage(qc, { ...result.data, client_id: clientId }, viewerId)
        if (!result.live && isRealtimeConfigured && !warnedOffline.current) {
          warnedOffline.current = true
          toast('Message saved, but live delivery is down. It will show up for them when they reconnect.', 'error')
        }
      } catch (error) {
        updatePending(conversationId, clientId, {
          status: 'failed',
          error: apiErrorMessage(error, 'Message not sent.'),
        })
      }
    },
    [conversationId, viewerId, qc],
  )

  const send = useCallback(
    (text: string) => {
      const message = text.trim()
      if (!message) return Promise.reject(new Error('Write a message first.'))
      stopTyping()
      const clientId = newClientId()
      addPending({
        client_id: clientId,
        conversation_id: conversationId,
        message,
        created_at: new Date().toISOString(),
        status: 'sending',
      })
      void deliver(clientId, message)
      return Promise.resolve()
    },
    [conversationId, deliver, stopTyping],
  )

  const retry = useCallback(
    (clientId: string) => {
      const message = findPending(conversationId, clientId)
      if (!message || message.status === 'sending') return
      updatePending(conversationId, clientId, { status: 'sending', error: undefined })
      void deliver(clientId, message.message)
    },
    [conversationId, deliver],
  )

  const discard = useCallback((clientId: string) => removePending(conversationId, clientId), [conversationId])

  return { query, messages, pending, typing, liveError, viewerId, send, retry, discard, notifyTyping }
}
