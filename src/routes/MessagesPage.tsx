import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft, LoaderCircle, MessageCircle, Search, SquarePen, X } from 'lucide-react'
import type { ConversationSummary } from '@/types/chat'
import type { SocietyPerson } from '@/types/society'
import { ChatThread } from '@/components/chat/ChatThread'
import { ConnectionStatus, PresenceLine } from '@/components/chat/ConnectionStatus'
import { TypingPreview } from '@/components/chat/TypingIndicator'
import { useTypers } from '@/components/chat/typing'
import { chatStaleTime, conversationKey, useConversations, useDirectConversation } from '@/components/chat/chatCache'
import { Avatar } from '@/components/feed/Avatar'
import { FeedNavbar } from '@/components/feed/FeedNavbar'
import { Toaster, toast } from '@/components/feed/Toaster'
import { useSocietyOverview } from '@/components/society/societyUi'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { chatService } from '@/services/chatService'
import { useIsOnline } from '@/services/realtime'

export type MessagesSearch = { c?: number; with?: number }

function ConversationItem({
  conversation,
  viewerId,
  selected,
  onSelect,
}: {
  conversation: ConversationSummary
  viewerId: number
  selected: boolean
  onSelect: () => void
}) {
  const person = conversation.other_participant
  const online = useIsOnline(person?.id)
  const latest = conversation.latest_message
  const unread = conversation.unread_count > 0
  const name = person?.name ?? 'denuwe member'
  const typers = useTypers(`c:${conversation.id}`)

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition',
          selected ? 'bg-brand-blue/[0.07]' : 'hover:bg-muted',
        )}
      >
        <Avatar name={name} src={person?.avatar_url} online={online} className="size-12 text-base" />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[14px] text-ink', unread ? 'font-bold' : 'font-semibold')}>
            {name}
          </span>
          <span
            className={cn(
              'flex min-w-0 gap-1 text-[12px]',
              unread ? 'font-semibold text-ink' : 'text-muted-foreground',
            )}
          >
            <span className="truncate">
              {typers.length > 0 ? (
                <TypingPreview typers={typers} />
              ) : latest ? (
                (latest.sender_id === viewerId ? 'You: ' : '') + latest.message
              ) : (
                'No messages yet'
              )}
            </span>
            {latest?.created_at ? <span className="shrink-0">· {timeAgo(latest.created_at)}</span> : null}
          </span>
        </span>
        {unread ? (
          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-blue px-1.5 text-[11px] font-bold text-white">
            {conversation.unread_count}
          </span>
        ) : null}
      </button>
    </li>
  )
}

