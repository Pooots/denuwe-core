import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, Info, LoaderCircle, SendHorizontal } from 'lucide-react'
import type { RefObject } from 'react'
import type { SocietyPerson } from '@/types/society'
import { ChatThread } from '@/components/chat/ChatThread'
import { PresenceLine } from '@/components/chat/ConnectionStatus'
import { useDirectConversation } from '@/components/chat/chatCache'
import { Avatar } from '@/components/feed/Avatar'
import { SocietyIcon } from '@/components/feed/NavIcons'
import { RELATIONSHIP_LABEL, RelationshipActions, mutualLabel } from '@/components/society/societyUi'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { isRealtimeConfigured, useIsOnline } from '@/services/realtime'

export const GAP_FOR_TIMESTAMP_MS = 15 * 60 * 1000
export const GAP_FOR_NEW_CLUSTER_MS = 5 * 60 * 1000

/** "3:04 PM", "Tue 3:04 PM" or "Sep 1, 3:04 PM". */
export function stamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return time
  if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
    return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`
  }
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`
}

export const gap = (a: { created_at: string | null } | undefined, b: { created_at: string | null } | undefined) =>
  a?.created_at && b?.created_at
    ? Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : Infinity

function Intro({ person, compact = false }: { person: SocietyPerson; compact?: boolean }) {
  const mutual = mutualLabel(person.mutual_count)
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-5' : 'px-6 py-8')}>
      <Avatar name={person.name} src={person.avatar_url} className={compact ? 'size-14 text-lg' : 'size-20 text-2xl'} />
      <p className={cn('mt-3 font-semibold text-ink', compact ? 'text-[15px]' : 'text-lg')}>{person.name}</p>
      {person.headline ? <p className="text-[13px] text-ink/70">{person.headline}</p> : null}
      <p className="mt-1 text-xs text-muted-foreground">
        {[RELATIONSHIP_LABEL[person.relationship], mutual, person.location].filter(Boolean).join(' · ')}
      </p>
    </div>
  )
}

/** A friend's live chat, opening (creating) the conversation the first time. */
export function FriendChat({
  person,
  inputRef,
  compact = false,
  active = true,
}: {
  person: SocietyPerson
  inputRef: RefObject<HTMLTextAreaElement | null>
  compact?: boolean
  /** False while the window is minimized, so new messages stay unread. */
  active?: boolean
}) {
  const direct = useDirectConversation(person)

  if (!direct.conversationId) {
    return (
      <div className="grid flex-1 place-items-center px-4 text-center">
        {direct.error ? (
          <div>
            <p className="text-[13px] text-muted-foreground">
              {apiErrorMessage(direct.error, 'Couldn’t open this chat.')}
            </p>
            <button
              type="button"
              onClick={direct.retry}
              className="mt-2 text-[13px] font-semibold text-brand-blue hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
        )}
      </div>
    )
  }

  return (
    <ChatThread
      key={direct.conversationId}
      conversationId={direct.conversationId}
      person={person}
      inputRef={inputRef}
      compact={compact}
      active={active}
      intro={<Intro person={person} compact={compact} />}
    />
  )
}

/** The "Aa" box under a chat: grows with the text, Enter sends, Shift+Enter adds a line. A failed send puts the text back. */
export function MessageBox({
  inputRef,
  compact = false,
  label,
  onSend,
  onTyping,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>
  compact?: boolean
  label: string
  onSend: (text: string) => Promise<unknown>
  /** Called on each edit that leaves text in the box. */
  onTyping?: () => void
}) {
  const [body, setBody] = useState('')

  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const fullHeight = el.scrollHeight + el.offsetHeight - el.clientHeight
    el.style.height = `${Math.min(fullHeight, 120)}px`
    el.style.overflowY = fullHeight > 120 ? 'auto' : 'hidden'
  }, [body, inputRef])

  const submit = () => {
    const text = body.trim()
    if (!text) return
    setBody('')
    onSend(text).catch(() => setBody((current) => current || text))
  }

  return (
    <form
      className={cn(
        'flex shrink-0 items-end gap-2 border-t border-border bg-white',
        compact ? 'px-3 py-2' : 'px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-3',
      )}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <textarea
        ref={inputRef}
        rows={1}
        value={body}
        maxLength={2000}
        onChange={(e) => {
          setBody(e.target.value)
          if (e.target.value.trim()) onTyping?.()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="Aa"
        aria-label={label}
        className="max-h-[120px] min-h-10 min-w-0 flex-1 resize-none rounded-[20px] bg-muted px-4 py-2 text-[16px] text-ink placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-blue/20 focus:outline-none sm:py-2.5 sm:text-[14px]"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={!body.trim()}
        onPointerDown={(e) => e.preventDefault()}
        className="grid size-10 shrink-0 place-items-center rounded-full text-brand-blue transition hover:bg-brand-blue/10 active:scale-90 disabled:text-muted-foreground disabled:hover:bg-transparent"
      >
        <SendHorizontal className="size-5" />
      </button>
    </form>
  )
}

export function ChatPanel({
  person,
  onBack,
  onToggleInfo,
  infoOpen,
  focusSignal,
}: {
  person: SocietyPerson | null
  onBack: () => void
  onToggleInfo: () => void
  infoOpen: boolean
  /** Changing this focuses the message box. */
  focusSignal: number
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFriend = person?.relationship === 'friends'
  const online = useIsOnline(isFriend ? person.id : null)
  const conversationId = person?.conversation_id

  useEffect(() => {
    if (isFriend) inputRef.current?.focus()
  }, [person?.id, isFriend, focusSignal, conversationId])

  if (!person) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <div>
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-blue/10 text-brand-blue">
            <SocietyIcon className="size-8" />
          </span>
          <p className="mt-4 text-lg font-semibold text-ink">Your society</p>
          <p className="mt-1 max-w-[320px] text-[13px] text-muted-foreground">
            Pick a friend to start chatting, or search for people who already have a denuwe account.
          </p>
        </div>
      </div>
    )
  }

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
        <Avatar name={person.name} src={person.avatar_url} online={online} className="size-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{person.name}</p>
          {isFriend && isRealtimeConfigured ? (
            <PresenceLine userId={person.id} />
          ) : (
            <p className="truncate text-xs text-muted-foreground">
              {person.headline || RELATIONSHIP_LABEL[person.relationship]}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleInfo}
          aria-label="Conversation info"
          aria-pressed={infoOpen}
          className={cn(
            'hidden size-9 place-items-center rounded-full transition xl:grid',
            infoOpen ? 'bg-brand-blue/10 text-brand-blue' : 'text-brand-blue hover:bg-muted',
          )}
        >
          <Info className="size-5" />
        </button>
      </header>

      {isFriend ? (
        <FriendChat person={person} inputRef={inputRef} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto pb-8">
          <Intro person={person} />
          <p className="max-w-[340px] px-6 text-center text-[13px] text-muted-foreground">
            {person.relationship === 'incoming'
              ? `${person.name.split(' ')[0]} wants to join your society. Accept to start chatting.`
              : person.relationship === 'outgoing'
                ? `You can chat once ${person.name.split(' ')[0]} accepts your friend request.`
                : `Add ${person.name.split(' ')[0]} to your society to start chatting.`}
          </p>
          <div className="mt-4">
            <RelationshipActions person={person} />
          </div>
        </div>
      )}
    </>
  )
}
