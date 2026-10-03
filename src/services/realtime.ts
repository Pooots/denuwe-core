import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { useSyncExternalStore } from 'react'
import type { ChannelAuthorizationCallback } from 'pusher-js'
import { api } from '@/lib/api'
import { apiErrorMessage } from '@/services/authService'

/**
 * The app's single Laravel Reverb (Pusher protocol) connection.
 * Private and presence channels are authorized by `POST /api/v1/broadcasting/auth` with the user's JWT,
 * through the shared axios client (so an expired token is refreshed first). Only the public app key lives here.
 */

export type RealtimeStatus = 'unconfigured' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export type PrivateChannel = ReturnType<Echo<'reverb'>['private']>

/** A typing client event. Never stored. */
export type TypingWhisper = { user_id: number; name: string; avatar_url?: string | null; typing: boolean }
type TypingListener = (typingKey: string, event: TypingWhisper) => void

type ChannelAuth = NonNullable<Parameters<ChannelAuthorizationCallback>[1]>
type PresenceMember = { id: number | string; name?: string }

function readSettings() {
  const env = import.meta.env
  const key = String(env.VITE_REVERB_APP_KEY ?? '').trim()
  if (!key) return null
  const scheme = String(env.VITE_REVERB_SCHEME ?? '').trim() || window.location.protocol.replace(':', '')
  const tls = scheme === 'https'
  return {
    key,
    host: String(env.VITE_REVERB_HOST ?? '').trim() || window.location.hostname,
    port: Number(env.VITE_REVERB_PORT) || (tls ? 443 : 8080),
    tls,
  }
}

const settings = readSettings()
export const isRealtimeConfigured = settings !== null

let echo: Echo<'reverb'> | null = null
let status: RealtimeStatus = settings ? 'disconnected' : 'unconfigured'
let hasConnected = false
const statusListeners = new Set<() => void>()

/** Open subscribers per channel, so a channel is left only when its last subscriber goes. */
const channelRefs = new Map<string, number>()

/** Who is online, per conversation presence channel. Never stored anywhere but here. */
const presence = new Map<number, Set<number>>()
const presenceListeners = new Set<() => void>()

/** Channels that carry typing whispers, by chat: `c:<conversationId>` (its presence channel) or `g:<groupId>`. */
const typingChannels = new Map<string, PrivateChannel>()
const typingListeners = new Set<TypingListener>()

function setStatus(next: RealtimeStatus): void {
  if (next === status) return
  status = next
  statusListeners.forEach((listener) => listener())
}

function notifyPresence(): void {
  presenceListeners.forEach((listener) => listener())
}

function onStateChange({ current }: { previous: string; current: string }): void {
  if (current === 'connected') {
    hasConnected = true
    setStatus('connected')
  } else if (current === 'connecting') {
    setStatus(hasConnected ? 'reconnecting' : 'connecting')
  } else if (current === 'unavailable' || current === 'failed' || current === 'disconnected') {
    // pusher-js keeps retrying while `unavailable` (and when the browser comes back online).
    setStatus('disconnected')
  }
}

/** The shared connection, opened on first use. Null when Reverb isn't configured. */
export function realtime(): Echo<'reverb'> | null {
  if (!settings) return null
  if (echo) return echo

  hasConnected = false
  setStatus('connecting')
  echo = new Echo({
    broadcaster: 'reverb',
    key: settings.key,
    wsHost: settings.host,
    wsPort: settings.port,
    wssPort: settings.port,
    forceTLS: settings.tls,
    enabledTransports: settings.tls ? ['wss'] : ['ws'],
    Pusher,
    channelAuthorization: {
      customHandler: ({ socketId, channelName }, callback) => {
        api
          .post<ChannelAuth>('/broadcasting/auth', { socket_id: socketId, channel_name: channelName })
          .then(({ data }) => callback(null, data))
          .catch((error: unknown) =>
            callback(new Error(apiErrorMessage(error, 'Not allowed to join this chat.')), null),
          )
      },
    },
  })
  echo.connector.pusher.connection.bind('state_change', onStateChange)
  return echo
}

/** Close the connection (sign-out or a different user signing in). */
export function disconnectRealtime(): void {
  if (!echo) return
  echo.connector.pusher.connection.unbind('state_change', onStateChange)
  echo.disconnect()
  echo = null
  hasConnected = false
  channelRefs.clear()
  presence.clear()
  typingChannels.clear()
  notifyPresence()
  setStatus(settings ? 'disconnected' : 'unconfigured')
}

