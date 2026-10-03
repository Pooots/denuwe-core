import { useEffect, useLayoutEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Info, LoaderCircle } from 'lucide-react'
import type { RefObject } from 'react'
import type { GroupMessage, SocietyGroup } from '@/types/society'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { useTypers, useTypingNotifier } from '@/components/chat/typing'
import { Avatar } from '@/components/feed/Avatar'
import { toast } from '@/components/feed/Toaster'
import { GAP_FOR_NEW_CLUSTER_MS, GAP_FOR_TIMESTAMP_MS, MessageBox, gap, stamp } from '@/components/society/ChatPanel'
import { GROUPS_KEY, GroupAvatar, groupMessagesKey } from '@/components/society/groupUi'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { POLL_MS } from '@/lib/polling'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { groupService } from '@/services/groupService'
import { watchGroupTyping } from '@/services/realtime'

/** Closer than this to the bottom counts as "reading the latest". */
const NEAR_BOTTOM_PX = 80

/** A group's messages, polled; opening it marks it read, so unread badges refresh. */
export function useGroupConversation(group: SocietyGroup | null) {
  const qc = useQueryClient()
  const conversation = useQuery({
    queryKey: groupMessagesKey(group?.id ?? 0),
    queryFn: () => groupService.messages(group?.id ?? 0),
    enabled: group !== null,
    refetchInterval: POLL_MS,
  })

  const unread = group?.unread_count ?? 0
  useEffect(() => {
    if (conversation.isSuccess && unread > 0) void qc.invalidateQueries({ queryKey: GROUPS_KEY })
  }, [conversation.dataUpdatedAt, conversation.isSuccess, unread, qc])

  // Messages are polled, but who's typing is live (whispers on `private-group.{id}`).
  const groupId = group?.id ?? 0
  useEffect(() => (groupId ? watchGroupTyping(groupId) : undefined), [groupId])

  return conversation
}

export function GroupComposer({
  group,
  inputRef,
  compact = false,
}: {
  group: SocietyGroup
  inputRef: RefObject<HTMLTextAreaElement | null>
  compact?: boolean
}) {
  const qc = useQueryClient()
  const me = useCurrentUser()
  const key = groupMessagesKey(group.id)
  const typing = useTypingNotifier(`g:${group.id}`)

  const send = useMutation({
    mutationFn: (text: string) => groupService.send(group.id, text),
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey: key })
      const optimistic: GroupMessage = {
        id: -Date.now(),
        kind: 'text',
        body: text,
        author: me ? { id: me.id, name: me.name, avatar_url: me.avatar_url } : null,
        mine: true,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<Array<GroupMessage>>(key, (current) => [...(current ?? []), optimistic])
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: GROUPS_KEY })
    },
  })

  return (
    <MessageBox
      inputRef={inputRef}
      compact={compact}
      label={`Message ${group.name}`}
      onTyping={typing.notify}
      onSend={(text) => {
        typing.stop()
        return send.mutateAsync(text)
      }}
    />
  )
}

