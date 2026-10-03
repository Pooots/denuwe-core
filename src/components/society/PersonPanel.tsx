import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Briefcase,
  CalendarHeart,
  ChevronDown,
  Clock,
  LoaderCircle,
  MapPin,
  MessageCircle,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { SocietyPerson } from '@/types/society'
import type { SocietyAction } from '@/components/society/societyUi'
import { Avatar } from '@/components/feed/Avatar'
import {
  RELATIONSHIP_LABEL,
  confirmSocietyAction,
  mutualLabel,
  sinceLabel,
  useSocietyAction,
} from '@/components/society/societyUi'
import { cn } from '@/lib/utils'

function QuickAction({
  icon,
  label,
  onClick,
  busy,
  tone = 'default',
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  busy?: boolean
  tone?: 'default' | 'primary'
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="flex w-16 flex-col items-center gap-1 disabled:opacity-60"
    >
      <span
        className={cn(
          'grid size-9 place-items-center rounded-full transition',
          tone === 'primary'
            ? 'bg-brand-blue text-white hover:bg-brand-blue/90'
            : 'bg-muted text-ink hover:bg-[#e3e6ee]',
        )}
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      </span>
      <span className="text-[12px] text-ink/80">{label}</span>
    </button>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[14px] font-semibold text-ink hover:bg-muted"
      >
        {title}
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open ? <div className="pb-2">{children}</div> : null}
    </section>
  )
}

function Row({
  icon,
  children,
  hint,
  onClick,
  danger,
}: {
  icon: ReactNode
  children: ReactNode
  hint?: string
  onClick?: () => void
  danger?: boolean
}) {
  const content = (
    <>
      <span className={cn('mt-0.5 shrink-0', danger ? 'text-danger' : 'text-ink/70')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[13px]', danger ? 'font-semibold text-danger' : 'text-ink')}>{children}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </>
  )
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
    >
      {content}
    </button>
  ) : (
    <div className="flex items-start gap-3 px-2 py-2">{content}</div>
  )
}

/** Right-hand profile panel for the selected person. */
export function PersonPanel({ person, onMessage }: { person: SocietyPerson; onMessage: () => void }) {
  const action = useSocietyAction(person)
  const run = (next: SocietyAction) => {
    if (confirmSocietyAction(person, next)) action.mutate(next)
  }
  const busy = (which: SocietyAction) => action.isPending && action.variables === which
  const mutual = mutualLabel(person.mutual_count)
  const first = person.name.split(' ')[0]

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-6 pb-4">
      <div className="flex flex-col items-center text-center">
        <Avatar name={person.name} src={person.avatar_url} className="size-20 text-2xl" />
        <p className="mt-3 text-[17px] font-semibold text-ink">{person.name}</p>
        <span
          className={cn(
            'mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
            person.relationship === 'friends'
              ? 'bg-emerald-500/10 text-emerald-700'
              : person.relationship === 'none'
                ? 'bg-muted text-ink/70'
                : 'bg-brand-blue/10 text-brand-blue',
          )}
        >
          {RELATIONSHIP_LABEL[person.relationship]}
        </span>
        <Link
          to="/people/$userId"
          params={{ userId: String(person.id) }}
          className="mt-2 text-[13px] font-semibold text-brand-blue hover:underline"
        >
          {person.relationship === 'friends' ? 'View profile & diary' : 'View profile'}
        </Link>

        <div className="mt-4 flex justify-center gap-2">
          {person.relationship === 'friends' ? (
            <>
              <QuickAction icon={<MessageCircle className="size-4" />} label="Message" onClick={onMessage} />
              <QuickAction
                icon={<UserMinus className="size-4" />}
                label="Unfriend"
                busy={busy('remove')}
                onClick={() => run('remove')}
              />
            </>
          ) : null}
          {person.relationship === 'incoming' ? (
            <>
              <QuickAction
                icon={<UserCheck className="size-4" />}
                label="Accept"
                tone="primary"
                busy={busy('accept')}
                onClick={() => run('accept')}
              />
              <QuickAction
                icon={<UserX className="size-4" />}
                label="Ignore"
                busy={busy('remove')}
                onClick={() => run('remove')}
              />
            </>
          ) : null}
          {person.relationship === 'outgoing' ? (
            <QuickAction
              icon={<Clock className="size-4" />}
              label="Withdraw"
              busy={busy('remove')}
              onClick={() => run('remove')}
            />
          ) : null}
          {person.relationship === 'none' ? (
            <QuickAction
              icon={<UserPlus className="size-4" />}
              label="Add friend"
              tone="primary"
              busy={busy('add')}
              onClick={() => run('add')}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-5 space-y-1">
        <Section title="About">
          {person.headline ? <Row icon={<Briefcase className="size-4" />}>{person.headline}</Row> : null}
          {person.location ? <Row icon={<MapPin className="size-4" />}>{person.location}</Row> : null}
          <Row icon={<Users className="size-4" />}>{mutual ?? 'No mutual friends yet'}</Row>
          {person.relationship === 'friends' && person.since ? (
            <Row icon={<CalendarHeart className="size-4" />}>{sinceLabel('Connected', person.since)}</Row>
          ) : null}
        </Section>

        {person.relationship !== 'none' ? (
          <Section title="Privacy & support">
            {person.relationship === 'friends' ? (
              <Row
                icon={<UserMinus className="size-4" />}
                hint={`${first} won’t be able to message you`}
                onClick={() => run('remove')}
                danger
              >
                Remove from society
              </Row>
            ) : null}
            {person.relationship === 'outgoing' ? (
              <Row
                icon={<Clock className="size-4" />}
                hint={sinceLabel('Sent', person.since)}
                onClick={() => run('remove')}
              >
                Withdraw friend request
              </Row>
            ) : null}
            {person.relationship === 'incoming' ? (
              <Row
                icon={<UserX className="size-4" />}
                hint={`${first} won’t be notified`}
                onClick={() => run('remove')}
              >
                Ignore request
              </Row>
            ) : null}
          </Section>
        ) : null}
      </div>
    </div>
  )
}
