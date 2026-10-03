import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import {
  CalendarCheck,
  CalendarDays,
  CalendarHeart,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Clock,
  Lock,
  MapPin,
  MessageCircleQuestionMark,
  Pencil,
  Plus,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ActivityBoard, BoardActivity, ClubActivity, ClubSummary, PersonalActivity } from '@/types/club'
import type { ActivityStage } from '@/components/activities/activityStages'
import {
  ACTIVITY_STAGES,
  activityKey,
  dayKey,
  isOnCalendar,
  stageActivities,
} from '@/components/activities/activityStages'
import { PersonalActivityDialog } from '@/components/activities/PersonalActivityDialog'
import { Attendance } from '@/components/clubs/ClubActivities'
import { ACTIVITY_BOARD_KEY, CLUB_BG, ClubIcon, clubLink, plural, refreshClubs } from '@/components/clubs/clubUi'
import { CreateActivityDialog, toDateInput } from '@/components/clubs/CreateActivityDialog'
import { Avatar } from '@/components/feed/Avatar'
import { FeedNavbar } from '@/components/feed/FeedNavbar'
import { MessagingDock } from '@/components/feed/MessagingDock'
import { Toaster, toast } from '@/components/feed/Toaster'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { clubService } from '@/services/clubService'

const STAGE_INFO: Record<ActivityStage, { label: string; hint: string; icon: LucideIcon }> = {
  planned: { label: 'Planned', hint: 'Coming up for you', icon: CalendarDays },
  reply: { label: 'Your reply', hint: 'Going or can’t go?', icon: MessageCircleQuestionMark },
  going: { label: 'Going', hint: 'On your calendar', icon: CalendarCheck },
  done: { label: 'Done', hint: 'Already happened', icon: CircleCheckBig },
}

const DAY_MS = 24 * 60 * 60 * 1000

function dayLabel(key: string): string {
  const now = new Date()
  const today = toDateInput(now)
  if (key === today) return 'Today'
  if (key === toDateInput(new Date(now.getTime() + DAY_MS))) return 'Tomorrow'
  if (key === toDateInput(new Date(now.getTime() - DAY_MS))) return 'Yesterday'
  const date = new Date(`${key}T00:00`)
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

function groupByDay(activities: Array<BoardActivity>): Array<{ key: string; items: Array<BoardActivity> }> {
  const groups: Array<{ key: string; items: Array<BoardActivity> }> = []
  for (const activity of activities) {
    const key = dayKey(activity.starts_at)
    const last = groups.at(-1)
    if (last?.key === key) last.items.push(activity)
    else groups.push({ key, items: [activity] })
  }
  return groups
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** "in 45 min" / "in 3 h" for the next day; nothing further out. */
function startsIn(iso: string): string | null {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  if (minutes <= 0 || minutes >= 24 * 60) return null
  return minutes < 60 ? `in ${minutes} min` : `in ${Math.round(minutes / 60)} h`
}

function StatusPill({ activity, done }: { activity: ClubActivity; done: boolean }) {
  const [label, className] = done
    ? ['Done', 'bg-muted text-ink/60']
    : activity.has_started
      ? ['Happening now', 'bg-emerald-500/10 text-emerald-700']
      : activity.my_response === 'going'
        ? ['You’re going', 'bg-emerald-500/10 text-emerald-700']
        : activity.my_response === 'not_going'
          ? ['Can’t go', 'bg-muted text-ink/60']
          : ['Needs your reply', 'bg-amber-400/15 text-amber-700']

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        className,
      )}
    >
      {!done && activity.has_started ? (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
      ) : null}
      {label}
    </span>
  )
}

