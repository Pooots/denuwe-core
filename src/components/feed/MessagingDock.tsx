import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '@tanstack/react-router'
import {
  Check,
  ChevronUp,
  Info,
  LoaderCircle,
  Maximize2,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Search,
  SquarePen,
  Users,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { AuthUser } from '@/types/auth'
import type { SocietyGroup, SocietyPerson } from '@/types/society'
import { Avatar } from '@/components/feed/Avatar'
import { useDismiss } from '@/components/feed/useDismiss'
import { PresenceLine } from '@/components/chat/ConnectionStatus'
import { TypingPreview } from '@/components/chat/TypingIndicator'
import { useTypers } from '@/components/chat/typing'
import { FriendChat } from '@/components/society/ChatPanel'
import { GroupComposer, GroupMessages, useGroupConversation } from '@/components/society/GroupChat'
import { CreateGroupDialog, GroupAvatar, GroupInfoDialog, groupPreview, useGroups } from '@/components/society/groupUi'
import { previewLine, useSocietyOverview } from '@/components/society/societyUi'
import { cn } from '@/lib/utils'
import { isRealtimeConfigured, useIsOnline } from '@/services/realtime'

/** A friend's id, a group as `g<id>`, or 'new' while picking who to message. */
type DockChat = number | `g${number}` | 'new' | null

type DockState = {
  open: boolean
  chat: DockChat
  minimized: boolean
  unreadOnly: boolean
}

const STORAGE_KEY = 'messaging_dock'
const INITIAL: DockState = { open: false, chat: null, minimized: false, unreadOnly: false }

function readDock(): DockState {
  try {
    return { ...INITIAL, ...(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<DockState>) }
  } catch {
    return INITIAL
  }
}

// Shared by every mounted dock and by anything that opens a chat in it (the feed's Group Society card),
// and kept in sessionStorage so it stays as it was while moving around the app.
let dock: DockState = readDock()
const dockListeners = new Set<() => void>()

function updateDock(patch: Partial<DockState>): void {
  dock = { ...dock, ...patch }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dock))
  dockListeners.forEach((listener) => listener())
}

function useDockState() {
  const state = useSyncExternalStore(
    (onChange) => {
      dockListeners.add(onChange)
      return () => dockListeners.delete(onChange)
    },
    () => dock,
  )
  return [state, updateDock] as const
}

/** Open a group's chat window in the messaging dock. */
export function openGroupInDock(groupId: number): void {
  updateDock({ chat: `g${groupId}`, minimized: false })
}

type DockItem = { kind: 'person'; person: SocietyPerson } | { kind: 'group'; group: SocietyGroup }

const itemName = (item: DockItem) => (item.kind === 'person' ? item.person.name : item.group.name)
const itemUnread = (item: DockItem) => (item.kind === 'person' ? item.person : item.group).unread_count
const itemLastAt = (item: DockItem) => {
  const at = (item.kind === 'person' ? item.person : item.group).last_message?.created_at
  return at ? new Date(at).getTime() : 0
}
const matchesName = (p: SocietyPerson, search: string) => p.name.toLowerCase().includes(search.trim().toLowerCase())

function HeaderButton({
  label,
  onClick,
  children,
  pressed,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  pressed?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={pressed}
      onClick={onClick}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full text-ink/70 transition hover:bg-muted hover:text-ink',
        pressed && 'bg-muted text-ink',
      )}
    >
      {children}
    </button>
  )
}

function SearchBox({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoFocus?: boolean
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-md bg-muted pr-3 pl-9 text-[13px] text-ink placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-blue/20 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
    </label>
  )
}

