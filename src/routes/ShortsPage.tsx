import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Clapperboard, LoaderCircle, Plus, Shield, Sparkles, UserRound, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Short, ShortFeed, ShortFilters } from '@/types/short'
import { CLUBS_KEY } from '@/components/clubs/clubUi'
import { FeedNavbar } from '@/components/feed/FeedNavbar'
import { Toaster } from '@/components/feed/Toaster'
import { CreateShortDialog } from '@/components/shorts/CreateShortDialog'
import { ShortComments } from '@/components/shorts/ShortComments'
import { ShortsViewer } from '@/components/shorts/ShortsViewer'
import { useShorts } from '@/components/shorts/shortsCache'
import { societyProfileKey } from '@/components/society/societyUi'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { clubService } from '@/services/clubService'
import { shortService } from '@/services/shortService'
import { societyService } from '@/services/societyService'

export type ShortsSearch = { feed?: ShortFeed; short?: number; user?: number; club?: number }

const TABS: Array<{ id: ShortFeed; label: string; short: string; icon: LucideIcon }> = [
  { id: 'all', label: 'For you', short: 'For you', icon: Sparkles },
  { id: 'society', label: 'My society', short: 'Society', icon: Users },
  { id: 'clubs', label: 'Clubs & communities', short: 'Clubs', icon: Shield },
  { id: 'mine', label: 'My shorts', short: 'Mine', icon: UserRound },
]

const EMPTY: Record<ShortFeed, { title: string; text: string }> = {
  all: { title: 'No shorts yet', text: 'Be the first to share a short with denuwe.' },
  society: { title: 'Nothing from your society yet', text: 'Shorts your friends post will show up here.' },
  clubs: { title: 'No club shorts yet', text: 'Shorts shared in your clubs and communities show up here.' },
  mine: { title: 'You haven’t posted a short yet', text: 'Share a moment from race day, game night or practice.' },
}

const LARGE = '(min-width: 1024px)'

function useLarge(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(LARGE)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia(LARGE).matches,
  )
}