function ClubActivityCard({ activity, done }: { activity: ClubActivity; done: boolean }) {
  const qc = useQueryClient()
  const soon = done ? null : startsIn(activity.starts_at)

  const remove = useMutation({
    mutationFn: () => clubService.removeActivity(activity.id),
    onSuccess: () => {
      refreshClubs(qc)
      toast('Activity deleted.')
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-white px-4 py-3.5 transition',
        done && 'bg-white/70',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', CLUB_BG[activity.club.color])} />
      <div className="flex items-center gap-2">
        <Link
          {...clubLink(activity.club)}
          className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink/70 hover:text-brand-blue hover:underline"
        >
          <ClubIcon
            color={activity.club.color}
            type={activity.club.type}
            src={activity.club.avatar_url}
            className="size-5 rounded"
            iconClassName="size-3"
          />
          <span className="truncate">{activity.club.name}</span>
        </Link>
        <span className="ml-auto flex items-center gap-1">
          <StatusPill activity={activity} done={done} />
          {activity.can_delete ? (
            <button
              type="button"
              aria-label="Delete activity"
              disabled={remove.isPending}
              onClick={() => {
                const warning = activity.going_count
                  ? ` ${plural(activity.going_count, 'member')} said they’re going.`
                  : ''
                if (window.confirm(`Delete “${activity.title}”?${warning}`)) remove.mutate()
              }}
              className="grid size-7 place-items-center rounded-full text-ink/40 transition hover:bg-muted hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </span>
      </div>

      <h3 className={cn('mt-1.5 text-[16px] font-semibold text-ink', done && 'text-ink/70')}>{activity.title}</h3>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" /> {timeOf(activity.starts_at)}
          {soon ? <span className="font-semibold text-brand-blue">· {soon}</span> : null}
        </span>
        {activity.location ? (
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" /> {activity.location}
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <Avatar name={activity.created_by.name} src={activity.created_by.avatar_url} className="size-4 text-[7px]" />
          by {activity.created_by.name}
        </span>
      </p>
      {activity.description ? (
        <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed whitespace-pre-line text-ink/80">
          {activity.description}
        </p>
      ) : null}
      <Attendance activity={activity} isMember />
    </article>
  )
}

function personalWhen(activity: PersonalActivity): string {
  if (activity.all_day) return 'All day'
  const start = timeOf(activity.starts_at)
  return activity.ends_at ? `${start} – ${timeOf(activity.ends_at)}` : start
}

/** "meet.google.com" from a meeting link, or nothing if it doesn't parse. */
function meetingHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function isHappening(activity: PersonalActivity): boolean {
  return activity.has_started && activity.ends_at !== null && new Date(activity.ends_at).getTime() > Date.now()
}

function PersonalActivityCard({
  activity,
  done,
  onEdit,
}: {
  activity: PersonalActivity
  done: boolean
  onEdit: () => void
}) {
  const qc = useQueryClient()
  const soon = done || activity.all_day ? null : startsIn(activity.starts_at)
  const happening = !done && isHappening(activity)

  const remove = useMutation({
    mutationFn: () => clubService.removePersonalActivity(activity.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ACTIVITY_BOARD_KEY })
      toast('Activity deleted.')
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })

  const iconButton =
    'grid size-7 place-items-center rounded-full text-ink/40 transition hover:bg-muted disabled:opacity-50'

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-white px-4 py-3.5 transition',
        done && 'bg-white/70',
      )}
    >
      <span
        className={cn('absolute inset-y-0 left-0 w-1', activity.club ? CLUB_BG[activity.club.color] : 'bg-violet-500')}
      />
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink/70">
          {activity.club ? (
            <Link
              {...clubLink(activity.club)}
              className="flex min-w-0 items-center gap-2 hover:text-brand-blue hover:underline"
            >
              <ClubIcon
                color={activity.club.color}
                type={activity.club.type}
                src={activity.club.avatar_url}
                className="size-5 rounded"
                iconClassName="size-3"
              />
              <span className="truncate">{activity.club.name}</span>
            </Link>
          ) : (
            <>
              <span className="grid size-5 place-items-center rounded bg-violet-500 text-white">
                <CalendarHeart className="size-3" />
              </span>
              Personal
            </>
          )}
          <span className="flex shrink-0 items-center gap-0.5 font-normal text-muted-foreground">
            · <Lock className="size-3" /> Only you
          </span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {done ? (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-ink/60">Done</span>
          ) : happening ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              Happening now
            </span>
          ) : (
            <span
              title="It’s on your own schedule, so you’re going without replying."
              className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"
            >
              You’re going
            </span>
          )}
          <button
            type="button"
            aria-label="Edit activity"
            onClick={onEdit}
            className={cn(iconButton, 'hover:text-brand-blue')}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete activity"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(`Delete “${activity.title}”?`)) remove.mutate()
            }}
            className={cn(iconButton, 'hover:text-danger')}
          >
            <Trash2 className="size-3.5" />
          </button>
        </span>
      </div>

      <h3 className={cn('mt-1.5 text-[16px] font-semibold text-ink', done && 'text-ink/70')}>{activity.title}</h3>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" /> {personalWhen(activity)}
          {soon ? <span className="font-semibold text-brand-blue">· {soon}</span> : null}
        </span>
        {activity.is_meeting ? (
          <span className="flex items-center gap-1">
            <Video className="size-3.5" /> Meeting
          </span>
        ) : null}
        {activity.location ? (
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" /> {activity.location}
          </span>
        ) : null}
      </p>
      {activity.description ? (
        <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed whitespace-pre-line text-ink/80">
          {activity.description}
        </p>
      ) : null}
      {activity.meeting_url && !done ? (
        <a
          href={activity.meeting_url}
          target="_blank"
          rel="noopener noreferrer"
          title={activity.meeting_url}
          className="mt-2.5 inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[12px] font-semibold text-white transition hover:bg-brand-blue/90"
        >
          <Video className="size-3.5 shrink-0" />
          Join meeting
          <span className="truncate font-normal text-white/75">{meetingHost(activity.meeting_url)}</span>
        </a>
      ) : null}
    </article>
  )
}