function ConversationRow({ person, onOpen }: { person: SocietyPerson; onOpen: () => void }) {
  const { text, time } = previewLine(person)
  const unread = person.unread_count > 0
  const online = useIsOnline(person.id)
  const typers = useTypers(person.conversation_id ? `c:${person.conversation_id}` : null)
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-muted"
      >
        <Avatar name={person.name} src={person.avatar_url} online={online} className="size-10 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn('min-w-0 flex-1 truncate text-[13px] text-ink', unread ? 'font-bold' : 'font-semibold')}
            >
              {person.name}
            </span>
            {time ? <span className="shrink-0 text-[11px] text-muted-foreground">{time}</span> : null}
          </span>
          <span className={cn('block truncate text-xs', unread ? 'font-semibold text-ink' : 'text-muted-foreground')}>
            {typers.length > 0 ? <TypingPreview typers={typers} /> : text}
          </span>
        </span>
        {unread ? (
          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-blue px-1.5 text-[11px] font-bold text-white">
            {person.unread_count}
          </span>
        ) : null}
      </button>
    </li>
  )
}

function GroupRow({ group, onOpen }: { group: SocietyGroup; onOpen: () => void }) {
  const { text, time } = groupPreview(group)
  const unread = group.unread_count > 0
  const typers = useTypers(`g:${group.id}`)
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-muted"
      >
        <GroupAvatar group={group} className="size-10 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn('min-w-0 flex-1 truncate text-[13px] text-ink', unread ? 'font-bold' : 'font-semibold')}
            >
              {group.name}
            </span>
            {time ? <span className="shrink-0 text-[11px] text-muted-foreground">{time}</span> : null}
          </span>
          <span className={cn('block truncate text-xs', unread ? 'font-semibold text-ink' : 'text-muted-foreground')}>
            {typers.length > 0 ? <TypingPreview typers={typers} group /> : text}
          </span>
        </span>
        {unread ? (
          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-blue px-1.5 text-[11px] font-bold text-white">
            {group.unread_count}
          </span>
        ) : null}
      </button>
    </li>
  )
}

