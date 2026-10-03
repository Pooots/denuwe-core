import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, CircleHelp, Search, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ClubActivity, ClubMember } from '@/types/club'
import type { FeedAuthor } from '@/types/feed'
import { activityWhen } from '@/components/clubs/clubUi'
import { Avatar } from '@/components/feed/Avatar'
import { Modal } from '@/components/feed/Modal'
import { cn } from '@/lib/utils'
import { authService } from '@/services/authService'

export type AttendeeTab = 'going' | 'not_going' | 'no_reply'

const TAB_INFO: Record<AttendeeTab, { label: string; icon: LucideIcon; badge: string; empty: string }> = {
  going: {
    label: 'Going',
    icon: Check,
    badge: 'bg-emerald-500/10 text-emerald-700',
    empty: 'No one has said they’re going yet.',
  },
  not_going: {
    label: 'Can’t go',
    icon: X,
    badge: 'bg-ink/10 text-ink/70',
    empty: 'No one has said they can’t make it.',
  },
  no_reply: {
    label: 'No reply',
    icon: CircleHelp,
    badge: 'bg-amber-400/15 text-amber-700',
    empty: 'Everyone has answered.',
  },
}

const SEARCH_FROM = 8

function PersonRow({ person, note, tab }: { person: FeedAuthor; note: string | null; tab: AttendeeTab }) {
  const isMe = person.id === authService.getUser()?.id
  const { icon: Icon, badge, label } = TAB_INFO[tab]
  const content = (
    <>
      <Avatar name={person.name} src={person.avatar_url} className="size-10 text-sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink group-hover:underline">
          {person.name}
          {isMe ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
        </span>
        {note ? <span className="block truncate text-xs text-muted-foreground">{note}</span> : null}
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
          badge,
        )}
      >
        <Icon className="size-3" /> {label}
      </span>
    </>
  )
  const className = 'group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-muted'

  return (
    <li>
      {isMe ? (
        <Link to="/profile" className={className}>
          {content}
        </Link>
      ) : (
        <Link to="/people/$userId" params={{ userId: String(person.id) }} className={className}>
          {content}
        </Link>
      )}
    </li>
  )
}

/**
 * Everyone's answer to an activity. Pass the club's members to also list who hasn't replied
 * (only while the activity is still upcoming) and show their positions.
 */
export function AttendeesDialog({
  activity,
  members,
  initialTab = 'going',
  onClose,
}: {
  activity: ClubActivity
  members?: Array<ClubMember>
  initialTab?: AttendeeTab
  onClose: () => void
}) {
  const [tab, setTab] = useState<AttendeeTab>(initialTab)
  const [search, setSearch] = useState('')

  const answered = new Set([...activity.going, ...activity.not_going].map((p) => p.id))
  const people: Record<AttendeeTab, Array<FeedAuthor> | null> = {
    going: activity.going,
    not_going: activity.not_going,
    no_reply: members && !activity.has_started ? members.filter((m) => !answered.has(m.id)) : null,
  }
  const notes = new Map(
    (members ?? []).map((m) => [m.id, m.position?.name ?? (m.role === 'owner' ? 'Owner' : null)] as const),
  )
  const tabs = (Object.keys(TAB_INFO) as Array<AttendeeTab>).filter((t) => people[t] !== null)
  const total = tabs.reduce((sum, t) => sum + (people[t]?.length ?? 0), 0)

  const query = search.trim().toLowerCase()
  const list = (people[tab] ?? []).filter((p) => !query || p.name.toLowerCase().includes(query))

  return (
    <Modal
      onClose={onClose}
      title={
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">Who’s coming</h2>
          <p className="truncate text-xs text-muted-foreground">
            {activity.title} · {activityWhen(activity.starts_at)}
          </p>
        </div>
      }
    >
      <div className="px-5">
        <div role="tablist" className="flex gap-1 rounded-full bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition',
                tab === t ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink',
              )}
            >
              {TAB_INFO[t].label}
              <span className="text-xs font-normal text-muted-foreground">{people[t]?.length ?? 0}</span>
            </button>
          ))}
        </div>

        {total > SEARCH_FROM ? (
          <label className="relative mt-3 block">
            <span className="sr-only">Search people</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name"
              className="h-9 w-full rounded-full border border-[#c4c9d4] bg-white pr-4 pl-9 text-[13px] text-ink placeholder:text-muted-foreground focus:border-brand-blue focus:outline-none"
            />
          </label>
        ) : null}
      </div>

      <ul className="mt-2 max-h-[55dvh] min-h-[160px] overflow-y-auto px-3 pb-4">
        {list.map((person) => (
          <PersonRow key={person.id} person={person} note={notes.get(person.id) ?? null} tab={tab} />
        ))}
        {list.length === 0 ? (
          <li className="px-2 py-10 text-center text-[13px] text-muted-foreground">
            {query ? `No one named “${search.trim()}” here.` : TAB_INFO[tab].empty}
          </li>
        ) : null}
      </ul>
    </Modal>
  )
}
