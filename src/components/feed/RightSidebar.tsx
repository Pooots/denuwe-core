import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { CLUBS_KEY, CLUB_BG, ClubIcon, UPCOMING_KEY, clubLink, plural, shortDate } from '@/components/clubs/clubUi'
import { CreateClubDialog } from '@/components/clubs/CreateClubDialog'
import { cn } from '@/lib/utils'
import { clubService } from '@/services/clubService'

const MAX_CLUBS = 6

function RowSkeleton() {
  return (
    <li className="flex animate-pulse items-center gap-3 py-1.5">
      <span className="size-8 rounded-md bg-muted" />
      <span className="h-3 flex-1 rounded bg-muted" />
    </li>
  )
}

export function RightSidebar() {
  const [creating, setCreating] = useState(false)
  const clubs = useQuery({ queryKey: [...CLUBS_KEY, 'mine'], queryFn: () => clubService.mine() })
  const upcoming = useQuery({ queryKey: UPCOMING_KEY, queryFn: () => clubService.upcoming(5) })

  const myClubs = clubs.data ?? []

  return (
    <aside className="space-y-2">
      <section className="rounded-xl border border-border bg-white px-4 py-3">
        <h2 className="text-[17px] font-semibold text-ink">Your clubs</h2>
        <ul className="mt-2">
          {clubs.isLoading ? (
            <>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </>
          ) : null}
          {myClubs.slice(0, MAX_CLUBS).map((club) => (
            <li key={club.id}>
              <Link
                {...clubLink(club)}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
              >
                <ClubIcon color={club.color} type={club.type} src={club.avatar_url} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{club.name}</span>
                <span className="text-xs text-muted-foreground" title={plural(club.members_count, 'member')}>
                  {club.members_count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {clubs.isSuccess && myClubs.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">You haven’t joined any clubs yet.</p>
        ) : null}
        {clubs.isError ? <p className="text-[13px] text-muted-foreground">Couldn’t load your clubs.</p> : null}
        {clubs.isSuccess ? (
          <Link
            to="/clubs"
            className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-ink/70 hover:text-ink"
          >
            {myClubs.length > MAX_CLUBS ? `See all ${myClubs.length} clubs` : 'Explore clubs'}
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-white px-4 py-3">
        <h2 className="text-[17px] font-semibold text-ink">Upcoming activities</h2>
        <ul className="mt-2">
          {upcoming.isLoading ? (
            <>
              <RowSkeleton />
              <RowSkeleton />
            </>
          ) : null}
          {upcoming.data?.map((activity) => (
            <li key={activity.id}>
              <Link
                {...clubLink(activity.club)}
                title={`${activity.title} · ${activity.club.name}`}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-md text-white',
                    CLUB_BG[activity.club.color],
                  )}
                >
                  <CalendarDays className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{activity.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {activity.my_response === 'going'
                      ? `You’re going · ${activity.going_count} going`
                      : activity.my_response === 'not_going'
                        ? 'You can’t go'
                        : `${activity.going_count} going · Respond`}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{shortDate(activity.starts_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {upcoming.isSuccess && upcoming.data.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No upcoming activities. Add one from any of your clubs.</p>
        ) : null}
        {upcoming.isError ? <p className="text-[13px] text-muted-foreground">Couldn’t load activities.</p> : null}
        {upcoming.isSuccess ? (
          <Link
            to="/activities"
            className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-ink/70 hover:text-ink"
          >
            See all activities
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-white">
        <div
          className="relative h-20"
          style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2a6bd6 55%, #5aaee8 100%)' }}
        />
        <div className="relative -mt-8 flex flex-col items-center px-4 pb-4 text-center">
          <span className="grid size-16 place-items-center rounded-full border-4 border-white bg-white">
            <img src="/denuwe-mark.png" alt="" className="size-10" />
          </span>
          <p className="mt-2 text-[13px] font-semibold text-ink">Bring your people together.</p>
          <p className="mt-1 text-xs text-muted-foreground">Build something great with your own community.</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-3 h-8 rounded-full border border-brand-blue px-5 text-[13px] font-semibold text-brand-blue transition hover:bg-brand-blue/5"
          >
            Start a club
          </button>
        </div>
      </section>

      <footer className="on-backdrop flex flex-wrap justify-center gap-x-3 gap-y-1 px-4 py-2 text-xs text-muted-foreground">
        <span>About</span>
        <span>Accessibility</span>
        <span>Help Center</span>
        <span>Privacy &amp; Terms</span>
        <span>Community Guidelines</span>
        <span className="flex items-center gap-1 text-ink/80">
          <img src="/denuwe-mark.png" alt="" className="size-3.5" />
          <span className="font-brand font-semibold text-brand-navy">denuwe</span> © {new Date().getFullYear()}
        </span>
      </footer>

      {creating ? <CreateClubDialog onClose={() => setCreating(false)} /> : null}
    </aside>
  )
}
