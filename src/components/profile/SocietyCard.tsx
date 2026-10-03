import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { LoaderCircle, MessageCircle, Search, Users, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SocietyPerson } from '@/types/society'
import { Avatar } from '@/components/feed/Avatar'
import {
  RelationshipActions,
  SOCIETY_PEOPLE_KEY,
  mutualLabel,
  useSocietyOverview,
} from '@/components/society/societyUi'
import { plural } from '@/components/clubs/clubUi'
import { societyService } from '@/services/societyService'

const FRIENDS_PREVIEW = 6

function PersonRow({ person, action }: { person: SocietyPerson; action: ReactNode }) {
  const subtitle = person.headline ?? mutualLabel(person.mutual_count) ?? person.location
  return (
    <li className="flex items-center gap-2.5 py-2">
      <Link
        to="/people/$userId"
        params={{ userId: String(person.id) }}
        className="group flex min-w-0 flex-1 items-center gap-2.5"
      >
        <Avatar name={person.name} src={person.avatar_url} className="size-10 text-[13px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink group-hover:underline">{person.name}</span>
          {subtitle ? <span className="block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
        </span>
      </Link>
      {action}
    </li>
  )
}

function MessageLink({ person }: { person: SocietyPerson }) {
  return (
    <Link
      to="/society"
      search={{ with: person.id }}
      aria-label={`Message ${person.name}`}
      title={`Message ${person.name}`}
      className="grid size-9 shrink-0 place-items-center rounded-full border border-[#c4c9d4] text-ink/70 transition hover:bg-muted hover:text-brand-blue"
    >
      <MessageCircle className="size-4" />
    </Link>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{children}</p>
}

/** Your friends on the profile, with search to find and add anyone on denuwe. */
export function SocietyCard() {
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const query = useDeferredValue(search.trim())

  const overview = useSocietyOverview()
  const people = useQuery({
    queryKey: [...SOCIETY_PEOPLE_KEY, query],
    queryFn: () => societyService.people(query),
    placeholderData: (previous) => previous,
    enabled: query !== '',
  })

  const friends = overview.data?.friends ?? []
  const incoming = overview.data?.incoming ?? []
  const friendIds = new Set(friends.map((p) => p.id))

  const needle = query.toLowerCase()
  const friendMatches = friends.filter((p) => p.name.toLowerCase().includes(needle))
  const others = (people.data ?? []).filter((p) => !friendIds.has(p.id))
  const visibleFriends = showAll ? friends : friends.slice(0, FRIENDS_PREVIEW)
  const searching = people.isFetching && people.data !== undefined

  return (
    <section className="rounded-xl border border-border bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-ink">Society</h2>
          <p className="text-xs text-muted-foreground">
            {overview.isSuccess ? plural(friends.length, 'friend') : 'Your friends on denuwe'}
          </p>
        </div>
        <Link to="/society" className="mt-1 shrink-0 text-[13px] font-semibold text-brand-blue hover:underline">
          Open My Society
        </Link>
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, email or mobile"
          aria-label="Search friends or find people by name, email or mobile"
          className="h-9 w-full rounded-full border border-[#c4c9d4] bg-[#f4f6fb] pr-10 pl-9 text-[13px] text-ink placeholder:text-muted-foreground focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/15 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {searching ? (
          <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearch('')}
            className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink/60 hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {query ? (
        <>
          {friendMatches.length > 0 ? (
            <>
              <Heading>In your society</Heading>
              <ul className="divide-y divide-border">
                {friendMatches.map((p) => (
                  <PersonRow key={p.id} person={p} action={<MessageLink person={p} />} />
                ))}
              </ul>
            </>
          ) : null}
          <Heading>People on denuwe</Heading>
          {people.isLoading ? (
            <p className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Searching…
            </p>
          ) : others.length > 0 ? (
            <ul className="divide-y divide-border">
              {others.map((p) => (
                <PersonRow key={p.id} person={p} action={<RelationshipActions person={p} />} />
              ))}
            </ul>
          ) : (
            <p className="py-4 text-[13px] text-muted-foreground">
              No one found for “{query}”. Try a full name, an email or a mobile number.
            </p>
          )}
        </>
      ) : (
        <>
          {incoming.length > 0 ? (
            <>
              <Heading>Friend requests · {incoming.length}</Heading>
              <ul className="divide-y divide-border">
                {incoming.map((p) => (
                  <PersonRow key={p.id} person={p} action={<RelationshipActions person={p} />} />
                ))}
              </ul>
            </>
          ) : null}

          {overview.isLoading ? <div className="mt-4 h-16 animate-pulse rounded-lg bg-muted" /> : null}

          {overview.isSuccess && friends.length === 0 ? (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-muted/70 px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink/60">
                <Users className="size-5" />
              </span>
              <p className="text-[13px] text-muted-foreground">
                Your society is empty. Search above by name, email or mobile number to add friends.
              </p>
            </div>
          ) : null}

          {friends.length > 0 ? (
            <>
              <Heading>Friends</Heading>
              <ul className="divide-y divide-border">
                {visibleFriends.map((p) => (
                  <PersonRow key={p.id} person={p} action={<MessageLink person={p} />} />
                ))}
              </ul>
              {friends.length > FRIENDS_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-1 w-full rounded-lg py-2 text-[13px] font-semibold text-ink/70 transition hover:bg-muted"
                >
                  {showAll ? 'Show less' : `Show all ${friends.length} friends`}
                </button>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </section>
  )
}
