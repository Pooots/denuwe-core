import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type {
  ChatMessage,
  ConversationList,
  ConversationSummary,
  MessagePage,
  MessagesReadEvent,
  PendingMessage,
} from '@/types/chat'
import type { SocietyOverview } from '@/types/society'
import { SOCIETY_OVERVIEW_KEY } from '@/components/society/societyUi'
import { stopShowingTyping } from '@/components/chat/typing'
import { POLL_MS } from '@/lib/polling'
import { chatService } from '@/services/chatService'
import { getRealtimeStatus } from '@/services/realtime'

/**
 * Client-side state for 1-to-1 chat. Saved messages live in react-query; live events (and your own sends)
 * are merged in by id, so a message is never shown twice. Messages still on their way live in a separate
 * store, so refetches can't drop them.
 */

export const CHAT_KEY = ['chat'] as const
export const CONVERSATIONS_KEY = ['chat', 'conversations'] as const
export const conversationKey = (id: number) => ['chat', 'conversation', id] as const
export const messagesKey = (id: number) => ['chat', 'messages', id] as const
export const directConversationKey = (userId: number) => ['chat', 'direct', userId] as const

export type MessagePages = InfiniteData<MessagePage, number | undefined>

/** While connected, live events keep chat data current (and a reconnect refetches it); otherwise it goes stale normally. */
export const chatStaleTime = () => (getRealtimeStatus() === 'connected' ? Infinity : 30_000)

/** Without a live connection, chat data is fetched again every few seconds instead. */
export const chatRefetchInterval = () => (getRealtimeStatus() === 'connected' ? false : POLL_MS)

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => chatService.list(),
    staleTime: chatStaleTime,
    refetchInterval: chatRefetchInterval,
    enabled,
  })
}

/** The conversation with a friend: the id My Society already knows, or one opened (created) on demand. */
export function useDirectConversation(person: { id: number; conversation_id?: number | null } | null, enabled = true) {
  const qc = useQueryClient()
  const known = person?.conversation_id ?? null
  const userId = person?.id ?? 0
  const opened = useQuery({
    queryKey: directConversationKey(userId),
    queryFn: async () => {
      const summary = await chatService.open(userId)
      qc.setQueryData(conversationKey(summary.id), summary)
      return summary
    },
    enabled: enabled && userId > 0 && known === null,
    staleTime: Infinity,
  })
  return {
    conversationId: known ?? opened.data?.id ?? null,
    error: opened.error,
    retry: () => void opened.refetch(),
  }
}

/** Refetch everything chat-related, e.g. after the connection comes back and events may have been missed. */
export function resyncChat(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: CHAT_KEY })
  void qc.invalidateQueries({ queryKey: SOCIETY_OVERVIEW_KEY })
}

// ---- Messages on their way ----

const NO_PENDING: Array<PendingMessage> = []
const pending = new Map<number, Array<PendingMessage>>()
const pendingListeners = new Set<() => void>()

function setPending(conversationId: number, list: Array<PendingMessage>): void {
  if (list.length > 0) pending.set(conversationId, list)
  else pending.delete(conversationId)
  pendingListeners.forEach((listener) => listener())
}

export function addPending(message: PendingMessage): void {
  setPending(message.conversation_id, [...(pending.get(message.conversation_id) ?? []), message])
}

export function updatePending(conversationId: number, clientId: string, patch: Partial<PendingMessage>): void {
  const list = pending.get(conversationId)
  if (!list?.some((m) => m.client_id === clientId)) return
  setPending(
    conversationId,
    list.map((m) => (m.client_id === clientId ? { ...m, ...patch } : m)),
  )
}

export function removePending(conversationId: number, clientId: string): void {
  const list = pending.get(conversationId)
  if (!list?.some((m) => m.client_id === clientId)) return
  setPending(
    conversationId,
    list.filter((m) => m.client_id !== clientId),
  )
}

export function findPending(conversationId: number, clientId: string): PendingMessage | undefined {
  return pending.get(conversationId)?.find((m) => m.client_id === clientId)
}

function subscribePending(listener: () => void): () => void {
  pendingListeners.add(listener)
  return () => pendingListeners.delete(listener)
}

export function usePending(conversationId: number): Array<PendingMessage> {
  return useSyncExternalStore(subscribePending, () => pending.get(conversationId) ?? NO_PENDING)
}

