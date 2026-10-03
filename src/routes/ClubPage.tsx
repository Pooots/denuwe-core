import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clapperboard,
  Clock,
  Lock,
  MessageSquareText,
  Settings,
  Trash2,
  Trophy,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { Club, ClubDetail } from '@/types/club'
import {
  CLUB_GRADIENT,
  CLUB_TYPE_LABEL,
  ClubIcon,
  FeeChip,
  TypeChip,
  VisibilityChip,
  clubLink,
  feeLabel,
  plural,
  refreshClubs,
} from '@/components/clubs/clubUi'
import { ClubActivities } from '@/components/clubs/ClubActivities'
import { ClubSettingsDialog } from '@/components/clubs/ClubSettingsDialog'
import { ClubTournaments } from '@/components/clubs/ClubTournaments'
import { ClubWall } from '@/components/clubs/ClubWall'
import { JoinButton } from '@/components/clubs/JoinButton'
import { JoinRequestsCard } from '@/components/clubs/JoinRequestsCard'
import { MembersCard } from '@/components/clubs/MembersCard'
import { OfficersCard } from '@/components/clubs/OfficersCard'
import { FeedNavbar } from '@/components/feed/FeedNavbar'
import { MessagingDock } from '@/components/feed/MessagingDock'
import { Toaster, toast } from '@/components/feed/Toaster'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { clubService } from '@/services/clubService'

type ClubTab = 'wall' | 'activities' | 'tournaments'

function ClubTabs({
  detail,
  active,
  onChange,
}: {
  detail: ClubDetail
  active: ClubTab
  onChange: (tab: ClubTab) => void
}) {
  const tabs: Array<{ id: ClubTab; label: string; icon: ReactNode; count?: number }> = [
    { id: 'wall', label: 'Wall', icon: <MessageSquareText className="size-4" /> },
    {
      id: 'activities',
      label: 'Activities',
      icon: <CalendarDays className="size-4" />,
      count: detail.activities.length,
    },
    {
      id: 'tournaments',
      label: 'Tournaments',
      icon: <Trophy className="size-4" />,
      count: detail.tournaments.filter((t) => t.status !== 'completed').length,
    },
  ]

  return (
    <nav role="tablist" aria-label="Club sections" className="flex gap-1 overflow-x-auto border-t border-border px-4">
      {tabs.map((tab) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex h-12 shrink-0 items-center gap-1.5 px-3 text-[14px] font-semibold transition',
              selected ? 'text-brand-blue' : 'text-ink/60 hover:text-ink',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count ? (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] leading-[18px]',
                  selected ? 'bg-brand-blue/10' : 'bg-muted text-ink/60',
                )}
              >
                {tab.count}
              </span>
            ) : null}
            {selected ? <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-brand-blue" /> : null}
          </button>
        )
      })}
      {detail.club.is_member ? (
        <Link
          to="/shorts"
          search={{ club: detail.club.id }}
          className="flex h-12 shrink-0 items-center gap-1.5 px-3 text-[14px] font-semibold text-ink/60 transition hover:text-ink"
        >
          <Clapperboard className="size-4" />
          Shorts
        </Link>
      ) : null}
    </nav>
  )
}

function PrivateNotice({ club }: { club: Club }) {
  const typeLabel = CLUB_TYPE_LABEL[club.type].toLowerCase()
  return (
    <section className="rounded-xl border border-border bg-white px-6 py-10 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-ink/5 text-ink/70">
        <Lock className="size-6" />
      </span>
      <h2 className="mt-3 text-[17px] font-semibold text-ink">This {typeLabel} is private</h2>
      <p className="mx-auto mt-1 max-w-[420px] text-[13px] text-muted-foreground">
        Only its members and owner can open it. It doesn’t show up in Explore, and its details, wall, members,
        activities and tournaments stay hidden.
      </p>
      {club.has_requested ? (
        <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1.5 text-[13px] font-semibold text-amber-800">
          <Clock className="size-4" /> Your request is waiting for the owner’s approval
        </p>
      ) : (
        <p className="mt-3 text-[13px] text-ink/70">
          Use <strong>Request to join</strong> above, and the owner will review it.
        </p>
      )}
    </section>
  )
}