export default function ShortsPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const large = useLarge()
  const search = useSearch({ strict: false })
  const [commentsFor, setCommentsFor] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  const feed: ShortFeed = search.feed ?? 'all'
  const narrowed = Boolean(search.user || search.club)
  const filters: ShortFilters = useMemo(
    () => (narrowed ? { feed: 'all', user: search.user, club: search.club } : { feed }),
    [narrowed, feed, search.user, search.club],
  )

  const list = useShorts(filters, user !== null)
  const start = useQuery({
    queryKey: ['short', search.short],
    queryFn: () => shortService.get(search.short as number),
    enabled: Boolean(search.short),
    retry: false,
  })
  const person = useQuery({
    queryKey: societyProfileKey(search.user ?? 0),
    queryFn: () => societyService.profile(search.user as number),
    enabled: Boolean(search.user) && search.user !== user?.id,
  })
  const clubs = useQuery({
    queryKey: [...CLUBS_KEY, 'mine'],
    queryFn: () => clubService.mine(),
    enabled: !!search.club,
  })

  const shorts = useMemo(() => {
    const seen = new Set<number>()
    const all = [...(start.data ? [start.data] : []), ...(list.data?.pages.flatMap((page) => page.data) ?? [])]
    return all.filter((s) => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return true
    })
  }, [start.data, list.data])

  const commentsShort = shorts.find((s) => s.id === commentsFor) ?? null
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage])
  const onActiveChange = useCallback((active: Short | null) => {
    setCommentsFor((open) => (open !== null && active ? active.id : open))
  }, [])

  if (!user) return null

  const setFeed = (next: ShortFeed) => {
    setCommentsFor(null)
    void navigate({ to: '/shorts', search: next === 'all' ? {} : { feed: next } })
  }
  const clearFilter = () => {
    setCommentsFor(null)
    void navigate({ to: '/shorts', search: {} })
  }
  const onDeleted = (short: Short) => {
    setCommentsFor(null)
    if (search.short === short.id)
      void navigate({ to: '/shorts', search: { ...search, short: undefined }, replace: true })
  }

  const filterName = search.user
    ? search.user === user.id
      ? 'Your shorts'
      : `Shorts by ${person.data?.name ?? shorts.find((s) => s.author.id === search.user)?.author.name ?? '…'}`
    : search.club
      ? `Shorts in ${clubs.data?.find((c) => c.id === search.club)?.name ?? shorts.find((s) => s.club?.id === search.club)?.club?.name ?? '…'}`
      : null

  const loading = list.isLoading || (start.isLoading && Boolean(search.short))
  const empty = !loading && !list.isError && shorts.length === 0
  const emptyCopy = narrowed
    ? { title: 'No shorts here yet', text: 'When shorts are shared here, they’ll show up for you.' }
    : EMPTY[feed]

  const createButton = (className: string) => (
    <button
      type="button"
      onClick={() => setCreating(true)}
      className={cn(
        'brand-gradient flex items-center justify-center gap-2 rounded-full font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-95',
        className,
      )}
    >
      <Plus className="size-5" />
      <span className="max-lg:sr-only">Create short</span>
    </button>
  )

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white max-sm:h-[min(100dvh,800px)]">
      <FeedNavbar user={user} active="shorts" hideMobileTabs={commentsShort !== null && !large} />

      <div className="relative flex min-h-0 flex-1">
        <aside className="hidden w-[264px] shrink-0 flex-col border-r border-border px-4 py-5 lg:flex">
          <div className="flex items-center gap-2.5 px-2">
            <span className="brand-gradient grid size-9 place-items-center rounded-xl text-white">
              <Clapperboard className="size-5" />
            </span>
            <div>
              <h1 className="text-lg leading-tight font-semibold text-ink">Shorts</h1>
              <p className="text-xs text-muted-foreground">Quick videos and photos from your people</p>
            </div>
          </div>
          {createButton('mt-5 h-11 text-[14px]')}
          <nav aria-label="Shorts" className="mt-5 space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const selected = !narrowed && feed === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => setFeed(tab.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold transition',
                    selected ? 'bg-brand-blue/10 text-brand-blue' : 'text-ink/70 hover:bg-muted hover:text-ink',
                  )}
                >
                  <Icon className="size-5" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
          <p className="mt-auto px-2 text-[11px] leading-relaxed text-muted-foreground">
            Each short is shared with everyone, the author’s society, or one club or community. You only see the ones
            shared with you.
          </p>
        </aside>

        <main className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 pt-3 pb-6 md:bg-none lg:pointer-events-none">
            {filterName ? (
              <span className="pointer-events-auto flex h-9 min-w-0 items-center gap-1 rounded-full bg-white/95 pr-1 pl-3.5 text-[13px] font-semibold text-ink shadow">
                <span className="truncate">{filterName}</span>
                <button
                  type="button"
                  onClick={clearFilter}
                  aria-label="Show all shorts"
                  className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </span>
            ) : (
              <nav aria-label="Shorts" className="scrollbar-none flex min-w-0 gap-1.5 overflow-x-auto lg:hidden">
                {TABS.map((tab) => {
                  const selected = feed === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      aria-current={selected ? 'page' : undefined}
                      onClick={() => setFeed(tab.id)}
                      className={cn(
                        'h-8 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition',
                        selected
                          ? 'bg-white text-ink md:bg-ink md:text-white'
                          : 'bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 md:bg-muted md:text-ink md:hover:bg-[#e4e7ee]',
                      )}
                    >
                      {tab.short}
                    </button>
                  )
                })}
              </nav>
            )}
            {createButton('ml-auto size-9 shrink-0 lg:hidden')}
          </div>

          {loading ? (
            <div className="grid h-full place-items-center">
              <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : list.isError ? (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <p className="text-[15px] font-semibold text-ink">We couldn’t load shorts.</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{apiErrorMessage(list.error)}</p>
                <button
                  type="button"
                  onClick={() => (narrowed ? clearFilter() : void list.refetch())}
                  className="mt-4 h-9 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
                >
                  {narrowed ? 'Show all shorts' : 'Try again'}
                </button>
              </div>
            </div>
          ) : empty ? (
            <div className="grid h-full place-items-center px-6 text-center">
              <div className="max-w-xs">
                <span className="brand-gradient mx-auto grid size-16 place-items-center rounded-2xl text-white shadow-xl">
                  <Clapperboard className="size-7" />
                </span>
                <p className="mt-4 text-[17px] font-semibold text-ink">{emptyCopy.title}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{emptyCopy.text}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="h-10 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
                  >
                    Create a short
                  </button>
                  {feed === 'society' && !narrowed ? (
                    <Link
                      to="/society"
                      className="grid h-10 place-items-center rounded-full border border-[#c4c9d4] px-5 text-[13px] font-semibold text-ink transition hover:bg-muted"
                    >
                      Find friends
                    </Link>
                  ) : null}
                  {feed === 'clubs' && !narrowed ? (
                    <Link
                      to="/clubs"
                      className="grid h-10 place-items-center rounded-full border border-[#c4c9d4] px-5 text-[13px] font-semibold text-ink transition hover:bg-muted"
                    >
                      Explore clubs
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <ShortsViewer
              key={`${JSON.stringify(filters)}-${search.short ?? ''}`}
              shorts={shorts}
              hasMore={Boolean(hasNextPage)}
              loadingMore={isFetchingNextPage}
              onLoadMore={loadMore}
              onComments={(short) => setCommentsFor((id) => (id === short.id ? null : short.id))}
              onDeleted={onDeleted}
              onActiveChange={onActiveChange}
            />
          )}
          {start.isError && search.short ? (
            <p className="absolute inset-x-4 bottom-4 z-10 rounded-xl bg-white/95 px-4 py-3 text-center text-[13px] text-ink shadow-lg">
              {apiErrorMessage(start.error)}
            </p>
          ) : null}
        </main>

        {commentsShort && large ? (
          <aside className="w-[380px] shrink-0 border-l border-border">
            <ShortComments short={commentsShort} user={user} onClose={() => setCommentsFor(null)} />
          </aside>
        ) : null}
        {commentsShort && !large ? (
          <section aria-label="Comments" className="absolute inset-0 z-30 flex flex-col">
            <ShortComments short={commentsShort} user={user} onClose={() => setCommentsFor(null)} />
          </section>
        ) : null}
      </div>

      {creating ? (
        <CreateShortDialog
          user={user}
          onClose={() => setCreating(false)}
          onCreated={(short) => void navigate({ to: '/shorts', search: { short: short.id } })}
        />
      ) : null}
      <Toaster />
    </div>
  )
}
