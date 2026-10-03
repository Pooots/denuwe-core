import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, LoaderCircle } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import type { ChatMessage, PendingMessage } from '@/types/chat'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { useChatThread } from '@/components/chat/useChatThread'
import { Avatar } from '@/components/feed/Avatar'
import { GAP_FOR_NEW_CLUSTER_MS, GAP_FOR_TIMESTAMP_MS, MessageBox, gap, stamp } from '@/components/society/ChatPanel'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'

type Person = { id: number; name: string; avatar_url: string | null }

type Item = {
  key: string
  mine: boolean
  text: string
  created_at: string | null
  saved?: ChatMessage
  pending?: PendingMessage
}

/** Closer than this to the bottom counts as "reading the latest", so new messages scroll into view. */
const NEAR_BOTTOM_PX = 80
const NEAR_TOP_PX = 120

const firstName = (name: string) => name.split(' ')[0] ?? name

function DefaultIntro({ person, compact }: { person: Person; compact: boolean }) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-5' : 'px-6 py-8')}>
      <Avatar name={person.name} src={person.avatar_url} className={compact ? 'size-14 text-lg' : 'size-20 text-2xl'} />
      <p className={cn('mt-3 font-semibold text-ink', compact ? 'text-[15px]' : 'text-lg')}>{person.name}</p>
    </div>
  )
}

/**
 * A live 1-to-1 conversation: saved messages, messages on their way (with retry), typing, read receipts,
 * and the message box. Stays scrolled to the newest message only while you're already at the bottom.
 */