// ---- Which conversations are on screen ----

const onScreen = new Map<number, number>()

/** Mark a conversation as open on screen; its new messages are then read instead of counted as unread. */
export function showConversation(conversationId: number): () => void {
  onScreen.set(conversationId, (onScreen.get(conversationId) ?? 0) + 1)
  return () => {
    const count = (onScreen.get(conversationId) ?? 1) - 1
    if (count > 0) onScreen.set(conversationId, count)
    else onScreen.delete(conversationId)
  }
}

function isReading(conversationId: number): boolean {
  return onScreen.has(conversationId) && document.visibilityState === 'visible'
}

// ---- Applying messages and read receipts ----

/** Ids already counted in the conversation list, so an event that arrives twice isn't counted twice. */
const counted = new Set<number>()

function firstTime(messageId: number): boolean {
  if (counted.has(messageId)) return false
  counted.add(messageId)
  if (counted.size > 1000) counted.delete(counted.values().next().value as number)
  return true
}

function upsertMessage(qc: QueryClient, message: ChatMessage): void {
  qc.setQueryData<MessagePages>(messagesKey(message.conversation_id), (data) => {
    if (!data) return data
    const owner = data.pages.findIndex((page) => page.data.some((m) => m.id === message.id))
    if (owner >= 0) {
      if (!message.client_id) return data
      return {
        ...data,
        pages: data.pages.map((page, i) =>
          i === owner
            ? {
                ...page,
                data: page.data.map((m) => (m.id === message.id ? { ...m, client_id: message.client_id } : m)),
              }
            : page,
        ),
      }
    }
    const newest = data.pages.at(0)
    if (!newest) return data
    const merged = [...newest.data, message].sort((a, b) => a.id - b.id)
    return { ...data, pages: [{ ...newest, data: merged }, ...data.pages.slice(1)] }
  })
}

function setList(qc: QueryClient, data: Array<ConversationSummary>): void {
  qc.setQueryData<ConversationList>(CONVERSATIONS_KEY, {
    data,
    unread_count: data.reduce((total, c) => total + c.unread_count, 0),
  })
}

async function addToList(qc: QueryClient, conversationId: number): Promise<void> {
  try {
    const summary = await chatService.get(conversationId)
    qc.setQueryData(conversationKey(conversationId), summary)
    const list = qc.getQueryData<ConversationList>(CONVERSATIONS_KEY)
    if (!list) return
    const current = list.data.find((c) => c.id === conversationId)
    if (current && (current.latest_message?.id ?? 0) > (summary.latest_message?.id ?? 0)) return
    setList(qc, [summary, ...list.data.filter((c) => c.id !== conversationId)])
  } catch {
    void qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY })
  }
}

function patchList(qc: QueryClient, message: ChatMessage, countAsUnread: boolean): void {
  const list = qc.getQueryData<ConversationList>(CONVERSATIONS_KEY)
  if (!list) return
  const current = list.data.find((c) => c.id === message.conversation_id)
  if (!current) {
    void addToList(qc, message.conversation_id)
    return
  }
  const newer = !current.latest_message || message.id > current.latest_message.id
  const next: ConversationSummary = {
    ...current,
    ...(newer ? { latest_message: message, latest_message_at: message.created_at } : {}),
    unread_count: current.unread_count + (countAsUnread ? 1 : 0),
  }
  setList(
    qc,
    newer ? [next, ...list.data.filter((c) => c.id !== next.id)] : list.data.map((c) => (c.id === next.id ? next : c)),
  )
}

function otherParticipantId(qc: QueryClient, conversationId: number): number | undefined {
  const fromList = qc
    .getQueryData<ConversationList>(CONVERSATIONS_KEY)
    ?.data.find((c) => c.id === conversationId)?.other_participant
  return fromList?.id ?? qc.getQueryData<ConversationSummary>(conversationKey(conversationId))?.other_participant?.id
}

