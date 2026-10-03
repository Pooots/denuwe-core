import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CalendarPlus, Check, Clock, Eye, LoaderCircle, MapPin, Trash2, Users, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AttendeeTab } from '@/components/clubs/AttendeesDialog'
import type { ActivityBoard, ActivityResponse, BoardActivity, ClubActivity, ClubDetail, ClubMember } from '@/types/club'
import type { FeedAuthor } from '@/types/feed'
import { AttendeesDialog } from '@/components/clubs/AttendeesDialog'
import {
  ACTIVITY_BOARD_KEY,
  CLUB_BG,
  CLUB_TYPE_LABEL,
  UPCOMING_KEY,
  activityWhen,
  plural,
  refreshClubs,
  updateClubDetail,
} from '@/components/clubs/clubUi'
import { CreateActivityDialog } from '@/components/clubs/CreateActivityDialog'
import { Avatar } from '@/components/feed/Avatar'
import { toast } from '@/components/feed/Toaster'
import { cn } from '@/lib/utils'
import { apiErrorMessage, authService } from '@/services/authService'
import { clubService } from '@/services/clubService'

const PREVIEW_PEOPLE = 12

function PersonChip({ person, viewerId }: { person: FeedAuthor; viewerId: number | undefined }) {
  const isMe = person.id === viewerId
  const content = (
    <>
      <Avatar name={person.name} src={person.avatar_url} className="size-6 text-[9px]" />
      <span className="max-w-[160px] truncate">{isMe ? 'You' : person.name}</span>
    </>
  )
  const className =
    'inline-flex items-center gap-1.5 rounded-full border border-border bg-white py-0.5 pr-2.5 pl-0.5 text-[12px] font-medium text-ink transition hover:border-brand-blue/40 hover:bg-brand-blue/5'

  return isMe ? (
    <Link to="/profile" className={className}>
      {content}
    </Link>
  ) : (
    <Link to="/people/$userId" params={{ userId: String(person.id) }} className={className}>
      {content}
    </Link>
  )
}

