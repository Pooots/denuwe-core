import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, LoaderCircle, UserPlus, X } from 'lucide-react'
import type { ClubDetail, JoinRequest } from '@/types/club'
import { CLUB_TYPE_LABEL, refreshClubs } from '@/components/clubs/clubUi'
import { Avatar } from '@/components/feed/Avatar'
import { toast } from '@/components/feed/Toaster'
import { timeAgo } from '@/lib/time'
import { apiErrorMessage } from '@/services/authService'
import { clubService } from '@/services/clubService'

function RequestRow({ clubId, person }: { clubId: number; person: JoinRequest }) {
  const qc = useQueryClient()
  const answer = useMutation({
    mutationFn: (approve: boolean) =>
      approve ? clubService.approveRequest(clubId, person.id) : clubService.declineRequest(clubId, person.id),
    onSuccess: (message) => {
      refreshClubs(qc)
      toast(message)
    },
    onError: (err) => {
      refreshClubs(qc)
      toast(apiErrorMessage(err), 'error')
    },
  })

  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link to="/people/$userId" params={{ userId: String(person.id) }} className="shrink-0">
        <Avatar name={person.name} src={person.avatar_url} className="size-10 text-xs" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/people/$userId"
          params={{ userId: String(person.id) }}
          className="block truncate text-[13px] font-semibold text-ink hover:underline"
        >
          {person.name}
        </Link>
        <p className="truncate text-[11px] text-muted-foreground">Requested · {timeAgo(person.requested_at)}</p>
      </div>
      <button
        type="button"
        aria-label={`Approve ${person.name}`}
        title="Approve"
        disabled={answer.isPending}
        onClick={() => answer.mutate(true)}
        className="inline-flex h-8 items-center gap-1 rounded-full bg-brand-blue px-3 text-[12px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-60"
      >
        {answer.isPending && answer.variables ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" />
        )}
        Approve
      </button>
      <button
        type="button"
        aria-label={`Decline ${person.name}`}
        title="Decline"
        disabled={answer.isPending}
        onClick={() => answer.mutate(false)}
        className="grid size-8 place-items-center rounded-full text-ink/50 transition hover:bg-muted hover:text-danger disabled:opacity-60"
      >
        {answer.isPending && answer.variables === false ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <X className="size-4" />
        )}
      </button>
    </li>
  )
}

/** Owner-only list of people asking to join a private club. */
export function JoinRequestsCard({ detail }: { detail: ClubDetail }) {
  const { club, join_requests: requests } = detail
  if (!club.is_owner || requests.length === 0) return null

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink">
        <UserPlus className="size-4 text-brand-blue" /> Join requests
        <span className="rounded-full bg-brand-blue px-1.5 text-[11px] leading-[18px] font-semibold text-white">
          {requests.length}
        </span>
      </h2>
      <p className="text-xs text-muted-foreground">
        {club.visibility === 'private'
          ? `People who want to join your private ${CLUB_TYPE_LABEL[club.type].toLowerCase()}.`
          : 'Waiting from when this was private.'}
      </p>
      <ul className="mt-1 divide-y divide-border">
        {requests.map((person) => (
          <RequestRow key={person.id} clubId={club.id} person={person} />
        ))}
      </ul>
    </section>
  )
}