function Timeline({
  activities,
  done,
  onEdit,
}: {
  activities: Array<BoardActivity>
  done: boolean
  onEdit: (activity: PersonalActivity) => void
}) {
  const today = toDateInput(new Date())

  return (
    <div className="space-y-5">
      {groupByDay(activities).map(({ key, items }) => {
        const isToday = key === today
        return (
          <section key={key} className="relative pl-7">
            <span className="absolute top-3 bottom-[-20px] left-[7px] w-px bg-border" />
            <span
              className={cn(
                'absolute top-1 left-0 size-[15px] rounded-full border-[3px] border-background',
                isToday ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : done ? 'bg-ink/25' : 'bg-brand-blue',
              )}
            />
            <h2 className="flex items-baseline gap-2 text-[14px] font-semibold text-ink">
              {dayLabel(key)}
              <span className="text-xs font-normal text-muted-foreground">
                {isToday
                  ? `${new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · `
                  : ''}
                {plural(items.length, 'activity', 'activities')}
              </span>
            </h2>
            <div className="mt-2 space-y-2">
              {items.map((activity) =>
                activity.kind === 'personal' ? (
                  <PersonalActivityCard
                    key={activityKey(activity)}
                    activity={activity}
                    done={done}
                    onEdit={() => onEdit(activity)}
                  />
                ) : (
                  <ClubActivityCard key={activityKey(activity)} activity={activity} done={done} />
                ),
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function FlowStepper({
  stage,
  counts,
  onSelect,
}: {
  stage: ActivityStage | null
  counts: Record<ActivityStage, number>
  onSelect: (stage: ActivityStage) => void
}) {
  return (
    <ol role="tablist" aria-label="Activity flow" className="grid grid-cols-2 border-t border-border md:grid-cols-4">
      {ACTIVITY_STAGES.map((value, i) => {
        const { label, hint, icon: Icon } = STAGE_INFO[value]
        const active = stage === value
        const attention = value === 'reply' && counts.reply > 0
        return (
          <li key={value} className="relative">
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(value)}
              className={cn(
                'group flex h-full w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-muted/60',
                i % 2 === 1 && 'border-l border-border md:border-l-0',
                i >= 2 && 'border-t border-border md:border-t-0',
              )}
            >
              <span
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-full transition',
                  active
                    ? 'brand-gradient text-white shadow-md shadow-brand-blue/25'
                    : attention
                      ? 'bg-amber-400/15 text-amber-600'
                      : 'bg-muted text-ink/55 group-hover:text-ink',
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Step {i + 1}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={cn('text-[14px] font-semibold', active ? 'text-ink' : 'text-ink/80')}>{label}</span>
                  <span
                    className={cn(
                      'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold',
                      attention ? 'bg-amber-500 text-white' : 'bg-muted text-ink/60',
                    )}
                  >
                    {counts[value]}
                  </span>
                </span>
                <span className="hidden truncate text-xs text-muted-foreground sm:block">{hint}</span>
              </span>
            </button>
            {i < ACTIVITY_STAGES.length - 1 ? (
              <ChevronRight className="pointer-events-none absolute top-1/2 -right-2.5 z-10 hidden size-5 -translate-y-1/2 rounded-full border border-border bg-white p-0.5 text-ink/40 md:block" />
            ) : null}
            {active ? <span className="brand-gradient absolute inset-x-4 bottom-0 h-[3px] rounded-t-full" /> : null}
          </li>
        )
      })}
    </ol>
  )
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function MiniCalendar({
  activities,
  selected,
  onSelect,
}: {
  activities: Array<BoardActivity>
  selected: string | null
  onSelect: (day: string | null) => void
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const today = toDateInput(new Date())

  const byDay = useMemo(() => {
    const map = new Map<string, { count: number; planned: boolean; going: boolean; personal: boolean }>()
    for (const a of activities) {
      const key = dayKey(a.starts_at)
      const entry = map.get(key) ?? { count: 0, planned: false, going: false, personal: false }
      map.set(key, {
        count: entry.count + 1,
        planned: entry.planned || (a.kind === 'club' && !isOnCalendar(a)),
        going: entry.going || (a.kind === 'club' && isOnCalendar(a)),
        personal: entry.personal || a.kind === 'personal',
      })
    }
    return map
  }, [activities])

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: Array<Date | null> = [
    ...Array.from({ length: month.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ]
  const shift = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1))

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h2>
        <span className="flex">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shift(-1)}
            className="grid size-7 place-items-center rounded-full text-ink/60 hover:bg-muted hover:text-ink"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shift(1)}
            className="grid size-7 place-items-center rounded-full text-ink/60 hover:bg-muted hover:text-ink"
          >
            <ChevronRight className="size-4" />
          </button>
        </span>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[10px] font-semibold text-muted-foreground">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {cells.map((date, i) => {
          if (!date) return <span key={`blank-${i}`} />
          const key = toDateInput(date)
          const info = byDay.get(key)
          const isSelected = key === selected
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              title={info ? plural(info.count, 'activity', 'activities') : undefined}
              onClick={() => onSelect(isSelected ? null : key)}
              className={cn(
                'relative mx-auto grid size-8 place-items-center rounded-full text-[12px] transition',
                isSelected
                  ? 'bg-brand-blue font-semibold text-white'
                  : info
                    ? 'font-semibold text-ink hover:bg-brand-blue/10'
                    : 'text-ink/40 hover:bg-muted hover:text-ink',
                key === today && !isSelected && 'ring-1 ring-brand-blue',
              )}
            >
              {date.getDate()}
              {info ? (
                <span className="absolute bottom-1 flex gap-0.5">
                  {[
                    info.planned && 'bg-brand-blue',
                    info.going && 'bg-emerald-500',
                    info.personal && 'bg-violet-500',
                  ].map((color) =>
                    color ? (
                      <span key={color} className={cn('size-1 rounded-full', isSelected ? 'bg-white' : color)} />
                    ) : null,
                  )}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-brand-blue" /> Planned
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-emerald-500" /> You’re going
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-violet-500" /> Personal
        </span>
      </p>
    </section>
  )
}

/** Personal (your own schedule) is always first; then the clubs where you can plan activities for everyone. */
function PlanCard({
  clubs,
  onPlan,
  onPersonal,
}: {
  clubs: Array<ClubSummary>
  onPlan: (club: ClubSummary) => void
  onPersonal: () => void
}) {
  const [clubId, setClubId] = useState<number | null>(null)
  const club = clubs.find((c) => c.id === clubId)

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3">
      <h2 className="text-[15px] font-semibold text-ink">Plan an activity</h2>
      <label className="mt-2 block">
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">For</span>
        <span className="relative mt-1 flex items-center">
          <span className="pointer-events-none absolute left-2">
            {club ? (
              <ClubIcon
                color={club.color}
                type={club.type}
                src={club.avatar_url}
                className="size-5 rounded"
                iconClassName="size-3"
              />
            ) : (
              <span className="grid size-5 place-items-center rounded bg-violet-500 text-white">
                <CalendarHeart className="size-3" />
              </span>
            )}
          </span>
          <select
            value={club?.id ?? ''}
            onChange={(e) => setClubId(e.target.value ? Number(e.target.value) : null)}
            className="h-9 w-full rounded-lg border border-[#c4c9d4] bg-white pr-2.5 pl-9 text-[13px] text-ink focus:border-brand-blue focus:outline-none"
          >
            <option value="">Personal</option>
            {clubs.length > 0 ? (
              <optgroup label="Clubs you organize for">
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </span>
      </label>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {club
          ? 'Set a time and place. Members get asked if they’re going.'
          : 'Your own plans, meetings and things you need to attend. Only you see them, and you’re going without having to reply.'}
      </p>
      {club ? (
        <button
          type="button"
          onClick={() => onPlan(club)}
          className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-brand-blue text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
        >
          <CalendarPlus className="size-4" /> Plan activity
        </button>
      ) : (
        <button
          type="button"
          onClick={onPersonal}
          className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-brand-blue text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
        >
          <Plus className="size-4" /> Add to my schedule
        </button>
      )}
    </section>
  )
}

function EmptyStage({
  stage,
  board,
  onPlan,
  onAddPersonal,
  onSelect,
}: {
  stage: ActivityStage
  board: ActivityBoard
  onPlan: () => void
  onAddPersonal: () => void
  onSelect: (stage: ActivityStage) => void
}) {
  const canPlan = board.organize_clubs.length > 0
  const noClubs = board.clubs_count === 0
  const button = 'h-9 rounded-full px-5 text-[13px] font-semibold transition'
  const primary = cn(button, 'bg-brand-blue text-white hover:bg-brand-blue/90')
  const secondary = cn(button, 'border border-brand-blue text-brand-blue hover:bg-brand-blue/5')

  const addPersonal = (className: string) => (
    <button key="personal" type="button" onClick={onAddPersonal} className={className}>
      Add personal activity
    </button>
  )
  const exploreClubs = (className: string) => (
    <Link key="explore" to="/clubs" className={cn(className, 'inline-grid place-items-center')}>
      Explore clubs
    </Link>
  )

  const [title, body, actions]: [string, string, Array<ReactNode>] =
    stage === 'reply'
      ? noClubs
        ? [
            'Join a club to see its activities',
            'Clubs ask you here whether you’re going to their activities.',
            [exploreClubs(primary)],
          ]
        : ['You’re all caught up', 'You’ve answered every upcoming activity.', []]
      : stage === 'going'
        ? [
            'Nothing on your calendar yet',
            noClubs
              ? 'Add something to your own schedule and it shows up here.'
              : 'Add something to your own schedule, or say you’re going to a club activity.',
            [
              addPersonal(primary),
              noClubs ? null : (
                <button key="planned" type="button" onClick={() => onSelect('planned')} className={secondary}>
                  See what’s planned
                </button>
              ),
            ],
          ]
        : stage === 'done'
          ? ['No past activities yet', 'Activities move here once their day has passed.', []]
          : [
              'Nothing planned yet',
              noClubs
                ? 'Add something to your own schedule, or join a club to see its activities.'
                : canPlan
                  ? 'Add something to your own schedule, or get people together with a club activity.'
                  : 'Add something to your own schedule. New activities from your clubs show up here too.',
              [
                addPersonal(primary),
                canPlan ? (
                  <button key="plan" type="button" onClick={onPlan} className={secondary}>
                    Plan a club activity
                  </button>
                ) : noClubs ? (
                  exploreClubs(secondary)
                ) : null,
              ],
            ]

  const Icon = STAGE_INFO[stage].icon
  return (
    <div className="rounded-xl border border-border bg-white px-6 py-10 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-blue/10 text-brand-blue">
        <Icon className="size-6" />
      </span>
      <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{body}</p>
      {actions.some(Boolean) ? <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  )
}

type PersonalDialog = { activity?: PersonalActivity; date?: string }

export default function ActivitiesPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const search = useSearch({ from: '/activities' })
  const [day, setDay] = useState<string | null>(null)
  const [planning, setPlanning] = useState<ClubSummary | null>(null)
  const [personal, setPersonal] = useState<PersonalDialog | null>(null)

  const board = useQuery({ queryKey: ACTIVITY_BOARD_KEY, queryFn: () => clubService.activityBoard() })
  const stages = useMemo(() => (board.data ? stageActivities(board.data) : null), [board.data])

  if (!user) return null

  const stage = search.stage ?? 'planned'
  const selectStage = (next: ActivityStage) => {
    setDay(null)
    void navigate({ to: '/activities', search: next === 'planned' ? {} : { stage: next }, replace: true })
  }
  const counts = {
    planned: stages?.planned.length ?? 0,
    reply: stages?.reply.length ?? 0,
    going: stages?.going.length ?? 0,
    done: stages?.done.length ?? 0,
  }
  const everything = stages ? [...stages.planned, ...stages.done] : []
  const dayList = day
    ? everything.filter((a) => dayKey(a.starts_at) === day).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    : []
  const firstClub = board.data?.organize_clubs[0]
  const openPlanner = () => {
    if (firstClub) setPlanning(firstClub)
  }
  const addPersonal = () => setPersonal(day ? { date: day } : {})
  const editPersonal = (activity: PersonalActivity) => setPersonal({ activity })

  return (
    <div className="min-h-dvh bg-background">
      <FeedNavbar user={user} active="activities" />

      <div className="mx-auto max-w-[1128px] space-y-5 px-4 pt-6 pb-16">
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="brand-gradient relative px-6 py-7 text-white">
            <div className="vibe-gradient absolute inset-0 opacity-40" />
            <div className="relative flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">Activities</h1>
                <p className="mt-1 text-[14px] text-white/85">
                  Your clubs’ activities and your own schedule, from the plan to the day itself.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addPersonal}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-4 text-[13px] font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/25"
                >
                  <Plus className="size-4" /> Add to my schedule
                </button>
                {firstClub ? (
                  <button
                    type="button"
                    onClick={openPlanner}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-ink transition hover:bg-white/90"
                  >
                    <CalendarPlus className="size-4" /> Plan activity
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <FlowStepper stage={day ? null : stage} counts={counts} onSelect={selectStage} />
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <main className="min-w-0">
            {board.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="h-36 animate-pulse rounded-xl border border-border bg-white" />
                ))}
              </div>
            ) : null}

            {board.isError ? (
              <div className="rounded-xl border border-border bg-white px-6 py-10 text-center">
                <p className="text-[15px] font-semibold text-ink">Couldn’t load activities</p>
                <button
                  type="button"
                  onClick={() => void board.refetch()}
                  className="mt-3 h-8 rounded-full border border-brand-blue px-4 text-[13px] font-semibold text-brand-blue hover:bg-brand-blue/5"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {board.data && stages ? (
              day ? (
                <>
                  <div className="mb-3 flex items-center gap-2 rounded-xl border border-brand-blue/30 bg-brand-blue/5 px-4 py-2 text-[13px] text-ink">
                    <CalendarDays className="size-4 text-brand-blue" />
                    Showing <span className="font-semibold">{dayLabel(day)}</span>
                    <span className="ml-auto flex items-center gap-3">
                      <button
                        type="button"
                        onClick={addPersonal}
                        className="flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
                      >
                        <Plus className="size-3.5" /> Add to this day
                      </button>
                      <button
                        type="button"
                        onClick={() => setDay(null)}
                        className="flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
                      >
                        <X className="size-3.5" /> Clear
                      </button>
                    </span>
                  </div>
                  {dayList.length > 0 ? (
                    <Timeline activities={dayList} done={day < toDateInput(new Date())} onEdit={editPersonal} />
                  ) : (
                    <div className="rounded-xl border border-border bg-white px-6 py-10 text-center">
                      <span className="mx-auto grid size-12 place-items-center rounded-full bg-violet-500/10 text-violet-600">
                        <CalendarHeart className="size-6" />
                      </span>
                      <p className="mt-3 text-[15px] font-semibold text-ink">Nothing on this day</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">Free day. Want to plan something?</p>
                      <button
                        type="button"
                        onClick={addPersonal}
                        className="mt-4 h-9 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
                      >
                        Add personal activity
                      </button>
                    </div>
                  )}
                </>
              ) : stages[stage].length > 0 ? (
                <Timeline activities={stages[stage]} done={stage === 'done'} onEdit={editPersonal} />
              ) : (
                <EmptyStage
                  stage={stage}
                  board={board.data}
                  onPlan={openPlanner}
                  onAddPersonal={addPersonal}
                  onSelect={selectStage}
                />
              )
            ) : null}
          </main>

          <aside className="space-y-3 lg:sticky lg:top-[72px]">
            {board.data ? (
              <>
                <PlanCard clubs={board.data.organize_clubs} onPlan={setPlanning} onPersonal={addPersonal} />
                <MiniCalendar activities={everything} selected={day} onSelect={setDay} />
              </>
            ) : null}
          </aside>
        </div>
      </div>

      <MessagingDock user={user} />
      {planning ? <CreateActivityDialog club={planning} onClose={() => setPlanning(null)} /> : null}
      {personal ? (
        <PersonalActivityDialog
          activity={personal.activity}
          initialDate={personal.date}
          clubs={board.data?.my_clubs ?? []}
          onClose={() => setPersonal(null)}
        />
      ) : null}
      <Toaster />
    </div>
  )
}
