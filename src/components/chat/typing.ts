import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { authService } from '@/services/authService'
import { onTyping, whisperTyping } from '@/services/realtime'

/**
 * Who is typing where, from typing whispers. Chats are keyed `c:<conversationId>` or `g:<groupId>`.
 * Lives only in memory: nothing about typing is sent to the API or stored.
 */

export type Typer = { id: number; name: string; avatar_url: string | null }

/** While typing, tell the others at most this often. */
const RESEND_MS = 1500
/** Send "stopped typing" this long after the last keystroke. */
const IDLE_MS = 1500
/** Hide someone's "typing" if no update arrives (e.g. they closed the tab mid-sentence). */
const SHOWN_MS = 3000

const NONE: Array<Typer> = []
const typers = new Map<string, Array<Typer>>()
const timers = new Map<string, number>()
const listeners = new Set<() => void>()

function setTypers(typingKey: string, list: Array<Typer>): void {
  if (list.length > 0) typers.set(typingKey, list)
  else typers.delete(typingKey)
  listeners.forEach((listener) => listener())
}

/** Stop showing someone as typing, e.g. because their message just arrived. */
export function stopShowingTyping(typingKey: string, userId: number): void {
  const timer = `${typingKey}|${userId}`
  window.clearTimeout(timers.get(timer))
  timers.delete(timer)
  const list = typers.get(typingKey)
  if (list?.some((t) => t.id === userId)) {
    setTypers(
      typingKey,
      list.filter((t) => t.id !== userId),
    )
  }
}

onTyping((typingKey, event) => {
  const id = Number(event.user_id)
  if (!event.typing) {
    stopShowingTyping(typingKey, id)
    return
  }
  const timer = `${typingKey}|${id}`
  window.clearTimeout(timers.get(timer))
  timers.set(
    timer,
    window.setTimeout(() => stopShowingTyping(typingKey, id), SHOWN_MS),
  )
  const list = typers.get(typingKey) ?? []
  if (!list.some((t) => t.id === id)) {
    setTypers(typingKey, [...list, { id, name: event.name, avatar_url: event.avatar_url ?? null }])
  }
})

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Everyone but you (e.g. in another tab) typing in a chat right now. */
export function useTypers(typingKey: string | null): Array<Typer> {
  const viewerId = useSyncExternalStore(authService.subscribe, () => authService.getUser()?.id ?? 0)
  const list = useSyncExternalStore(subscribe, () => (typingKey ? (typers.get(typingKey) ?? NONE) : NONE))
  return useMemo(() => list.filter((t) => t.id !== viewerId), [list, viewerId])
}

/** "Ana is typing...", "Ana and Ben are typing..." or "Several people are typing...". */
export function typingLabel(list: Array<Typer>): string {
  const first = (t: Typer) => t.name.split(' ')[0] || 'Someone'
  if (list.length === 1) return `${first(list[0])} is typing...`
  if (list.length === 2) return `${first(list[0])} and ${first(list[1])} are typing...`
  return 'Several people are typing...'
}

/** `notify` on every keystroke (throttled for the network); `stop` when the message is sent. */
export function useTypingNotifier(typingKey: string | null) {
  const viewer = useSyncExternalStore(authService.subscribe, authService.getUser)
  const sentAt = useRef(0)
  const stopTimer = useRef<number | undefined>(undefined)

  const send = useCallback(
    (typing: boolean) => {
      if (!typingKey || !viewer) return
      whisperTyping(typingKey, { user_id: viewer.id, name: viewer.name, avatar_url: viewer.avatar_url, typing })
    },
    [typingKey, viewer],
  )

  const stop = useCallback(() => {
    if (stopTimer.current === undefined) return
    window.clearTimeout(stopTimer.current)
    stopTimer.current = undefined
    sentAt.current = 0
    send(false)
  }, [send])

  const notify = useCallback(() => {
    const now = Date.now()
    if (now - sentAt.current > RESEND_MS) {
      sentAt.current = now
      send(true)
    }
    window.clearTimeout(stopTimer.current)
    stopTimer.current = window.setTimeout(stop, IDLE_MS)
  }, [send, stop])

  useEffect(() => stop, [stop])

  return { notify, stop }
}