export function GroupMessages({
  group,
  messages,
  compact = false,
}: {
  group: SocietyGroup
  messages: Array<GroupMessage>
  compact?: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const typers = useTypers(`g:${group.id}`)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, group.id])

  const someoneTyping = typers.length > 0
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && someoneTyping && el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX) {
      el.scrollTop = el.scrollHeight
    }
  }, [someoneTyping])

  const sameSender = (a: GroupMessage | undefined, b: GroupMessage | undefined) =>
    a !== undefined && b !== undefined && a.kind === 'text' && b.kind === 'text' && a.author?.id === b.author?.id

  return (
    <div ref={scrollRef} className={cn('min-h-0 flex-1 overflow-y-auto pb-3', compact ? 'px-3' : 'px-4')}>
      <div className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-5' : 'px-6 py-8')}>
        <GroupAvatar group={group} className={compact ? 'size-14 text-base' : 'size-20 text-xl'} />
        <p className={cn('mt-3 font-semibold text-ink', compact ? 'text-[15px]' : 'text-lg')}>{group.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {group.members
            .slice(0, 3)
            .map((m) => m.name.split(' ')[0])
            .join(', ')}
          {group.member_count > 3 ? ` and ${group.member_count - 3} more` : ''}
        </p>
      </div>
      <ul className="space-y-0.5">
        {messages.map((message, i) => {
          const previous = i > 0 ? messages.at(i - 1) : undefined
          const next = messages.at(i + 1)
          const showStamp = !previous || gap(previous, message) > GAP_FOR_TIMESTAMP_MS
          const stampRow =
            showStamp && message.created_at ? (
              <p className="py-3 text-center text-[11px] font-semibold text-muted-foreground">
                {stamp(message.created_at)}
              </p>
            ) : null

          if (message.kind === 'system') {
            return (
              <li key={message.id}>
                {stampRow}
                <p className="px-6 py-1.5 text-center text-[12px] text-muted-foreground">{message.body}</p>
              </li>
            )
          }

          const startsCluster =
            showStamp || !sameSender(previous, message) || gap(previous, message) > GAP_FOR_NEW_CLUSTER_MS
          const endsCluster = !sameSender(message, next) || gap(message, next) > GAP_FOR_NEW_CLUSTER_MS
          const author = message.author

          return (
            <li key={message.id}>
              {stampRow}
              {!message.mine && startsCluster ? (
                <p className="mt-1 mb-0.5 pl-12 text-[11px] text-muted-foreground">{author?.name ?? 'Former member'}</p>
              ) : null}
              <div
                className={cn(
                  'flex items-end gap-2',
                  message.mine ? 'justify-end' : 'justify-start',
                  endsCluster && 'mb-2',
                )}
              >
                {!message.mine ? (
                  endsCluster ? (
                    <Avatar
                      name={author?.name ?? '?'}
                      src={author?.avatar_url ?? null}
                      className="ml-3 size-7 text-[10px]"
                    />
                  ) : (
                    <span className="ml-3 w-7 shrink-0" />
                  )
                ) : null}
                <p
                  title={message.created_at ? stamp(message.created_at) : undefined}
                  className={cn(
                    'max-w-[70%] rounded-[18px] px-3.5 py-2 text-[14px] leading-snug break-words whitespace-pre-wrap',
                    message.mine ? 'bg-brand-blue text-white' : 'bg-muted text-ink',
                    message.id < 0 && 'opacity-70',
                  )}
                >
                  {message.body}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      <TypingIndicator typers={typers} className="ml-3" />
    </div>
  )
}

/** A group chat filling the My Society page (full screen on phones). */
export function GroupChatPanel({
  group,
  onBack,
  onInfo,
  focusSignal = 0,
}: {
  group: SocietyGroup
  onBack: () => void
  onInfo: () => void
  focusSignal?: number
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const conversation = useGroupConversation(group)

  useEffect(() => {
    inputRef.current?.focus()
  }, [group.id, focusSignal])

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="grid size-9 place-items-center rounded-full text-ink/70 hover:bg-muted lg:hidden"
        >
          <ArrowLeft className="size-5" />
        </button>
        <GroupAvatar group={group} className="size-10 text-sm" />
        <button type="button" onClick={onInfo} className="min-w-0 flex-1 text-left">
          <p className="truncate text-[15px] font-semibold text-ink">{group.name}</p>
          <p className="truncate text-xs text-muted-foreground">{group.member_count} members</p>
        </button>
        <button
          type="button"
          onClick={onInfo}
          aria-label="Group info"
          className="grid size-9 place-items-center rounded-full text-brand-blue transition hover:bg-muted"
        >
          <Info className="size-5" />
        </button>
      </header>

      {conversation.data ? (
        <GroupMessages group={group} messages={conversation.data} />
      ) : (
        <div className="grid flex-1 place-items-center">
          {conversation.isError ? (
            <p className="text-[13px] text-muted-foreground">{apiErrorMessage(conversation.error)}</p>
          ) : (
            <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
      <GroupComposer group={group} inputRef={inputRef} />
    </>
  )
}