export function ChatThread({
  conversationId,
  person,
  inputRef,
  compact = false,
  active = true,
  intro,
}: {
  conversationId: number
  person: Person
  inputRef: RefObject<HTMLTextAreaElement | null>
  compact?: boolean
  /** False while hidden (e.g. a minimized window), so incoming messages stay unread. */
  active?: boolean
  /** Shown above the first message once there's nothing older to load. */
  intro?: ReactNode
}) {
  const thread = useChatThread(conversationId, active)
  const { query, messages, pending, typing, viewerId } = thread
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const lastKey = useRef<string | null>(null)
  const anchor = useRef<{ height: number; top: number } | null>(null)
  const [unseen, setUnseen] = useState(0)

  const items: Array<Item> = [
    ...messages.map((m) => ({
      key: m.client_id ?? `m${m.id}`,
      mine: m.sender_id === viewerId,
      text: m.message,
      created_at: m.created_at,
      saved: m,
    })),
    ...pending.map((p) => ({ key: p.client_id, mine: true, text: p.message, created_at: p.created_at, pending: p })),
  ]
  const lastMine = [...messages].reverse().find((m) => m.sender_id === viewerId)
  const lastItem = items.at(-1)
  const lastItemKey = lastItem?.key ?? null
  const lastItemMine = lastItem?.mine ?? false

  // After an older page loads above, keep the same messages in view.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !anchor.current || query.isFetchingNextPage) return
    el.scrollTop = el.scrollHeight - anchor.current.height + anchor.current.top
    anchor.current = null
  }, [items.length, query.isFetchingNextPage])

  // A new last message: follow it if you were at the bottom (or sent it), otherwise count it on the pill.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || lastItemKey === lastKey.current) return
    const first = lastKey.current === null
    lastKey.current = lastItemKey
    if (first || atBottom.current || lastItemMine) {
      el.scrollTop = el.scrollHeight
      atBottom.current = true
      setUnseen(0)
    } else {
      setUnseen((n) => n + 1)
    }
  }, [lastItemKey, lastItemMine])

  const someoneTyping = typing.length > 0
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && someoneTyping && atBottom.current) el.scrollTop = el.scrollHeight
  }, [someoneTyping])

  const loadOlder = () => {
    const el = scrollRef.current
    if (!el || !query.hasNextPage || query.isFetchingNextPage) return
    anchor.current = { height: el.scrollHeight, top: el.scrollTop }
    void query.fetchNextPage()
  }

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
    if (atBottom.current && unseen > 0) setUnseen(0)
    if (el.scrollTop < NEAR_TOP_PX && !query.isFetchNextPageError) loadOlder()
  }

  const jumpToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    setUnseen(0)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {thread.liveError ? (
        <p role="alert" className="shrink-0 bg-amber-50 px-4 py-1.5 text-center text-[12px] text-amber-800">
          {thread.liveError}
        </p>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={cn('min-h-0 flex-1 overflow-y-auto pb-3', compact ? 'px-3' : 'px-4')}
        >
          {query.isPending ? (
            <div className="grid h-full place-items-center">
              <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : query.isError && !query.data ? (
            <div className="grid h-full place-items-center px-4 text-center">
              <div>
                <p className="text-[13px] text-muted-foreground">
                  {apiErrorMessage(query.error, 'Couldn’t load messages.')}
                </p>
                <button
                  type="button"
                  onClick={() => void query.refetch()}
                  className="mt-2 text-[13px] font-semibold text-brand-blue hover:underline"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <>
              {query.hasNextPage ? (
                <div className="flex justify-center py-3">
                  {query.isFetchingNextPage ? (
                    <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
                  ) : (
                    <button
                      type="button"
                      onClick={loadOlder}
                      className="rounded-full px-3 py-1 text-[12px] font-semibold text-brand-blue hover:bg-brand-blue/5"
                    >
                      {query.isFetchNextPageError
                        ? 'Couldn’t load earlier messages. Try again'
                        : 'Load earlier messages'}
                    </button>
                  )}
                </div>
              ) : (
                (intro ?? <DefaultIntro person={person} compact={compact} />)
              )}

              {items.length === 0 ? (
                <p className="pb-6 text-center text-[13px] text-muted-foreground">
                  No messages yet. Say hi to {firstName(person.name)}!
                </p>
              ) : null}

              <ul className="space-y-0.5">
                {items.map((item, i) => {
                  const previous = i > 0 ? items.at(i - 1) : undefined
                  const next = items.at(i + 1)
                  const showStamp = !previous || gap(previous, item) > GAP_FOR_TIMESTAMP_MS
                  const endsCluster = next?.mine !== item.mine || gap(item, next) > GAP_FOR_NEW_CLUSTER_MS
                  const failed = item.pending?.status === 'failed'
                  const receipt =
                    item.saved && item.saved.id === lastMine?.id ? (item.saved.is_read ? 'Seen' : 'Sent') : null

                  return (
                    <li key={item.key}>
                      {showStamp && item.created_at ? (
                        <p className="py-3 text-center text-[11px] font-semibold text-muted-foreground">
                          {stamp(item.created_at)}
                        </p>
                      ) : null}
                      <div
                        className={cn(
                          'flex items-end gap-2',
                          item.mine ? 'justify-end' : 'justify-start',
                          endsCluster && !item.pending && !receipt && 'mb-2',
                        )}
                      >
                        {!item.mine ? (
                          endsCluster ? (
                            <Avatar name={person.name} src={person.avatar_url} className="size-7 text-[10px]" />
                          ) : (
                            <span className="w-7 shrink-0" />
                          )
                        ) : null}
                        <p
                          title={item.created_at ? stamp(item.created_at) : undefined}
                          className={cn(
                            'max-w-[70%] rounded-[18px] px-3.5 py-2 text-[14px] leading-snug break-words whitespace-pre-wrap',
                            item.mine ? 'bg-brand-blue text-white' : 'bg-muted text-ink',
                            item.pending && 'opacity-70',
                            failed && 'bg-danger/80',
                          )}
                        >
                          {item.text}
                        </p>
                      </div>
                      {item.pending?.status === 'sending' ? (
                        <p className="mt-0.5 mb-2 text-right text-[11px] text-muted-foreground">Sending...</p>
                      ) : null}
                      {item.pending && failed ? (
                        <p role="alert" className="mt-0.5 mb-2 text-right text-[11px] text-danger">
                          {item.pending.error || 'Message not sent.'}{' '}
                          <button
                            type="button"
                            onClick={() => thread.retry(item.key)}
                            className="font-semibold underline-offset-2 hover:underline"
                          >
                            Retry
                          </button>
                          {' · '}
                          <button
                            type="button"
                            onClick={() => thread.discard(item.key)}
                            className="font-semibold underline-offset-2 hover:underline"
                          >
                            Delete
                          </button>
                        </p>
                      ) : null}
                      {receipt ? (
                        <p className="mt-0.5 mb-2 text-right text-[11px] text-muted-foreground">{receipt}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>

              <TypingIndicator typers={typing} />
            </>
          )}
        </div>

        {unseen > 0 ? (
          <button
            type="button"
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand-blue px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-lg transition hover:bg-brand-blue/90"
          >
            <ArrowDown className="size-3.5" />
            {unseen === 1 ? 'New message' : 'New messages'}
          </button>
        ) : null}
      </div>

      <MessageBox
        inputRef={inputRef}
        compact={compact}
        label={`Message ${person.name}`}
        onSend={thread.send}
        onTyping={thread.notifyTyping}
      />
    </div>
  )
}