export default function ClubPage() {
  const user = useCurrentUser()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const { pathname } = useLocation()
  const slug = params.slug ?? ''
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<ClubTab>('wall')

  const detail = useQuery({
    queryKey: ['club', slug],
    queryFn: () => clubService.get(slug),
    enabled: slug !== '',
    retry: false,
  })

  // Old id links, renamed clubs and communities opened under /clubs move to the current address.
  useEffect(() => {
    const data = detail.data
    const address = /^\/(clubs|communities)\/([^/]+)\/?$/.exec(pathname)
    // While navigating away the location changes before this page unmounts; only correct our own address.
    if (!data || !address || decodeURIComponent(address[2]) !== slug) return
    const underCommunities = address[1] === 'communities'
    if (data.club.slug === slug && underCommunities === (data.club.type === 'community')) return
    qc.setQueryData(['club', data.club.slug], data)
    void navigate({ ...clubLink(data.club), replace: true })
  }, [detail.data, slug, pathname, qc, navigate])

  const removeClub = useMutation({
    mutationFn: (id: number) => clubService.remove(id),
    onSuccess: () => {
      refreshClubs(qc)
      toast(`${detail.data ? CLUB_TYPE_LABEL[detail.data.club.type] : 'Club'} deleted.`)
      void navigate({ to: '/clubs' })
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })

  if (!user) return null

  const data = detail.data
  const club = data?.club
  const typeLabel = club ? CLUB_TYPE_LABEL[club.type].toLowerCase() : 'club'
  return (
    <div className="app-page min-h-dvh">
      <FeedNavbar user={user} active="clubs" />

      <div className="mx-auto max-w-[1128px] px-4 pt-4 pb-16">
        <Link
          to="/clubs"
          className="on-backdrop mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink/70 hover:text-ink"
        >
          <ArrowLeft className="size-4" /> All clubs & communities
        </Link>

        {detail.isLoading ? <div className="h-72 animate-pulse rounded-xl border border-border bg-white" /> : null}

        {detail.isError ? (
          <div className="rounded-xl border border-border bg-white px-6 py-12 text-center">
            <p className="text-[15px] font-semibold text-ink">This club doesn’t exist anymore.</p>
            <Link to="/clubs" className="mt-2 inline-block text-[13px] font-semibold text-brand-blue hover:underline">
              Explore other clubs
            </Link>
          </div>
        ) : null}

        {data && club ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <main className="min-w-0 space-y-2">
              <section className="overflow-hidden rounded-xl border border-border bg-white">
                <div className={cn('relative h-32 bg-gradient-to-br sm:h-44', CLUB_GRADIENT[club.color])}>
                  {club.banner_url ? (
                    <img src={club.banner_url} alt="" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <div className="vibe-gradient absolute inset-0 opacity-30" />
                  )}
                </div>
                <div className="flow-root px-6 pb-4">
                  <ClubIcon
                    color={club.color}
                    type={club.type}
                    src={club.avatar_url}
                    className="relative -mt-12 size-24 rounded-2xl border-4 border-white shadow-sm"
                    iconClassName="size-10"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold text-ink">{club.name}</h1>
                    <TypeChip type={club.type} className="text-xs" />
                    <VisibilityChip visibility={club.visibility} className="text-xs" />
                    {data.can_view ? <FeeChip club={club} className="text-xs" /> : null}
                  </div>
                  {club.description ? (
                    <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-line text-ink/80">
                      {club.description}
                    </p>
                  ) : null}
                  {data.can_view ? (
                    <p className="mt-2 text-[13px] text-muted-foreground">
                      {plural(club.members_count, 'member')} ·{' '}
                      {plural(club.upcoming_count, 'upcoming activity', 'upcoming activities')}
                    </p>
                  ) : null}
                  {club.my_fee_status === 'unpaid' ? (
                    <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-amber-400/10 px-3 py-2.5 text-[13px] text-ink/80">
                      <Wallet className="mt-0.5 size-4 shrink-0 text-amber-700" />
                      <p>
                        <span className="font-semibold text-ink">Membership fee pending: {feeLabel(club)}.</span>{' '}
                        Arrange payment with the owner. They’ll mark you as paid once it’s received.
                      </p>
                    </div>
                  ) : null}
                  {club.my_fee_status === 'paid' && !club.is_owner ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
                      <BadgeCheck className="size-4" /> Membership fee paid
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <JoinButton club={club} />
                    {club.is_owner ? (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#c4c9d4] px-4 text-[13px] font-semibold text-ink/80 transition hover:bg-muted"
                      >
                        <Settings className="size-4" /> Settings
                      </button>
                    ) : null}
                    {club.is_owner ? (
                      <button
                        type="button"
                        disabled={removeClub.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete ${club.name}? Members, posts, activities and tournaments will be removed.`,
                            )
                          ) {
                            removeClub.mutate(club.id)
                          }
                        }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink/60 transition hover:bg-muted hover:text-danger disabled:opacity-50"
                      >
                        <Trash2 className="size-4" /> Delete {typeLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
                {data.can_view ? <ClubTabs detail={data} active={tab} onChange={setTab} /> : null}
              </section>

              {data.can_view ? (
                <div role="tabpanel">
                  {tab === 'wall' ? <ClubWall club={club} user={user} /> : null}
                  {tab === 'activities' ? <ClubActivities detail={data} /> : null}
                  {tab === 'tournaments' ? <ClubTournaments detail={data} viewerId={user.id} /> : null}
                </div>
              ) : (
                <PrivateNotice club={club} />
              )}
            </main>

            {data.can_view ? (
              <aside className="space-y-2">
                <JoinRequestsCard detail={data} />
                <OfficersCard detail={data} viewerId={user.id} />
                <MembersCard detail={data} viewerId={user.id} />
              </aside>
            ) : null}
          </div>
        ) : null}
      </div>

      <MessagingDock user={user} />
      {editing && club ? <ClubSettingsDialog club={club} onClose={() => setEditing(false)} /> : null}
      <Toaster />
    </div>
  )
}