/** Pick a friend to message. */
function NewChatDialog({ onPick, onClose }: { onPick: (person: SocietyPerson) => void; onClose: () => void }) {
  const overview = useSocietyOverview()
  const [search, setSearch] = useState('')
  const friends = overview.data?.friends ?? []
  const shown = friends
    .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="New message"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[min(560px,90dvh)] w-full max-w-[420px] flex-col overflow-hidden rounded-xl bg-white shadow-xl"
      >
        <header className="flex items-center gap-2 border-b border-border py-2 pr-2 pl-4">
          <h2 className="flex-1 text-[15px] font-semibold text-ink">New message</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-ink/70 hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="border-b border-border p-3">
          <label className="relative block">
            <span className="sr-only">Search friends</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a friend’s name"
              className="h-9 w-full rounded-full bg-muted pr-3 pl-9 text-[14px] text-ink placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-blue/20 focus:outline-none"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {overview.isLoading ? (
            <div className="grid place-items-center py-8">
              <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : shown.length > 0 ? (
            <ul>
              {shown.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => onPick(person)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-muted"
                  >
                    <Avatar name={person.name} src={person.avatar_url} className="size-10 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">{person.name}</span>
                      {person.headline ? (
                        <span className="block truncate text-[12px] text-muted-foreground">{person.headline}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-8 text-center text-[13px] text-muted-foreground">
              {friends.length === 0 ? (
                <>
                  You can message people once they accept your friend request.{' '}
                  <Link to="/society" className="font-semibold text-brand-blue hover:underline">
                    Find people
                  </Link>
                </>
              ) : (
                `No friend named “${search.trim()}”.`
              )}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

export default function MessagesPage() {
  const user = useCurrentUser()
  const params = useSearch({ strict: false })
  const navigate = useNavigate()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [filter, setFilter] = useState('')
  const [picking, setPicking] = useState(false)
  const query = useDeferredValue(filter.trim().toLowerCase())

  const openId = params.c ?? null
  const conversations = useConversations()
  const list = conversations.data?.data ?? []
  const listed = list.find((c) => c.id === openId)
  const single = useQuery({
    queryKey: conversationKey(openId ?? 0),
    queryFn: () => chatService.get(openId ?? 0),
    enabled: openId !== null && !listed && !conversations.isLoading,
    staleTime: chatStaleTime,
    retry: false,
  })
  const current = listed ?? single.data ?? null
  const other = current?.other_participant ?? null
  const online = useIsOnline(other?.id)

  const select = (id: number | null) => void navigate({ to: '/messages', search: id ? { c: id } : {} })

  // `?with=<userId>`: open (or start) the chat with that friend, then show it as `?c=`.
  const direct = useDirectConversation(params.with ? { id: params.with } : null, Boolean(params.with) && !openId)
  useEffect(() => {
    if (params.with && !openId && direct.conversationId) {
      void navigate({ to: '/messages', search: { c: direct.conversationId }, replace: true })
    }
  }, [params.with, openId, direct.conversationId, navigate])
  useEffect(() => {
    if (params.with && direct.error) {
      toast(apiErrorMessage(direct.error, 'Couldn’t open that chat.'), 'error')
      void navigate({ to: '/messages', search: {}, replace: true })
    }
  }, [params.with, direct.error, navigate])

  const start = useMutation({
    mutationFn: (person: SocietyPerson) =>
      person.conversation_id ? chatService.get(person.conversation_id) : chatService.open(person.id),
    onSuccess: (summary) => {
      qc.setQueryData(conversationKey(summary.id), summary)
      setPicking(false)
      select(summary.id)
    },
    onError: (error) => toast(apiErrorMessage(error, 'Couldn’t open that chat.'), 'error'),
  })

  const currentId = current?.id
  useEffect(() => {
    if (currentId) inputRef.current?.focus()
  }, [currentId])

  if (!user) return null

  const shown = list.filter((c) => !query || (c.other_participant?.name ?? '').toLowerCase().includes(query))
  const chatOpen = openId !== null

  return (
    <div className="flex h-dvh flex-col bg-background max-sm:h-[min(100dvh,800px)]">
      <FeedNavbar user={user} active="messages" hideMobileTabs={chatOpen} />

      <div className="mx-auto grid min-h-0 w-full max-w-[1200px] flex-1 grid-rows-[minmax(0,1fr)] gap-3 p-3 max-sm:p-0 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          className={cn(
            'min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-white max-sm:rounded-none max-sm:border-0',
            chatOpen ? 'hidden lg:flex' : 'flex',
          )}
        >
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-[22px] font-bold text-ink">Chats</h1>
                <ConnectionStatus />
              </div>
              <button
                type="button"
                title="New message"
                aria-label="New message"
                onClick={() => setPicking(true)}
                className="grid size-9 place-items-center rounded-full bg-muted text-ink transition hover:bg-[#e3e6ee]"
              >
                <SquarePen className="size-[18px]" />
              </button>
            </div>
            <label className="relative mt-3 mb-2 block">
              <span className="sr-only">Search chats</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search chats"
                className="h-9 w-full rounded-full bg-muted pr-3 pl-9 text-[14px] text-ink placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-blue/20 focus:outline-none"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {conversations.isLoading ? (
              <ul className="space-y-1 px-2 pt-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="flex animate-pulse items-center gap-3 py-2">
                    <span className="size-12 rounded-full bg-muted" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3 w-1/2 rounded bg-muted" />
                      <span className="block h-2.5 w-3/4 rounded bg-muted" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : conversations.isError ? (
              <div className="px-6 py-10 text-center">
                <p className="text-[13px] text-muted-foreground">
                  {apiErrorMessage(conversations.error, 'Couldn’t load your chats.')}
                </p>
                <button
                  type="button"
                  onClick={() => void conversations.refetch()}
                  className="mt-2 text-[13px] font-semibold text-brand-blue hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : shown.length > 0 ? (
              <ul className="space-y-0.5">
                {shown.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    viewerId={user.id}
                    selected={conversation.id === openId}
                    onSelect={() => select(conversation.id)}
                  />
                ))}
              </ul>
            ) : (
              <div className="px-6 py-10 text-center">
                <p className="text-[14px] font-semibold text-ink">{query ? 'No chat by that name' : 'No chats yet'}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {query ? 'Try another name.' : 'Start a conversation with someone in your society.'}
                </p>
                {query ? null : (
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-blue/10 px-4 text-[13px] font-semibold text-brand-blue transition hover:bg-brand-blue/15"
                  >
                    <SquarePen className="size-4" />
                    New message
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        <main
          className={cn(
            'min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-white max-sm:rounded-none max-sm:border-0',
            chatOpen ? 'flex' : 'hidden lg:flex',
          )}
        >
          {current && other ? (
            <>
              <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => select(null)}
                  aria-label="Back to chats"
                  className="grid size-9 place-items-center rounded-full text-ink/70 hover:bg-muted lg:hidden"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <Link to="/people/$userId" params={{ userId: String(other.id) }} className="shrink-0">
                  <Avatar name={other.name} src={other.avatar_url} online={online} className="size-10 text-sm" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/people/$userId"
                    params={{ userId: String(other.id) }}
                    className="block truncate text-[15px] font-semibold text-ink hover:underline"
                  >
                    {other.name}
                  </Link>
                  <PresenceLine userId={other.id} />
                </div>
              </header>
              <ChatThread key={current.id} conversationId={current.id} person={other} inputRef={inputRef} />
            </>
          ) : chatOpen && (single.isError || (current && !other)) ? (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div>
                <p className="text-[15px] font-semibold text-ink">Conversation not found</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {single.isError
                    ? apiErrorMessage(single.error, 'It may have been removed.')
                    : 'It may have been removed.'}
                </p>
                <button
                  type="button"
                  onClick={() => select(null)}
                  className="mt-3 text-[13px] font-semibold text-brand-blue hover:underline"
                >
                  Back to chats
                </button>
              </div>
            </div>
          ) : chatOpen || params.with ? (
            <div className="grid flex-1 place-items-center">
              <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div>
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-blue/10 text-brand-blue">
                  <MessageCircle className="size-8" />
                </span>
                <p className="mt-4 text-lg font-semibold text-ink">Your messages</p>
                <p className="mt-1 max-w-[320px] text-[13px] text-muted-foreground">
                  Pick a chat, or start a new one with someone in your society.
                </p>
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
                >
                  <SquarePen className="size-4" />
                  New message
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {picking ? <NewChatDialog onPick={(person) => start.mutate(person)} onClose={() => setPicking(false)} /> : null}
      <Toaster />
    </div>
  )
}
