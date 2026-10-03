import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import type { Club, ClubType } from '@/types/club'
import {
  CLUBS_KEY,
  CLUB_GRADIENT,
  CLUB_TYPE_LABEL,
  ClubIcon,
  FeeChip,
  TypeChip,
  VisibilityChip,
  clubLink,
  plural,
} from '@/components/clubs/clubUi'
import { CreateClubDialog } from '@/components/clubs/CreateClubDialog'
import { JoinButton } from '@/components/clubs/JoinButton'
import { FeedNavbar } from '@/components/feed/FeedNavbar'
import { MessagingDock } from '@/components/feed/MessagingDock'
import { Toaster } from '@/components/feed/Toaster'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { clubService } from '@/services/clubService'

function ClubCard({ club }: { club: Club }) {
  return (
    <Link
      {...clubLink(club)}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-white transition hover:shadow-md"
    >
      <div className={cn('relative h-16 bg-gradient-to-br', CLUB_GRADIENT[club.color])}>
        {club.banner_url ? (
          <img src={club.banner_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="flex items-end justify-between gap-2">
          <ClubIcon
            color={club.color}
            type={club.type}
            src={club.avatar_url}
            className="relative -mt-7 size-14 rounded-xl border-4 border-white"
            iconClassName="size-6"
          />
          <div className="flex flex-wrap justify-end gap-1">
            {club.visibility === 'private' ? <VisibilityChip visibility={club.visibility} /> : null}
            <TypeChip type={club.type} />
            <FeeChip club={club} />
          </div>
        </div>
        <p className="mt-2 truncate text-[15px] font-semibold text-ink group-hover:underline">{club.name}</p>
        <p className="mt-0.5 line-clamp-2 min-h-[2.5em] text-xs text-muted-foreground">
          {club.description || `A denuwe ${CLUB_TYPE_LABEL[club.type].toLowerCase()}.`}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {plural(club.members_count, 'member')}
          {club.upcoming_count > 0
            ? ` · ${plural(club.upcoming_count, 'upcoming activity', 'upcoming activities')}`
            : ''}
        </p>
        <JoinButton club={club} className="mt-3 w-full" />
      </div>
    </Link>
  )
}

export default function ClubsPage() {
  const user = useCurrentUser()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<ClubType | 'all'>('all')
  const deferredSearch = useDeferredValue(search.trim())

  const clubs = useQuery({
    queryKey: [...CLUBS_KEY, 'discover', deferredSearch],
    queryFn: () => clubService.list(deferredSearch),
    placeholderData: (previous) => previous,
  })

  if (!user) return null

  const all = (clubs.data ?? []).filter((club) => filter === 'all' || club.type === filter)
  const mine = all.filter((club) => club.is_member)
  const others = all.filter((club) => !club.is_member)

  return (
    <div className="app-page min-h-dvh">
      <FeedNavbar user={user} active="clubs" />

      <div className="mx-auto max-w-[1128px] space-y-6 px-4 pt-6 pb-16">
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="brand-gradient relative px-6 py-8 text-white">
            <div className="vibe-gradient absolute inset-0 opacity-40" />
            <div className="relative flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">Explore clubs & communities</h1>
                <p className="mt-1 text-[14px] text-white/85">
                  Find your people: hikes, games, sports, causes and more.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-ink transition hover:bg-white/90"
              >
                <Plus className="size-4" /> Start a club or community
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <label className="relative block w-full max-w-[420px]">
              <span className="sr-only">Search clubs and communities</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clubs and communities"
                className="h-10 w-full rounded-full border border-[#c4c9d4] bg-white pr-4 pl-9 text-[14px] text-ink placeholder:text-muted-foreground focus:border-brand-blue focus:outline-none"
              />
            </label>
            <div role="tablist" className="flex gap-1 rounded-full bg-muted p-1">
              {(
                [
                  ['all', 'All'],
                  ['club', 'Clubs'],
                  ['community', 'Communities'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'h-8 rounded-full px-4 text-[13px] font-semibold transition',
                    filter === value ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {clubs.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl border border-border bg-white" />
            ))}
          </div>
        ) : null}

        {mine.length > 0 ? (
          <section>
            <h2 className="on-backdrop mb-3 w-fit text-[17px] font-semibold text-ink">Your memberships</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {mine.map((club) => (
                <ClubCard key={club.id} club={club} />
              ))}
            </div>
          </section>
        ) : null}

        {clubs.isSuccess ? (
          <section>
            <h2 className="on-backdrop mb-3 w-fit text-[17px] font-semibold text-ink">{deferredSearch ? 'Results' : 'Discover'}</h2>
            {others.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {others.map((club) => (
                  <ClubCard key={club.id} club={club} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-white px-6 py-10 text-center">
                <img src="/denuwe-mark.png" alt="" className="mx-auto size-12" />
                <p className="mt-3 text-[15px] font-semibold text-ink">
                  {deferredSearch
                    ? `Nothing matches “${deferredSearch}”`
                    : filter === 'community'
                      ? 'No other communities yet'
                      : filter === 'club'
                        ? 'No other clubs yet'
                        : 'No other clubs or communities yet'}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">Be the one who brings people together.</p>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="mt-4 h-9 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
                >
                  Start a club
                </button>
              </div>
            )}
          </section>
        ) : null}
      </div>

      <MessagingDock user={user} />
      {creating ? <CreateClubDialog onClose={() => setCreating(false)} /> : null}
      <Toaster />
    </div>
  )
}
