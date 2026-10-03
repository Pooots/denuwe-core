import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitFork, Globe, Mail, Plus, Repeat, Trophy, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TournamentSummary } from '@/types/tournament'
import { FeedNavbar } from '@/components/feed/FeedNavbar'
import { MessagingDock } from '@/components/feed/MessagingDock'
import { Toaster } from '@/components/feed/Toaster'
import { TournamentCard } from '@/components/tournaments/TournamentCard'
import { TournamentFormDialog } from '@/components/tournaments/TournamentFormDialog'
import { TOURNAMENTS_KEY } from '@/components/tournaments/tournamentUi'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { tournamentService } from '@/services/tournamentService'

type Filter = 'all' | 'playing' | 'organizing' | 'public'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'playing', label: 'I’m playing' },
  { id: 'organizing', label: 'I organize' },
  { id: 'public', label: 'Public' },
]

/** On the All tab: public tournaments the viewer isn't part of yet, the open ones first. */
function PublicCard({
  tournaments,
  viewerId,
  onSeeAll,
}: {
  tournaments: Array<TournamentSummary>
  viewerId: number
  onSeeAll: () => void
}) {
  const shown = tournaments.slice(0, 3)
  return (
    <section className="rounded-xl border border-border bg-white px-3 py-3 sm:px-4">
      <div className="flex items-start justify-between gap-2 px-1 sm:px-0">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Globe className="size-4 text-brand-blue" /> Public tournaments
            <span className="rounded-full bg-muted px-1.5 text-[11px] leading-[18px] text-ink/60">
              {tournaments.length}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">Open to everyone. Join one or follow along.</p>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="h-8 shrink-0 rounded-full border border-[#c4c9d4] px-3 text-[12px] font-semibold text-ink/80 transition hover:bg-muted"
        >
          See all
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-4 text-center text-[13px] text-muted-foreground">
          No public tournaments right now. Make yours public so everyone can find it.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {shown.map((t) => (
            <TournamentCard key={t.id} tournament={t} viewerId={viewerId} />
          ))}
        </div>
      )}
    </section>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null
  return (
    <section>
      <h2 className="on-backdrop mb-2 flex w-fit items-center gap-2 text-[14px] font-semibold text-ink">
        {title}
        <span className="rounded-full bg-muted px-1.5 text-[11px] leading-[18px] text-ink/60">{count}</span>
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function HowItWorks() {
  const steps: Array<{ icon: ReactNode; title: string; body: string }> = [
    {
      icon: <Trophy className="size-4" />,
      title: 'Create',
      body: 'Name it, choose individual or teams, and pick a bracket.',
    },
    {
      icon: <Mail className="size-4" />,
      title: 'Invite',
      body: 'Public tournaments are open to everyone. Private ones are for friends you invite from your society (and club members).',
    },
    {
      icon: <GitFork className="size-4 rotate-90" />,
      title: 'Start',
      body: 'Seeds are shuffled and every match is drawn for you.',
    },
    {
      icon: <Repeat className="size-4" />,
      title: 'Play',
      body: 'Enter results as matches finish until a champion is crowned.',
    },
  ]
  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3">
      <h2 className="text-[15px] font-semibold text-ink">How it works</h2>
      <ol className="mt-2 space-y-2.5">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-blue/10 text-brand-blue">
              {step.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">
                {i + 1}. {step.title}
              </span>
              <span className="block text-xs leading-snug text-muted-foreground">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function TournamentsPage() {
  const user = useCurrentUser()
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const list = useQuery({ queryKey: TOURNAMENTS_KEY, queryFn: () => tournamentService.list() })

  if (!user) return null

  const all = list.data?.data ?? []
  const publicOnes = list.data?.public ?? []
  const mineIds = new Set(all.map((t) => t.id))
  /** Public tournaments the viewer isn't already part of, for the All tab's card. */
  const discover = publicOnes.filter((t) => !mineIds.has(t.id) && t.status !== 'completed')
  const shown =
    filter === 'public'
      ? publicOnes
      : all.filter((t) =>
          filter === 'playing' ? t.my_entry_id !== null : filter === 'organizing' ? t.can_manage : true,
        )
  const invites = shown.filter((t) => t.invite_pending && t.status === 'registration')
  const rest = shown.filter((t) => !invites.includes(t))
  const by = (status: TournamentSummary['status']) => rest.filter((t) => t.status === status)
  const groups: Array<[string, Array<TournamentSummary>]> = [
    ['Invitations', invites],
    ['Live now', by('in_progress')],
    ['Open for registration', by('registration')],
    ['Completed', by('completed')],
  ]

  return (
    <div className="app-page min-h-dvh">
      <FeedNavbar user={user} active="tournaments" />

      <div className="mx-auto max-w-[1128px] space-y-4 px-3 pt-4 pb-24 sm:space-y-5 sm:px-4 sm:pt-6 sm:pb-16">
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="brand-gradient relative px-5 py-5 text-white sm:px-6 sm:py-7">
            <div className="vibe-gradient absolute inset-0 opacity-40" />
            <Trophy className="absolute top-1/2 right-8 hidden size-24 -translate-y-1/2 text-white/15 sm:block" />
            <Trophy className="absolute -top-3 -right-3 size-20 text-white/10 sm:hidden" />
            <div className="relative flex flex-wrap items-end justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold sm:text-2xl">Tournaments</h1>
                <p className="mt-1 max-w-[520px] text-[13px] leading-snug text-white/85 sm:text-[14px]">
                  <span className="sm:hidden">Host and follow tournaments with your society and clubs.</span>
                  <span className="hidden sm:inline">
                    Host a tournament with friends from your society or for your club. Players or teams, knockout or
                    round robin, from sign-ups to the champion.
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-ink shadow-sm transition hover:bg-white/90 sm:h-9 sm:w-auto"
              >
                <Plus className="size-4" /> Create tournament
              </button>
            </div>
          </div>
          <div
            role="tablist"
            aria-label="Filter tournaments"
            className="scrollbar-none flex gap-1 overflow-x-auto border-t border-border px-2 sm:px-4"
          >
            {FILTERS.map((f) => {
              const selected = f.id === filter
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'relative h-12 shrink-0 px-3 text-[14px] font-semibold whitespace-nowrap transition',
                    selected ? 'text-brand-blue' : 'text-ink/60 hover:text-ink',
                  )}
                >
                  {f.label}
                  {selected ? (
                    <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-brand-blue" />
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <main className="min-w-0 space-y-5">
            {list.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-white" />
                ))}
              </div>
            ) : null}

            {list.isError ? (
              <div className="rounded-xl border border-border bg-white px-6 py-10 text-center">
                <p className="text-[15px] font-semibold text-ink">Couldn’t load tournaments</p>
                <button
                  type="button"
                  onClick={() => void list.refetch()}
                  className="mt-3 h-8 rounded-full border border-brand-blue px-4 text-[13px] font-semibold text-brand-blue hover:bg-brand-blue/5"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {list.data && filter === 'all' ? (
              <PublicCard tournaments={discover} viewerId={user.id} onSeeAll={() => setFilter('public')} />
            ) : null}

            {list.data && shown.length === 0 ? (
              <div className="rounded-xl border border-border bg-white px-6 py-10 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-400/15 text-amber-700">
                  <Trophy className="size-6" />
                </span>
                <p className="mt-3 text-[15px] font-semibold text-ink">
                  {filter === 'all'
                    ? 'No tournaments yet'
                    : filter === 'playing'
                      ? 'You’re not playing in any tournament'
                      : filter === 'public'
                        ? 'No public tournaments yet'
                        : 'You don’t organize any tournament'}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {filter === 'public'
                    ? 'Create one and make it public so everyone can find it and join.'
                    : 'Create one and invite your friends, or wait for an invite. Your clubs’ tournaments show up here too.'}
                </p>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="mt-4 h-9 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
                >
                  Create tournament
                </button>
              </div>
            ) : null}

            {groups.map(([title, items]) => (
              <Section key={title} title={title} count={items.length}>
                {items.map((t) => (
                  <TournamentCard key={t.id} tournament={t} viewerId={user.id} />
                ))}
              </Section>
            ))}
          </main>

          <aside className="space-y-3 lg:sticky lg:top-[72px]">
            {/* On phones the steps only help before there's anything to show. */}
            <div className={cn(all.length > 0 && 'hidden lg:block')}>
              <HowItWorks />
            </div>
            {list.data && list.data.organize_clubs.length > 0 ? (
              <section className="rounded-xl border border-border bg-white px-4 py-3">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <Users className="size-4 text-brand-blue" /> Host for your club
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  You can host for {list.data.organize_clubs.map((c) => c.name).join(', ')}. Pick the club as host when
                  you create a tournament.
                </p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>

      <MessagingDock user={user} />
      {creating ? (
        <TournamentFormDialog organizeClubs={list.data?.organize_clubs ?? []} onClose={() => setCreating(false)} />
      ) : null}
      <Toaster />
    </div>
  )
}