function GroupChatWindow({
  group,
  minimized,
  onToggleMinimize,
  onClose,
}: {
  group: SocietyGroup
  minimized: boolean
  onToggleMinimize: () => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const conversation = useGroupConversation(minimized ? null : group)
  const [info, setInfo] = useState(false)

  useEffect(() => {
    if (!minimized) inputRef.current?.focus()
  }, [group.id, minimized])

  return (
    <section
      aria-label={`Group chat ${group.name}`}
      className={cn(
        'flex flex-col overflow-hidden rounded-t-xl border border-b-0 border-border bg-white shadow-[0_-4px_20px_-8px_rgb(18_23_43/0.25)]',
        minimized ? 'w-64' : 'h-[min(460px,calc(100dvh-6rem))] w-[336px]',
      )}
    >
      <header className="flex items-center gap-2 border-b border-border px-2 py-1.5">
        <button
          type="button"
          onClick={onToggleMinimize}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted"
        >
          <GroupAvatar group={group} className="size-8 text-[11px]" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-ink">{group.name}</span>
            {minimized ? null : (
              <span className="block truncate text-[11px] text-muted-foreground">{group.member_count} members</span>
            )}
          </span>
          {minimized && group.unread_count > 0 ? (
            <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-brand-blue px-1 text-[10px] font-bold text-white">
              {group.unread_count}
            </span>
          ) : null}
        </button>
        <HeaderButton label="Group info" onClick={() => setInfo(true)}>
          <Info className="size-4" />
        </HeaderButton>
        <HeaderButton label={minimized ? 'Expand conversation' : 'Minimize conversation'} onClick={onToggleMinimize}>
          {minimized ? <ChevronUp className="size-4" /> : <Minus className="size-4" />}
        </HeaderButton>
        <HeaderButton label="Close conversation" onClick={onClose}>
          <X className="size-4" />
        </HeaderButton>
      </header>

      {minimized ? null : (
        <>
          {conversation.data ? (
            <GroupMessages group={group} messages={conversation.data} compact />
          ) : (
            <div className="grid flex-1 place-items-center">
              {conversation.isError ? (
                <p className="text-[13px] text-muted-foreground">Couldn’t load messages.</p>
              ) : (
                <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
              )}
            </div>
          )}
          <GroupComposer group={group} inputRef={inputRef} compact />
        </>
      )}
      {info
        ? createPortal(<GroupInfoDialog group={group} onClose={() => setInfo(false)} onGone={onClose} />, document.body)
        : null}
    </section>
  )
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="px-6 py-8 text-center text-[13px] text-muted-foreground">{children}</div>
}

function FindFriendsLink() {
  return (
    <Link to="/society" className="mt-2 inline-block font-semibold text-brand-blue hover:underline">
      Find people in My Society
    </Link>
  )
}

function ChatWindow({
  person,
  minimized,
  onToggleMinimize,
  onClose,
}: {
  person: SocietyPerson
  minimized: boolean
  onToggleMinimize: () => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const online = useIsOnline(person.id)

  useEffect(() => {
    if (!minimized) inputRef.current?.focus()
  }, [person.id, minimized, person.conversation_id])

  return (
    <section
      aria-label={`Conversation with ${person.name}`}
      className={cn(
        'flex flex-col overflow-hidden rounded-t-xl border border-b-0 border-border bg-white shadow-[0_-4px_20px_-8px_rgb(18_23_43/0.25)]',
        minimized ? 'w-64' : 'h-[min(460px,calc(100dvh-6rem))] w-[336px]',
      )}
    >
      <header className="flex items-center gap-2 border-b border-border px-2 py-1.5">
        <button
          type="button"
          onClick={onToggleMinimize}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted"
        >
          <Avatar name={person.name} src={person.avatar_url} online={online} className="size-8 text-[11px]" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-ink">{person.name}</span>
            {minimized ? null : isRealtimeConfigured ? (
              <PresenceLine userId={person.id} className="text-[11px]" />
            ) : person.headline ? (
              <span className="block truncate text-[11px] text-muted-foreground">{person.headline}</span>
            ) : null}
          </span>
          {minimized && person.unread_count > 0 ? (
            <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-brand-blue px-1 text-[10px] font-bold text-white">
              {person.unread_count}
            </span>
          ) : null}
        </button>
        <Link
          to="/messages"
          search={person.conversation_id ? { c: person.conversation_id } : { with: person.id }}
          aria-label="Open in Messages"
          title="Open in Messages"
          className="grid size-8 shrink-0 place-items-center rounded-full text-ink/70 transition hover:bg-muted hover:text-ink"
        >
          <Maximize2 className="size-3.5" />
        </Link>
        <HeaderButton label={minimized ? 'Expand conversation' : 'Minimize conversation'} onClick={onToggleMinimize}>
          {minimized ? <ChevronUp className="size-4" /> : <Minus className="size-4" />}
        </HeaderButton>
        <HeaderButton label="Close conversation" onClick={onClose}>
          <X className="size-4" />
        </HeaderButton>
      </header>

      {minimized ? null : <FriendChat person={person} inputRef={inputRef} compact />}
    </section>
  )
}

function NewMessageWindow({
  friends,
  loading,
  onPick,
  onClose,
}: {
  friends: Array<SocietyPerson>
  loading: boolean
  onPick: (person: SocietyPerson) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const people = friends.filter((p) => matchesName(p, search)).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <section
      aria-label="New message"
      className="flex h-[min(460px,calc(100dvh-6rem))] w-[336px] flex-col overflow-hidden rounded-t-xl border border-b-0 border-border bg-white shadow-[0_-4px_20px_-8px_rgb(18_23_43/0.25)]"
    >
      <header className="flex items-center gap-2 border-b border-border py-1.5 pr-2 pl-3">
        <span className="flex-1 text-[13px] font-semibold text-ink">New message</span>
        <HeaderButton label="Close new message" onClick={onClose}>
          <X className="size-4" />
        </HeaderButton>
      </header>
      <div className="border-b border-border p-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Type a friend’s name" autoFocus />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid place-items-center py-8">
            <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : people.length > 0 ? (
          <ul className="py-1">
            {people.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => onPick(person)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-muted"
                >
                  <Avatar name={person.name} src={person.avatar_url} className="size-9 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{person.name}</span>
                    {person.headline ? (
                      <span className="block truncate text-xs text-muted-foreground">{person.headline}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : friends.length === 0 ? (
          <EmptyNote>
            You can message people once they accept your friend request.
            <br />
            <FindFriendsLink />
          </EmptyNote>
        ) : (
          <EmptyNote>No friend named “{search.trim()}”.</EmptyNote>
        )}
      </div>
    </section>
  )
}

export function MessagingDock({ user }: { user: AuthUser }) {
  const [state, update] = useDockState()
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  useDismiss(menuRef, menuOpen, closeMenu)

  const [creatingGroup, setCreatingGroup] = useState(false)
  // Group chats aren't live yet, so their list still polls while the dock is in use.
  const polling = state.open || state.chat !== null ? 15_000 : undefined
  const overview = useSocietyOverview()
  const groupsQuery = useGroups(polling)
  const friends = overview.data?.friends ?? []
  const groups = groupsQuery.data?.data ?? []
  const unreadTotal = (overview.data?.unread_count ?? 0) + (groupsQuery.data?.unread_count ?? 0)
  const chatPerson = typeof state.chat === 'number' ? friends.find((p) => p.id === state.chat) : undefined
  const chatGroupId = typeof state.chat === 'string' && state.chat.startsWith('g') ? Number(state.chat.slice(1)) : null
  const chatGroup = chatGroupId !== null ? groups.find((g) => g.id === chatGroupId) : undefined

  // Close the window if that person is no longer a friend, or you're no longer in that group.
  useEffect(() => {
    if (overview.isSuccess && typeof state.chat === 'number' && !chatPerson) update({ chat: null })
  }, [overview.isSuccess, state.chat, chatPerson, update])
  useEffect(() => {
    if (groupsQuery.isSuccess && chatGroupId !== null && !chatGroup) update({ chat: null })
  }, [groupsQuery.isSuccess, chatGroupId, chatGroup, update])

  const query = search.trim().toLowerCase()
  const conversations: Array<DockItem> = [
    ...groups.map((group) => ({ kind: 'group' as const, group })),
    ...friends.map((person) => ({ kind: 'person' as const, person })),
  ]
    .filter((item) => itemName(item).toLowerCase().includes(query) && (!state.unreadOnly || itemUnread(item) > 0))
    .sort((a, b) => itemLastAt(b) - itemLastAt(a) || itemName(a).localeCompare(itemName(b)))

  const openChat = (person: SocietyPerson) => update({ chat: person.id, minimized: false })

  return (
    <div className="pointer-events-none fixed bottom-0 left-6 z-30 hidden items-end gap-3 md:flex">
      <section
        aria-label="Messaging"
        className={cn(
          'pointer-events-auto relative z-10 flex w-72 flex-col rounded-t-xl border border-b-0 border-border bg-white shadow-[0_-4px_20px_-8px_rgb(18_23_43/0.25)]',
          state.open && 'h-[min(520px,calc(100dvh-6rem))]',
        )}
      >
        <header className={cn('relative flex items-center gap-1 px-2 py-1.5', state.open && 'border-b border-border')}>
          <button
            type="button"
            onClick={() => update({ open: !state.open })}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted"
          >
            <Avatar name={user.name} src={user.avatar_url} className="size-8 text-xs" online />
            <span className="truncate text-[13px] font-semibold text-ink">Messaging</span>
            {unreadTotal > 0 ? (
              <span
                aria-label={`${unreadTotal} unread`}
                className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white"
              >
                {unreadTotal}
              </span>
            ) : null}
          </button>

          <div ref={menuRef}>
            <HeaderButton label="More" pressed={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              <MoreHorizontal className="size-4" />
            </HeaderButton>
            {menuOpen ? (
              <div
                role="menu"
                className={cn(
                  'absolute right-2 z-10 w-60 overflow-hidden rounded-lg border border-border bg-white py-1 shadow-lg',
                  state.open ? 'top-full mt-1' : 'bottom-full mb-1',
                )}
              >
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={state.unreadOnly}
                  onClick={() => {
                    update({ unreadOnly: !state.unreadOnly, open: true })
                    closeMenu()
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink hover:bg-muted"
                >
                  <Check className={cn('size-4', state.unreadOnly ? 'text-brand-blue' : 'invisible')} />
                  Unread conversations only
                </button>
                {state.chat !== null ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      update({ chat: null })
                      closeMenu()
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink hover:bg-muted"
                  >
                    <X className="size-4 text-ink/60" />
                    Close chat window
                  </button>
                ) : null}
                <Link
                  to="/messages"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2 text-[13px] text-ink hover:bg-muted"
                >
                  <MessageCircle className="size-4 text-ink/60" />
                  Open Messages
                </Link>
                <Link
                  to="/society"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-ink hover:bg-muted"
                >
                  <Users className="size-4 text-ink/60" />
                  Open My Society
                </Link>
              </div>
            ) : null}
          </div>
          <HeaderButton label="New group" onClick={() => setCreatingGroup(true)}>
            <Users className="size-4" />
          </HeaderButton>
          <HeaderButton label="New message" onClick={() => update({ chat: 'new', minimized: false })}>
            <SquarePen className="size-4" />
          </HeaderButton>
          <HeaderButton
            label={state.open ? 'Close messaging' : 'Open messaging'}
            pressed={state.open}
            onClick={() => update({ open: !state.open })}
          >
            <ChevronUp className={cn('size-4 transition-transform', state.open && 'rotate-180')} />
          </HeaderButton>
        </header>

        {state.open ? (
          <>
            <div className="p-2">
              <SearchBox value={search} onChange={setSearch} placeholder="Search messages" />
            </div>
            {state.unreadOnly ? (
              <div className="flex items-center justify-between px-3 pb-1 text-[11px] font-semibold text-muted-foreground uppercase">
                Unread
                <button
                  type="button"
                  onClick={() => update({ unreadOnly: false })}
                  className="font-semibold text-brand-blue normal-case hover:underline"
                >
                  Show all
                </button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto pb-1">
              {overview.isLoading ? (
                <div className="grid place-items-center py-8">
                  <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length > 0 ? (
                <ul>
                  {conversations.map((item) =>
                    item.kind === 'group' ? (
                      <GroupRow
                        key={`g${item.group.id}`}
                        group={item.group}
                        onOpen={() => openGroupInDock(item.group.id)}
                      />
                    ) : (
                      <ConversationRow key={item.person.id} person={item.person} onOpen={() => openChat(item.person)} />
                    ),
                  )}
                </ul>
              ) : friends.length === 0 && groups.length === 0 ? (
                <EmptyNote>
                  Your conversations will appear here once people accept your friend request.
                  <br />
                  <FindFriendsLink />
                </EmptyNote>
              ) : search.trim() ? (
                <EmptyNote>No conversations with “{search.trim()}”.</EmptyNote>
              ) : (
                <EmptyNote>You’re all caught up. No unread messages.</EmptyNote>
              )}
            </div>
          </>
        ) : null}
      </section>

      {chatGroup ? (
        <div className="pointer-events-auto">
          <GroupChatWindow
            group={chatGroup}
            minimized={state.minimized}
            onToggleMinimize={() => update({ minimized: !state.minimized })}
            onClose={() => update({ chat: null })}
          />
        </div>
      ) : chatPerson ? (
        <div className="pointer-events-auto">
          <ChatWindow
            person={chatPerson}
            minimized={state.minimized}
            onToggleMinimize={() => update({ minimized: !state.minimized })}
            onClose={() => update({ chat: null })}
          />
        </div>
      ) : state.chat === 'new' ? (
        <div className="pointer-events-auto">
          <NewMessageWindow
            friends={friends}
            loading={overview.isLoading}
            onPick={openChat}
            onClose={() => update({ chat: null })}
          />
        </div>
      ) : null}

      {creatingGroup
        ? createPortal(
            <CreateGroupDialog
              onClose={() => setCreatingGroup(false)}
              onCreated={(group) => {
                setCreatingGroup(false)
                openGroupInDock(group.id)
              }}
            />,
            document.body,
          )
        : null}
    </div>
  )
}
