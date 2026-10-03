import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { ChatMessage, MessagesReadEvent } from '@/types/chat'
import { CHAT_KEY, applyRead, receiveMessage, resyncChat, useConversations } from '@/components/chat/chatCache'
import { toast } from '@/components/feed/Toaster'
import { useGroups } from '@/components/society/groupUi'
import { authService } from '@/services/authService'
import {
  disconnectRealtime,
  isRealtimeConfigured,
  joinPrivate,
  leavePrivate,
  watchGroupTyping,
  watchPresence,
} from '@/services/realtime'

/** How many of your most recent conversations (and groups) to show online status and typing for. */
const WATCH_LIMIT = 25

/**
 * App-wide live messaging, mounted once: listens on `private-user.{you}` so conversation lists, unread
 * badges and open chats update anywhere in the app, tracks who's online and typing, and refetches after a reconnect.
 * Connects when you sign in and disconnects when you sign out.
 */
export function RealtimeInbox() {
  const qc = useQueryClient()
  const user = useSyncExternalStore(authService.subscribe, authService.getUser)
  const userId = user?.id ?? null
  const lastUserId = useRef<number | null>(null)

  useEffect(() => {
    if (userId === null) return
    if (lastUserId.current !== null && lastUserId.current !== userId) qc.removeQueries({ queryKey: CHAT_KEY })
    lastUserId.current = userId

    const name = `user.${userId}`
    const channel = joinPrivate(name)
    if (!channel) return

    let subscribedBefore = false
    let warned = false
    const onMessage = (message: ChatMessage) => receiveMessage(qc, message, userId)
    const onRead = (event: MessagesReadEvent) => applyRead(qc, event, userId)
    // Pusher resubscribes after every reconnect; anything sent while we were away is fetched again.
    const onSubscribed = () => {
      if (subscribedBefore) resyncChat(qc)
      subscribedBefore = true
    }
    const onError = (error: { error?: string; status?: number } | undefined) => {
      console.warn('Live messaging subscription failed.', error)
      if (warned) return
      warned = true
      toast(
        error?.status === 401
          ? 'Your session has expired. Sign in again to get live messages.'
          : 'Live messages are unavailable right now. Refresh to see new messages.',
        'error',
      )
    }

    channel.listen('.MessageSent', onMessage).listen('.MessagesRead', onRead)
    channel.subscription.bind('pusher:subscription_succeeded', onSubscribed)
    channel.subscription.bind('pusher:subscription_error', onError)

    return () => {
      channel.stopListening('.MessageSent', onMessage).stopListening('.MessagesRead', onRead)
      channel.subscription.unbind('pusher:subscription_succeeded', onSubscribed)
      channel.subscription.unbind('pusher:subscription_error', onError)
      leavePrivate(name)
      disconnectRealtime()
    }
  }, [userId, qc])

  const live = userId !== null && isRealtimeConfigured
  const conversations = useConversations(live)
  useWatchEach(
    (conversations.data?.data ?? []).slice(0, WATCH_LIMIT).map((c) => c.id),
    watchPresence,
    userId,
  )

  const groups = useGroups(live)
  useWatchEach(
    (groups.data?.data ?? []).slice(0, WATCH_LIMIT).map((g) => g.id),
    watchGroupTyping,
    userId,
  )

  return null
}

/** Keeps `watch(id)` running for exactly these ids (starting/stopping only what changed); all stop on `resetKey` change. */
function useWatchEach(ids: Array<number>, watch: (id: number) => () => void, resetKey: unknown): void {
  const key = [...ids].sort((a, b) => a - b).join(',')
  const watched = useRef(new Map<number, () => void>())

  useEffect(() => {
    const map = watched.current
    const wanted = new Set(key ? key.split(',').map(Number) : [])
    for (const [id, stop] of map) {
      if (!wanted.has(id)) {
        stop()
        map.delete(id)
      }
    }
    for (const id of wanted) {
      if (!map.has(id)) map.set(id, watch(id))
    }
  }, [key, watch, resetKey])

  useEffect(() => {
    const map = watched.current
    return () => {
      map.forEach((stop) => stop())
      map.clear()
    }
  }, [resetKey])
}