// Lets the API skip broadcasting a change back to the tab that made it ("to others").
api.interceptors.request.use((config) => {
  const socketId = echo?.socketId()
  if (socketId) config.headers['X-Socket-ID'] = socketId
  return config
})

function retain(key: string): void {
  channelRefs.set(key, (channelRefs.get(key) ?? 0) + 1)
}

/** True when that was the last subscriber and the channel was left. */
function release(key: string): boolean {
  const count = channelRefs.get(key)
  if (count === undefined) return false
  if (count > 1) {
    channelRefs.set(key, count - 1)
    return false
  }
  channelRefs.delete(key)
  echo?.leaveChannel(key)
  return true
}

/** Subscribe to a private channel (e.g. `conversation.12`). Pair every call with `leavePrivate`. */
export function joinPrivate(name: string): PrivateChannel | null {
  const client = realtime()
  if (!client) return null
  retain(`private-${name}`)
  return client.private(name)
}

export function leavePrivate(name: string): void {
  release(`private-${name}`)
}

/** Track who is online in a conversation. Returns the function that stops tracking. */
export function watchPresence(conversationId: number): () => void {
  const client = realtime()
  if (!client) return () => {}

  const key = `presence-online.${conversationId}`
  const first = !channelRefs.has(key)
  retain(key)
  if (first) {
    const update = (change: (members: Set<number>) => void) => {
      const members = new Set(presence.get(conversationId))
      change(members)
      presence.set(conversationId, members)
      notifyPresence()
    }
    const typingKey = `c:${conversationId}`
    const channel = client
      .join(`online.${conversationId}`)
      .here((members: Array<PresenceMember>) =>
        update((set) => {
          set.clear()
          members.forEach((member) => set.add(Number(member.id)))
        }),
      )
      .joining((member: PresenceMember) => update((set) => set.add(Number(member.id))))
      .leaving((member: PresenceMember) => {
        update((set) => set.delete(Number(member.id)))
        emitTyping(typingKey, { user_id: Number(member.id), name: member.name ?? '', typing: false })
      })
      .error(() => {
        presence.delete(conversationId)
        notifyPresence()
      })
      .listenForWhisper('typing', (event: TypingWhisper) => emitTyping(typingKey, event))
    typingChannels.set(typingKey, channel)
  }

  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    if (release(key)) {
      presence.delete(conversationId)
      typingChannels.delete(`c:${conversationId}`)
      notifyPresence()
    }
  }
}

/** Listen for (and allow sending) typing in a group chat. Returns the function that stops listening. */
export function watchGroupTyping(groupId: number): () => void {
  const client = realtime()
  if (!client) return () => {}

  const key = `private-group.${groupId}`
  const typingKey = `g:${groupId}`
  const first = !channelRefs.has(key)
  retain(key)
  if (first) {
    const channel = client
      .private(`group.${groupId}`)
      .listenForWhisper('typing', (event: TypingWhisper) => emitTyping(typingKey, event))
    typingChannels.set(typingKey, channel)
  }

  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    if (release(key)) typingChannels.delete(typingKey)
  }
}

/** Tell the others in a chat (`c:<conversationId>` or `g:<groupId>`) that you are or stopped typing. */
export function whisperTyping(typingKey: string, event: TypingWhisper): void {
  const channel = typingChannels.get(typingKey)
  if (channel?.subscription.subscribed) channel.whisper('typing', event)
}

/** Typing whispers from every chat being watched. Returns the function that stops listening. */
export function onTyping(listener: TypingListener): () => void {
  typingListeners.add(listener)
  return () => typingListeners.delete(listener)
}

function emitTyping(typingKey: string, event: TypingWhisper): void {
  typingListeners.forEach((listener) => listener(typingKey, event))
}

function subscribeStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

function subscribePresence(listener: () => void): () => void {
  statusListeners.add(listener)
  presenceListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
    presenceListeners.delete(listener)
  }
}

export function getRealtimeStatus(): RealtimeStatus {
  return status
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(subscribeStatus, getRealtimeStatus)
}

function isOnline(userId: number): boolean {
  if (status !== 'connected') return false
  for (const members of presence.values()) {
    if (members.has(userId)) return true
  }
  return false
}

/** Whether a user is connected right now (only known for people you have a conversation with). */
export function useIsOnline(userId: number | null | undefined): boolean {
  return useSyncExternalStore(subscribePresence, () => userId != null && isOnline(userId))
}