function PeopleList({
  label,
  people,
  viewerId,
  onMore,
}: {
  label: string
  people: Array<FeedAuthor>
  viewerId?: number
  onMore: () => void
}) {
  const visible = people.slice(0, PREVIEW_PEOPLE)

  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {visible.map((person) => (
          <PersonChip key={person.id} person={person} viewerId={viewerId} />
        ))}
        {people.length > visible.length ? (
          <button
            type="button"
            onClick={onMore}
            className="rounded-full px-2 text-[12px] font-semibold text-brand-blue hover:underline"
          >
            +{people.length - visible.length} more
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function Attendance({
  activity,
  isMember,
  membersCount,
  members,
}: {
  activity: ClubActivity
  isMember: boolean
  membersCount?: number
  /** The club's members, so the attendee list can also show who hasn't replied. */
  members?: Array<ClubMember>
}) {
  const qc = useQueryClient()
  const [viewing, setViewing] = useState<AttendeeTab | null>(null)
  const viewerId = authService.getUser()?.id
  const clubId = activity.club.id

  const respond = useMutation({
    mutationFn: (status: ActivityResponse) => clubService.respondToActivity(activity.id, status),
    onSuccess: ({ message, activity: next }) => {
      const isNext = (a: BoardActivity) => a.kind === 'club' && a.id === next.id
      updateClubDetail(qc, clubId, (detail) => ({
        ...detail,
        activities: detail.activities.map((a) => (isNext(a) ? next : a)),
      }))
      qc.setQueryData<ActivityBoard>(ACTIVITY_BOARD_KEY, (board) =>
        board
          ? {
              ...board,
              upcoming: board.upcoming.map((a) => (isNext(a) ? next : a)),
              past: board.past.map((a) => (isNext(a) ? next : a)),
            }
          : board,
      )
      void qc.invalidateQueries({ queryKey: UPCOMING_KEY })
      toast(message)
    },
    onError: (err) => {
      toast(apiErrorMessage(err), 'error')
      refreshClubs(qc)
    },
  })

  const noReply =
    membersCount === undefined || activity.has_started
      ? null
      : Math.max(membersCount - activity.going_count - activity.not_going_count, 0)
  const summary = [
    `${activity.going_count} going`,
    activity.not_going_count ? `${activity.not_going_count} can’t go` : null,
    noReply ? `${noReply} no reply` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const choice = (status: ActivityResponse, label: string, icon: ReactNode) => {
    const selected = activity.my_response === status
    const pending = respond.isPending && respond.variables === status
    return (
      <button
        type="button"
        aria-pressed={selected}
        disabled={respond.isPending || selected}
        onClick={() => respond.mutate(status)}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition disabled:cursor-default',
          selected
            ? status === 'going'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-ink/70 bg-ink/80 text-white'
            : 'border-border bg-white text-ink/80 hover:border-brand-blue/50 hover:text-brand-blue disabled:opacity-60',
        )}
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : icon}
        {label}
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {activity.going.length > 0 ? (
            <span className="flex -space-x-1.5">
              {activity.going.slice(0, 4).map((p) => (
                <Avatar key={p.id} name={p.name} src={p.avatar_url} className="size-6 text-[9px] ring-2 ring-white" />
              ))}
            </span>
          ) : (
            <Users className="size-4" />
          )}
          {summary}
          <button
            type="button"
            onClick={() => setViewing('going')}
            className="inline-flex h-6 items-center gap-1 rounded-full border border-brand-blue/30 bg-white px-2.5 text-[11px] font-semibold text-brand-blue transition hover:border-brand-blue hover:bg-brand-blue/5"
          >
            <Eye className="size-3.5" /> View
          </button>
        </span>

        <span className="ml-auto flex items-center gap-2">
          {activity.has_started ? (
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">
              {activity.my_response === 'going' ? 'You went · responses closed' : 'Responses closed'}
            </span>
          ) : isMember ? (
            <>
              {activity.my_response === null ? (
                <span className="hidden text-xs font-medium text-ink/70 sm:inline">Are you going?</span>
              ) : null}
              {choice('going', 'Going', <Check className="size-4" />)}
              {choice('not_going', 'Can’t go', <X className="size-4" />)}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Join the {CLUB_TYPE_LABEL[activity.club.type].toLowerCase()} to respond
            </span>
          )}
        </span>
      </div>

      {activity.going.length > 0 ? (
        <div className="mt-3 border-t border-border pt-2.5">
          <PeopleList
            label={`Going · ${activity.going_count}`}
            people={activity.going}
            viewerId={viewerId}
            onMore={() => setViewing('going')}
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {activity.has_started ? 'Nobody signed up for this one.' : 'No one has said they’re going yet.'}
        </p>
      )}

      {activity.not_going.length > 0 ? (
        <button
          type="button"
          onClick={() => setViewing('not_going')}
          className="mt-2 text-xs font-semibold text-ink/60 hover:text-brand-blue hover:underline"
        >
          See who can’t go ({plural(activity.not_going_count, 'member')})
        </button>
      ) : null}

      {viewing ? (
        <AttendeesDialog activity={activity} members={members} initialTab={viewing} onClose={() => setViewing(null)} />
      ) : null}
    </div>
  )
}

function ActivityRow({
  activity,
  isMember,
  membersCount,
  members,
}: {
  activity: ClubActivity
  isMember: boolean
  membersCount?: number
  members?: Array<ClubMember>
}) {
  const qc = useQueryClient()
  const date = new Date(activity.starts_at)

  const remove = useMutation({
    mutationFn: () => clubService.removeActivity(activity.id),
    onSuccess: () => {
      refreshClubs(qc)
      toast('Activity deleted.')
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })

  return (
    <li className="flex gap-4 py-3">
      <div
        className={cn(
          'flex size-14 shrink-0 flex-col items-center justify-center rounded-xl text-white',
          CLUB_BG[activity.club.color],
        )}
      >
        <span className="text-[10px] font-semibold tracking-wide uppercase">
          {date.toLocaleDateString(undefined, { month: 'short' })}
        </span>
        <span className="text-xl leading-none font-semibold">{date.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">{activity.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" /> {activityWhen(activity.starts_at)}
          </span>
          {activity.location ? (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" /> {activity.location}
            </span>
          ) : null}
        </p>
        {activity.description ? (
          <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-line text-ink/80">{activity.description}</p>
        ) : null}
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Avatar name={activity.created_by.name} src={activity.created_by.avatar_url} className="size-5 text-[8px]" />
          Added by {activity.created_by.name}
        </p>
        <Attendance activity={activity} isMember={isMember} membersCount={membersCount} members={members} />
      </div>
      {activity.can_delete ? (
        <button
          type="button"
          aria-label="Delete activity"
          disabled={remove.isPending}
          onClick={() => {
            const warning = activity.going_count ? ` ${plural(activity.going_count, 'member')} said they’re going.` : ''
            if (window.confirm(`Delete “${activity.title}”?${warning}`)) remove.mutate()
          }}
          className="grid size-8 shrink-0 place-items-center rounded-full text-ink/50 transition hover:bg-muted hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </li>
  )
}

/** Who can add things, phrased for people who can't. */
export function organizerNote(detail: ClubDetail, what: string): string {
  const typeLabel = CLUB_TYPE_LABEL[detail.club.type].toLowerCase()
  return detail.club.is_member
    ? `The owner and organizing officers post ${what} here.`
    : `Join the ${typeLabel} to take part in its ${what}.`
}

export function ClubActivities({ detail }: { detail: ClubDetail }) {
  const [adding, setAdding] = useState(false)
  const { club, activities, can_organize: canOrganize } = detail

  return (
    <section className="rounded-xl border border-border bg-white px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-ink">Upcoming activities</h2>
        {canOrganize ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
          >
            <CalendarPlus className="size-4" /> Add activity
          </button>
        ) : null}
      </div>

      {activities.length > 0 ? (
        <ul className="divide-y divide-border">
          {activities.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              isMember={club.is_member}
              membersCount={club.members_count}
              members={detail.members}
            />
          ))}
        </ul>
      ) : (
        <div className="py-6 text-center">
          <p className="text-[13px] text-muted-foreground">No upcoming activities yet.</p>
          {canOrganize ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-3 h-8 rounded-full border border-brand-blue px-4 text-[13px] font-semibold text-brand-blue transition hover:bg-brand-blue/5"
            >
              Plan the first one
            </button>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{organizerNote(detail, 'activities')}</p>
          )}
        </div>
      )}

      {adding ? <CreateActivityDialog club={club} onClose={() => setAdding(false)} /> : null}
    </section>
  )
}