/** Keep My Society's list (and the navbar badge that reads it) in step with the new message. */
function patchOverview(qc: QueryClient, message: ChatMessage, viewerId: number, countAsUnread: boolean): void {
  const overview = qc.getQueryData<SocietyOverview>(SOCIETY_OVERVIEW_KEY)
  if (!overview) return
  const mine = message.sender_id === viewerId
  const friendId = mine ? otherParticipantId(qc, message.conversation_id) : message.sender_id
  const friend = overview.friends.find((p) => p.conversation_id === message.conversation_id || p.id === friendId)
  if (!friend) {
    void qc.invalidateQueries({ queryKey: SOCIETY_OVERVIEW_KEY })
    return
  }
  if (friend.last_message && friend.last_message.id >= message.id) return

  const updated = {
    ...friend,
    conversation_id: message.conversation_id,
    last_message: {
      id: message.id,
      body: message.message,
      mine,
      created_at: message.created_at,
      read_at: message.read_at,
    },
    unread_count: friend.unread_count + (countAsUnread ? 1 : 0),
  }
  qc.setQueryData<SocietyOverview>(SOCIETY_OVERVIEW_KEY, {
    ...overview,
    friends: [updated, ...overview.friends.filter((p) => p.id !== friend.id)],
    unread_count: overview.unread_count + (countAsUnread ? 1 : 0),
  })
}

/**
 * A saved message, from the API response to your own send or from a `MessageSent` event.
 * Safe to call more than once for the same message.
 */
export function receiveMessage(qc: QueryClient, message: ChatMessage, viewerId: number): void {
  stopShowingTyping(`c:${message.conversation_id}`, message.sender_id)
  upsertMessage(qc, message)
  if (message.client_id) removePending(message.conversation_id, message.client_id)
  if (!firstTime(message.id)) return

  const mine = message.sender_id === viewerId
  const reading = !mine && isReading(message.conversation_id)
  patchList(qc, message, !mine && !reading)
  patchOverview(qc, message, viewerId, !mine && !reading)
  if (reading) markRead(qc, message.conversation_id, viewerId)
}

/** Someone read messages: you (any of your tabs), or the other person reading yours ("Seen"). */
export function applyRead(qc: QueryClient, event: MessagesReadEvent, viewerId: number): void {
  const ids = new Set(event.message_ids)
  const markMessage = (m: ChatMessage) => (ids.has(m.id) ? { ...m, is_read: true, read_at: event.read_at } : m)

  if (ids.size > 0) {
    qc.setQueryData<MessagePages>(messagesKey(event.conversation_id), (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) =>
              page.data.some((m) => ids.has(m.id)) ? { ...page, data: page.data.map(markMessage) } : page,
            ),
          }
        : data,
    )
  }

  const list = qc.getQueryData<ConversationList>(CONVERSATIONS_KEY)
  const current = list?.data.find((c) => c.id === event.conversation_id)
  if (list && current) {
    setList(
      qc,
      list.data.map((c) =>
        c.id === current.id
          ? {
              ...c,
              latest_message: c.latest_message ? markMessage(c.latest_message) : null,
              unread_count: event.reader_id === viewerId ? 0 : c.unread_count,
            }
          : c,
      ),
    )
  }

  if (event.reader_id !== viewerId) return
  const overview = qc.getQueryData<SocietyOverview>(SOCIETY_OVERVIEW_KEY)
  const friend = overview?.friends.find((p) => p.conversation_id === event.conversation_id)
  if (!overview || !friend || friend.unread_count === 0) return
  qc.setQueryData<SocietyOverview>(SOCIETY_OVERVIEW_KEY, {
    ...overview,
    friends: overview.friends.map((p) => (p.id === friend.id ? { ...p, unread_count: 0 } : p)),
    unread_count: Math.max(0, overview.unread_count - friend.unread_count),
  })
}

/** Conversations with a read request in flight; `true` means ask again when it finishes (a message came in meanwhile). */
const marking = new Map<number, boolean>()

export function markRead(qc: QueryClient, conversationId: number, viewerId: number): void {
  if (marking.has(conversationId)) {
    marking.set(conversationId, true)
    return
  }
  marking.set(conversationId, false)
  chatService
    .markRead(conversationId)
    .then((result) =>
      applyRead(
        qc,
        {
          conversation_id: conversationId,
          reader_id: viewerId,
          message_ids: result.message_ids,
          read_at: result.read_at ?? new Date().toISOString(),
        },
        viewerId,
      ),
    )
    .catch((error: unknown) => console.warn('Could not mark the conversation as read.', error))
    .finally(() => {
      const again = marking.get(conversationId)
      marking.delete(conversationId)
      if (again) markRead(qc, conversationId, viewerId)
    })
}
