import { useDeferredValue, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { Check, Plus, Search, UserPlus, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SocietyGroup, SocietyPerson } from '@/types/society'
import { TypingPreview } from '@/components/chat/TypingIndicator'
import { useTypers } from '@/components/chat/typing'
import { Avatar } from '@/components/feed/Avatar'
import { FeedNavbar } from '@/components/feed/FeedNavbar'
import { Toaster } from '@/components/feed/Toaster'
import { ChatPanel } from '@/components/society/ChatPanel'
import { GroupChatPanel } from '@/components/society/GroupChat'
import { CreateGroupDialog, GroupAvatar, GroupInfoDialog, groupPreview, useGroups } from '@/components/society/groupUi'
import { PersonPanel } from '@/components/society/PersonPanel'
import { SOCIETY_PEOPLE_KEY, previewLine, useSocietyAction, useSocietyOverview } from '@/components/society/societyUi'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { useIsOnline } from '@/services/realtime'
import { societyService } from '@/services/societyService'

type Filter = 'friends' | 'groups' | 'invitations' | 'sent' | 'discover'

/** Friends is the main list: only people who accepted (or whose request you accepted) appear there. */
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'friends', label: 'Friends' },
  { value: 'groups', label: 'Groups' },
  { value: 'invitations', label: 'Requests' },
  { value: 'sent', label: 'Sent' },
  { value: 'discover', label: 'Discover' },
]

function InlineActions({ person }: { person: SocietyPerson }) {
  const action = useSocietyAction(person)
  const round = 'grid size-8 shrink-0 place-items-center rounded-full transition disabled:opacity-50'

  if (person.relationship === 'incoming') {
    return (
      <span className="flex shrink-0 gap-1 pr-2">
        <button
          type="button"
          aria-label={`Ignore ${person.name}`}
          disabled={action.isPending}
          onClick={() => action.mutate('remove')}
          className={cn(round, 'bg-muted text-ink/70 hover:bg-[#e3e6ee]')}
        >
          <X className="size-4" />
        </button>
        <button
          type="button"
          aria-label={`Accept ${person.name}`}
          disabled={action.isPending}
          onClick={() => action.mutate('accept')}
          className={cn(round, 'bg-brand-blue text-white hover:bg-brand-blue/90')}
        >
          <Check className="size-4" />
        </button>
      </span>
    )
  }

  if (person.relationship === 'none') {
    return (
      <span className="shrink-0 pr-2">
        <button
          type="button"
          aria-label={`Add ${person.name}`}
          disabled={action.isPending}
          onClick={() => action.mutate('add')}
          className={cn(round, 'bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20')}
        >
          <UserPlus className="size-4" />
        </button>
      </span>
    )
  }

  return null
}

function PersonListItem({
  person,
  selected,
  onSelect,
}: {
  person: SocietyPerson
  selected: boolean
  onSelect: () => void
}) {
  const { text, time } = previewLine(person)
  const unread = person.unread_count > 0
  const online = useIsOnline(person.relationship === 'friends' ? person.id : null)
  const typers = useTypers(person.conversation_id ? `c:${person.conversation_id}` : null)

  return (
    <li className={cn('flex items-center rounded-xl transition', selected ? 'bg-brand-blue/[0.07]' : 'hover:bg-muted')}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left"
      >
        <Avatar name={person.name} src={person.avatar_url} online={online} className="size-12 text-base" />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[14px] text-ink', unread ? 'font-bold' : 'font-semibold')}>
            {person.name}
          </span>
          {text || time || typers.length > 0 ? (
            <span
              className={cn(
                'flex min-w-0 gap-1 text-[12px]',
                unread ? 'font-semibold text-ink' : 'text-muted-foreground',
              )}
            >
              <span className="truncate">{typers.length > 0 ? <TypingPreview typers={typers} /> : text}</span>
              {time ? <span className="shrink-0">· {time}</span> : null}
            </span>
          ) : null}
        </span>
        {unread ? (
          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-blue px-1.5 text-[11px] font-bold text-white">
            {person.unread_count}
          </span>
        ) : null}
      </button>
      <InlineActions person={person} />
    </li>
  )
}

