import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, LoaderCircle, UserCheck, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Relationship, SocietyPerson } from '@/types/society'
import { toast } from '@/components/feed/Toaster'
import { POLL_MS } from '@/lib/polling'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/time'
import { apiErrorMessage } from '@/services/authService'
import { societyService } from '@/services/societyService'

export const SOCIETY_KEY = ['society'] as const
export const SOCIETY_OVERVIEW_KEY = ['society', 'overview'] as const
export const SOCIETY_PEOPLE_KEY = ['society', 'people'] as const
export const societyProfileKey = (userId: number) => ['society', 'profile', userId] as const

export function useSocietyOverview() {
  return useQuery({
    queryKey: SOCIETY_OVERVIEW_KEY,
    queryFn: () => societyService.overview(),
    staleTime: 30_000,
    refetchInterval: POLL_MS,
  })
}

export type SocietyAction = 'add' | 'accept' | 'remove'

export function useSocietyAction(person: SocietyPerson) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (action: SocietyAction) =>
      action === 'add'
        ? societyService.add(person.id)
        : action === 'accept'
          ? societyService.accept(person.id)
          : societyService.remove(person.id),
    onSuccess: (result, action) => {
      toast(result.message)
      qc.setQueriesData<Array<SocietyPerson>>({ queryKey: SOCIETY_PEOPLE_KEY }, (list) =>
        list?.map((p) => (p.id === result.user_id ? { ...p, relationship: result.relationship } : p)),
      )
      // Discover hides anyone you're connected to, so refetching after add/remove would make the
      // person vanish from the list. A new friend changes mutual counts, so refresh everything after an accept.
      void qc.invalidateQueries({ queryKey: action === 'accept' ? SOCIETY_KEY : SOCIETY_OVERVIEW_KEY })
      // Becoming or no longer being friends changes what their profile page shows.
      void qc.invalidateQueries({ queryKey: societyProfileKey(result.user_id) })
    },
    onError: (err) => {
      toast(apiErrorMessage(err), 'error')
      void qc.invalidateQueries({ queryKey: SOCIETY_KEY })
    },
  })
}

/** Runs an action, asking first when it undoes a connection. */
export function confirmSocietyAction(person: SocietyPerson, action: SocietyAction): boolean {
  if (action !== 'remove') return true
  if (person.relationship === 'friends') return window.confirm(`Remove ${person.name} from your society?`)
  if (person.relationship === 'outgoing') return window.confirm(`Withdraw your friend request to ${person.name}?`)
  return true
}

export function mutualLabel(count: number): string | null {
  if (count <= 0) return null
  return count === 1 ? '1 mutual friend' : `${count} mutual friends`
}

/** e.g. "Connected 2d ago", "Sent just now", "Connected Sep 1". */
export function sinceLabel(prefix: string, iso: string | null): string | undefined {
  if (!iso) return undefined
  const ago = timeAgo(iso)
  if (ago === 'Just now') return `${prefix} just now`
  return /^\d+[mhdw]$/.test(ago) ? `${prefix} ${ago} ago` : `${prefix} ${ago}`
}

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  friends: 'In your society',
  incoming: 'Wants to join your society',
  outgoing: 'Friend request sent',
  none: 'Not in your society',
}

/** Second line of a list row: last message for friends, otherwise where you stand. */
export function previewLine(person: SocietyPerson): { text: string; time: string | null } {
  if (person.relationship === 'friends') {
    const last = person.last_message
    if (!last) return { text: `Say hi to ${person.name.split(' ')[0]}`, time: null }
    return { text: (last.mine ? 'You: ' : '') + last.body, time: timeAgo(last.created_at) }
  }
  if (person.relationship === 'none') {
    return { text: mutualLabel(person.mutual_count) ?? person.headline ?? person.location ?? '', time: null }
  }
  return { text: RELATIONSHIP_LABEL[person.relationship], time: timeAgo(person.since) }
}

const outline = 'border border-[#c4c9d4] text-ink/70 hover:bg-muted'
const primary = 'bg-brand-blue text-white hover:bg-brand-blue/90'
const ghostBlue = 'border border-brand-blue text-brand-blue hover:bg-brand-blue/5'

function ActionButton({
  onClick,
  pending,
  tone,
  className,
  children,
  title,
}: {
  onClick: () => void
  pending: boolean
  tone: string
  className?: string
  children: ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={pending}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-5 text-[13px] font-semibold transition disabled:opacity-60',
        tone,
        className,
      )}
    >
      {children}
    </button>
  )
}

/** The right button(s) for where you stand with someone: Add friend, Pending, Accept/Ignore or Friends. */
export function RelationshipActions({ person }: { person: SocietyPerson }) {
  const action = useSocietyAction(person)
  const busy = action.isPending
  const spinner = <LoaderCircle className="size-4 animate-spin" />
  const run = (next: SocietyAction) => {
    if (confirmSocietyAction(person, next)) action.mutate(next)
  }

  if (person.relationship === 'incoming') {
    return (
      <div className="flex gap-2">
        <ActionButton pending={busy} tone={outline} onClick={() => run('remove')}>
          Ignore
        </ActionButton>
        <ActionButton pending={busy} tone={primary} onClick={() => run('accept')}>
          {busy && action.variables === 'accept' ? spinner : <UserCheck className="size-4" />}
          Accept
        </ActionButton>
      </div>
    )
  }

  if (person.relationship === 'outgoing') {
    return (
      <ActionButton
        pending={busy}
        tone={cn(outline, 'hover:border-danger hover:text-danger')}
        title="Withdraw request"
        onClick={() => run('remove')}
      >
        {busy ? spinner : <Clock className="size-4" />}
        Pending
      </ActionButton>
    )
  }

  if (person.relationship === 'friends') {
    return (
      <ActionButton
        pending={busy}
        tone={cn(outline, 'hover:border-danger hover:text-danger')}
        title="Remove from your society"
        onClick={() => run('remove')}
      >
        {busy ? spinner : <UserCheck className="size-4" />}
        Friends
      </ActionButton>
    )
  }

  return (
    <ActionButton pending={busy} tone={ghostBlue} onClick={() => run('add')}>
      {busy ? spinner : <UserPlus className="size-4" />}
      Add friend
    </ActionButton>
  )
}
