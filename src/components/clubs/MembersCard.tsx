import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Award, CalendarCheck, Check, LoaderCircle, MoreHorizontal, Settings2 } from 'lucide-react'
import type { Club, ClubDetail, ClubMember, FeeStatus } from '@/types/club'
import { PositionsDialog } from '@/components/clubs/PositionsDialog'
import { plural, refreshClubs } from '@/components/clubs/clubUi'
import { Avatar } from '@/components/feed/Avatar'
import { toast } from '@/components/feed/Toaster'
import { useDismiss } from '@/components/feed/useDismiss'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { clubService } from '@/services/clubService'

function PositionMenu({
  club,
  member,
  positions,
  onManage,
}: {
  club: Club
  member: ClubMember
  positions: ClubDetail['positions']
  onManage: () => void
}) {
  const qc = useQueryClient()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  useDismiss(ref, open, () => setOpen(false))

  const assign = useMutation({
    mutationFn: (positionId: number | null) => clubService.assignPosition(club.id, member.id, positionId),
    onSuccess: (message) => {
      refreshClubs(qc)
      toast(message)
      setOpen(false)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })

  const option = (selected: boolean) =>
    cn(
      'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-muted disabled:opacity-50',
      selected ? 'font-semibold text-brand-blue' : 'text-ink',
    )

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={`Set position for ${member.name}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-7 place-items-center rounded-full text-ink/60 transition hover:bg-muted hover:text-ink"
      >
        {assign.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-xl">
          <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Position
          </p>
          <div className="max-h-64 overflow-y-auto">
            {positions.map((position) => {
              const selected = member.position?.id === position.id
              return (
                <button
                  key={position.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  disabled={assign.isPending}
                  onClick={() => (selected ? setOpen(false) : assign.mutate(position.id))}
                  className={option(selected)}
                >
                  <span className="grid size-4 place-items-center">
                    {selected ? <Check className="size-4" /> : null}
                  </span>
                  <span className="truncate">{position.name}</span>
                </button>
              )
            })}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={!member.position}
              disabled={assign.isPending}
              onClick={() => (member.position ? assign.mutate(null) : setOpen(false))}
              className={option(!member.position)}
            >
              <span className="grid size-4 place-items-center">
                {!member.position ? <Check className="size-4" /> : null}
              </span>
              No position
            </button>
          </div>
          <div className="mt-1 border-t border-border pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onManage()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink/80 hover:bg-muted"
            >
              <Settings2 className="size-4" /> Manage positions…
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function FeeButton({ club, member }: { club: Club; member: ClubMember }) {
  const qc = useQueryClient()
  const next: FeeStatus = member.fee_status === 'paid' ? 'unpaid' : 'paid'

  const setFee = useMutation({
    mutationFn: () => clubService.setMemberFee(club.id, member.id, next),
    onSuccess: () => {
      refreshClubs(qc)
      toast(next === 'paid' ? `${member.name} marked as paid.` : `${member.name} marked as unpaid.`)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })

  return (
    <button
      type="button"
      disabled={setFee.isPending}
      onClick={() => setFee.mutate()}
      className={cn(
        'h-7 shrink-0 rounded-full px-3 text-[11px] font-semibold transition disabled:opacity-50',
        next === 'paid'
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'border border-[#c4c9d4] text-ink/70 hover:bg-muted',
      )}
    >
      {setFee.isPending ? (
        <LoaderCircle className="size-3.5 animate-spin" />
      ) : next === 'paid' ? (
        'Mark paid'
      ) : (
        'Mark unpaid'
      )}
    </button>
  )
}

function MemberRow({
  club,
  member,
  positions,
  isYou,
  onManage,
}: {
  club: Club
  member: ClubMember
  positions: ClubDetail['positions']
  isYou: boolean
  onManage: () => void
}) {
  const showFee = member.fee_status && member.role !== 'owner'
  const organizes = positions.some((p) => p.id === member.position?.id && p.can_organize)
  const canManageFee = club.is_owner && !club.is_free && member.role !== 'owner'

  return (
    <li className="flex items-center gap-3 py-1.5">
      <Avatar name={member.name} src={member.avatar_url} className="size-9 text-[11px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">
          {member.name}
          {isYou ? <span className="font-normal text-muted-foreground"> · You</span> : null}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] font-semibold">
          {member.position ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-brand-blue">
              <Award className="size-3 shrink-0" />
              <span className="truncate">{member.position.name}</span>
              {organizes ? (
                <CalendarCheck
                  className="size-3 shrink-0 text-brand-blue"
                  aria-label="Creates activities and tournaments"
                />
              ) : null}
            </span>
          ) : null}
          {member.position && showFee ? <span className="text-muted-foreground">·</span> : null}
          {showFee ? (
            <span className={member.fee_status === 'paid' ? 'text-emerald-700' : 'text-amber-700'}>
              {member.fee_status === 'paid' ? 'Fee paid' : 'Fee pending'}
            </span>
          ) : null}
        </span>
      </span>
      {member.role === 'owner' ? (
        <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[11px] font-semibold text-brand-blue">
          Owner
        </span>
      ) : canManageFee ? (
        <FeeButton club={club} member={member} />
      ) : null}
      {club.is_owner ? <PositionMenu club={club} member={member} positions={positions} onManage={onManage} /> : null}
    </li>
  )
}

export function MembersCard({ detail, viewerId }: { detail: ClubDetail; viewerId: number }) {
  const { club, members, positions } = detail
  const [managing, setManaging] = useState(false)
  const paidCount = members.filter((m) => m.fee_status === 'paid').length

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3">
      <h2 className="text-[17px] font-semibold text-ink">Members</h2>
      <p className="text-xs text-muted-foreground">
        {plural(club.members_count, 'member')}
        {club.is_owner && !club.is_free ? ` · ${paidCount} paid` : ''}
      </p>

      <ul className="mt-2">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            club={club}
            member={member}
            positions={positions}
            isYou={member.id === viewerId}
            onManage={() => setManaging(true)}
          />
        ))}
      </ul>

      {managing ? <PositionsDialog club={club} positions={positions} onClose={() => setManaging(false)} /> : null}
    </section>
  )
}