function GroupListItem({
  group,
  selected,
  onSelect,
}: {
  group: SocietyGroup
  selected: boolean
  onSelect: () => void
}) {
  const { text, time } = groupPreview(group)
  const unread = group.unread_count > 0
  const typers = useTypers(`g:${group.id}`)

  return (
    <li className={cn('flex items-center rounded-xl transition', selected ? 'bg-brand-blue/[0.07]' : 'hover:bg-muted')}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left"
      >
        <GroupAvatar group={group} className="size-12 text-sm" />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[14px] text-ink', unread ? 'font-bold' : 'font-semibold')}>
            {group.name}
          </span>
          <span
            className={cn(
              'flex min-w-0 gap-1 text-[12px]',
              unread ? 'font-semibold text-ink' : 'text-muted-foreground',
            )}
          >
            <span className="truncate">{typers.length > 0 ? <TypingPreview typers={typers} group /> : text}</span>
            {time ? <span className="shrink-0">· {time}</span> : null}
          </span>
        </span>
        {unread ? (
          <span className="mr-2 grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-blue px-1.5 text-[11px] font-bold text-white">
            {group.unread_count}
          </span>
        ) : null}
      </button>
    </li>
  )
}

function ListSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="pb-2">
      {title ? (
        <p className="px-2 pt-3 pb-1 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
      ) : null}
      <ul>{children}</ul>
    </div>
  )
}

export default function SocietyPage() {
  const user = useCurrentUser()
  const params = useSearch({ strict: false })
  const withId = params.with
  const [filter, setFilter] = useState<Filter>(params.tab === 'groups' || params.group ? 'groups' : 'friends')
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<SocietyPerson | null>(null)
  const [groupId, setGroupId] = useState<number | null>(null)
  const [groupInfo, setGroupInfo] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [infoOpen, setInfoOpen] = useState(true)
  const [focusSignal, setFocusSignal] = useState(0)
  const deferredSearch = useDeferredValue(search.trim())

  const overview = useSocietyOverview()
  const groupsQuery = useGroups()

  const [openedWith, setOpenedWith] = useState<number | null>(null)
  const linked = withId && withId !== openedWith ? overview.data?.friends.find((p) => p.id === withId) : undefined
  if (linked) {
    setOpenedWith(linked.id)
    setSelected(linked)
    setGroupId(null)
  }
  const [openedGroup, setOpenedGroup] = useState<number | null>(null)
  if (params.group && params.group !== openedGroup && groupsQuery.data?.data.some((g) => g.id === params.group)) {
    setOpenedGroup(params.group)
    setGroupId(params.group)
    setSelected(null)
  }

  const groups = groupsQuery.data?.data ?? []
  const currentGroup = groupId !== null ? (groups.find((g) => g.id === groupId) ?? null) : null
  const selectPerson = (person: SocietyPerson) => {
    setSelected(person)
    setGroupId(null)
  }
  const selectGroup = (group: SocietyGroup) => {
    setGroupId(group.id)
    setSelected(null)
  }
  const wantsPeople = filter === 'discover' && deferredSearch !== ''
  const people = useQuery({
    queryKey: [...SOCIETY_PEOPLE_KEY, deferredSearch],
    queryFn: () => societyService.people(deferredSearch),
    placeholderData: (previous) => previous,
    enabled: wantsPeople,
  })

  if (!user) return null

  const friends = overview.data?.friends ?? []
  const incoming = overview.data?.incoming ?? []
  const outgoing = overview.data?.outgoing ?? []
  const connected = [...incoming, ...friends, ...outgoing]
  const connectedIds = new Set(connected.map((p) => p.id))
  const others = wantsPeople ? (people.data ?? []).filter((p) => !connectedIds.has(p.id)) : []

  // The overview lists every connection, so anyone missing from it (once loaded) is no longer connected.
  const current: SocietyPerson | null = selected
    ? (connected.find((p) => p.id === selected.id) ??
      (people.data ?? []).find((p) => p.id === selected.id) ?? {
        ...selected,
        relationship: overview.isSuccess ? 'none' : selected.relationship,
      })
    : null

  const query = deferredSearch.toLowerCase()
  const matches = (p: SocietyPerson) => !query || p.name.toLowerCase().includes(query)

  const row = (person: SocietyPerson) => (
    <PersonListItem
      key={person.id}
      person={person}
      selected={current?.id === person.id}
      onSelect={() => selectPerson(person)}
    />
  )
  const shownGroups = groups.filter((g) => !query || g.name.toLowerCase().includes(query))
  const chatOpen = current !== null || currentGroup !== null

  const sections: Array<{ title?: string; people: Array<SocietyPerson> }> =
    filter === 'invitations'
      ? [{ title: 'Waiting for your answer', people: incoming.filter(matches) }]
      : filter === 'sent'
        ? [{ title: 'Waiting for them to accept', people: outgoing.filter(matches) }]
        : filter === 'discover'
          ? [{ title: 'People on denuwe', people: others }]
          : [{ title: deferredSearch ? 'In your society' : undefined, people: friends.filter(matches) }]
  const visible = filter === 'groups' ? [] : sections.filter((s) => s.people.length > 0)
  const loading = filter === 'groups' ? groupsQuery.isLoading : overview.isLoading || (wantsPeople && people.isLoading)
  const findOnDenuwe = (
    <button
      type="button"
      onClick={() => {
        setFilter('discover')
        searchRef.current?.focus()
      }}
      className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-blue/10 px-4 text-[13px] font-semibold text-brand-blue transition hover:bg-brand-blue/15"
    >
      <UserPlus className="size-4" />
      {deferredSearch ? `Find “${deferredSearch}” on denuwe` : 'Find people'}
    </button>
  )

  return (
    <div className="app-page flex h-dvh flex-col max-sm:h-[min(100dvh,800px)]">
      <FeedNavbar user={user} active="society" hideMobileTabs={chatOpen} />

      <div
        className={cn(
          'mx-auto grid min-h-0 w-full max-w-[1440px] flex-1 grid-rows-[minmax(0,1fr)] gap-3 p-3 max-sm:p-0 lg:grid-cols-[340px_minmax(0,1fr)]',
          current && infoOpen && 'xl:grid-cols-[340px_minmax(0,1fr)_320px]',
        )}
      >
        <aside
          className={cn(
            'min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-white max-sm:rounded-none max-sm:border-0',
            chatOpen ? 'hidden lg:flex' : 'flex',
          )}
        >
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between">
              <h1 className="text-[22px] font-bold text-ink">My Society</h1>
              <button
                type="button"
                title="Find people"
                aria-label="Find people"
                onClick={() => {
                  setFilter('discover')
                  searchRef.current?.focus()
                }}
                className="grid size-9 place-items-center rounded-full bg-muted text-ink transition hover:bg-[#e3e6ee]"
              >
                <UserPlus className="size-[18px]" />
              </button>
            </div>
            <label className="relative mt-3 block">
              <span className="sr-only">Search My Society</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={filter === 'groups' ? 'Search your groups' : 'Search name, email or mobile number'}
                className="h-9 w-full rounded-full bg-muted pr-3 pl-9 text-[14px] text-ink placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-blue/20 focus:outline-none"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-0.5 pb-2" role="tablist">
              {FILTERS.map((option) => {
                const count =
                  option.value === 'invitations'
                    ? incoming.length
                    : option.value === 'groups'
                      ? (groupsQuery.data?.unread_count ?? 0)
                      : 0
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={filter === option.value}
                    onClick={() => setFilter(option.value)}
                    className={cn(
                      'flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[13px] font-semibold transition',
                      filter === option.value ? 'bg-brand-blue/10 text-brand-blue' : 'text-ink/70 hover:bg-muted',
                    )}
                  >
                    {option.label}
                    {count > 0 ? (
                      <span className="grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-white">
                        {count}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {loading ? (
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
            ) : null}

            {!loading && filter === 'groups' ? (
              <>
                <div className="px-2 pt-1 pb-2">
                  <button
                    type="button"
                    onClick={() => setCreatingGroup(true)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-muted"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-blue/10 text-brand-blue">
                      <Plus className="size-5" />
                    </span>
                    <span>
                      <span className="block text-[14px] font-semibold text-ink">Create Group Society</span>
                      <span className="block text-[12px] text-muted-foreground">Chat with several friends at once</span>
                    </span>
                  </button>
                </div>
                {shownGroups.length > 0 ? (
                  <ListSection title="Your groups">
                    {shownGroups.map((group) => (
                      <GroupListItem
                        key={group.id}
                        group={group}
                        selected={currentGroup?.id === group.id}
                        onSelect={() => selectGroup(group)}
                      />
                    ))}
                  </ListSection>
                ) : (
                  <div className="px-6 py-8 text-center">
                    <p className="text-[14px] font-semibold text-ink">
                      {deferredSearch ? 'No group by that name' : 'No groups yet'}
                    </p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {deferredSearch
                        ? 'Try another name.'
                        : 'Groups you create, or that friends add you to, show up here.'}
                    </p>
                  </div>
                )}
              </>
            ) : null}

            {!loading
              ? visible.map((section) => (
                  <ListSection key={section.title ?? filter} title={section.title}>
                    {section.people.map(row)}
                  </ListSection>
                ))
              : null}

            {!loading && filter === 'friends' && deferredSearch && visible.length > 0 ? (
              <div className="px-2 pt-1 text-center">{findOnDenuwe}</div>
            ) : null}

            {!loading && filter !== 'groups' && visible.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-[14px] font-semibold text-ink">
                  {filter === 'friends'
                    ? deferredSearch
                      ? 'No friend by that name'
                      : 'Your society is empty'
                    : deferredSearch
                      ? 'No one found'
                      : filter === 'invitations'
                        ? 'No friend requests'
                        : filter === 'sent'
                          ? 'No pending requests'
                          : 'Find people on denuwe'}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {filter === 'friends'
                    ? 'Only people who accepted your request appear here.'
                    : deferredSearch
                      ? 'Try their full email address or mobile number.'
                      : 'Search by name, email or mobile number to add friends who are on denuwe.'}
                </p>
                {filter === 'friends' ? findOnDenuwe : null}
                {filter === 'friends' && !deferredSearch && incoming.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setFilter('invitations')}
                    className="mt-2 block w-full text-[12px] font-semibold text-brand-blue hover:underline"
                  >
                    You have {incoming.length} friend {incoming.length === 1 ? 'request' : 'requests'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>

        <main
          className={cn(
            'min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-white max-sm:rounded-none max-sm:border-0',
            chatOpen ? 'flex' : 'hidden lg:flex',
          )}
        >
          {currentGroup ? (
            <GroupChatPanel group={currentGroup} onBack={() => setGroupId(null)} onInfo={() => setGroupInfo(true)} />
          ) : (
            <ChatPanel
              person={current}
              onBack={() => setSelected(null)}
              infoOpen={infoOpen}
              onToggleInfo={() => setInfoOpen((v) => !v)}
              focusSignal={focusSignal}
            />
          )}
        </main>

        {current && infoOpen ? (
          <aside className="hidden min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-white xl:flex">
            <PersonPanel person={current} onMessage={() => setFocusSignal((n) => n + 1)} />
          </aside>
        ) : null}
      </div>

      {currentGroup && groupInfo ? (
        <GroupInfoDialog
          group={currentGroup}
          onClose={() => setGroupInfo(false)}
          onGone={() => {
            setGroupInfo(false)
            setGroupId(null)
          }}
        />
      ) : null}
      {creatingGroup ? (
        <CreateGroupDialog
          onClose={() => setCreatingGroup(false)}
          onCreated={(group) => {
            setCreatingGroup(false)
            setFilter('groups')
            selectGroup(group)
          }}
        />
      ) : null}
      <Toaster />
    </div>
  )
}
