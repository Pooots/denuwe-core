import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Award, CalendarCheck, LoaderCircle, Settings2, UserPlus, X } from 'lucide-react'
import type { ClubDetail, ClubMember, ClubPosition } from '@/types/club'
import { PositionsDialog } from '@/components/clubs/PositionsDialog'
import { refreshClubs } from '@/components/clubs/clubUi'
import { Avatar } from '@/components/feed/Avatar'
import { toast } from '@/components/feed/Toaster'
import { useDismiss } from '@/components/feed/useDismiss'
import { apiErrorMessage } from '@/services/authService'
import { clubService } from '@/services/clubService'

function useAssign(clubId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, positionId }: { userId: number; positionId: number | null }) =>
      clubService.assignPosition(clubId, userId, positionId),
    onSuccess: (message) => {
      refreshClubs(qc)
      toast(message)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })
}

/** Owner-only picker for filling a vacant position. */
function AssignButton({
  clubId,
  position,
  members,
}: {
  clubId: number
  position: ClubPosition
  members: Array<ClubMember>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  useDismiss(ref, open, () => setOpen(false))
  const assign = useAssign(clubId)

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={`Assign ${position.name}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="h-7 rounded-full border border-brand-blue px-3 text-[11px] font-semibold text-brand-blue transition hover:bg-brand-blue/5"
      >
        {assign.isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : 'Assign'}
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-30 mt-1 w-60 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-xl">
          <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Who is the {position.name}?
          </p>
          <div className="max-h-64 overflow-y-auto">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                role="menuitem"
                disabled={assign.isPending}
                onClick={() => {
                  setOpen(false)
                  assign.mutate({ userId: member.id, positionId: position.id })
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-muted disabled:opacity-50"
              >
                <Avatar name={member.name} src={member.avatar_url} className="size-7 text-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{member.name}</span>
                  {member.position ? (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      Currently {member.position.name}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Every position in order with who holds it, so vacant ones stand out. */
export function OfficersCard({ detail, viewerId }: { detail: ClubDetail; viewerId: number }) {
  const { club, members, positions } = detail
  const [managing, setManaging] = useState(false)
  const assign = useAssign(club.id)

  if (positions.length === 0 && !club.is_owner) return null

  const holdersOf = (position: ClubPosition) => members.filter((m) => m.position?.id === position.id)
  const vacant = positions.filter((p) => holdersOf(p).length === 0).length

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-semibold text-ink">Officers</h2>
          {positions.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {positions.length - vacant} of {positions.length} positions filled
              {vacant > 0 ? <span className="font-semibold text-amber-700"> · {vacant} vacant</span> : null}
            </p>
          ) : null}
        </div>
        {club.is_owner ? (
          <button
            type="button"
            onClick={() => setManaging(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#c4c9d4] px-3 text-[12px] font-semibold text-ink/80 transition hover:bg-muted"
          >
            <Settings2 className="size-3.5" /> Manage
          </button>
        ) : null}
      </div>

      {positions.length === 0 ? (
        <button
          type="button"
          onClick={() => setManaging(true)}
          className="mt-2 w-full rounded-lg border border-dashed border-[#c4c9d4] px-3 py-2.5 text-left text-[12px] text-muted-foreground transition hover:border-brand-blue hover:text-brand-blue"
        >
          <span className="font-semibold text-ink/80">Add positions</span> like President, Vice President or Director,
          then assign them to members.
        </button>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {positions.map((position) => {
            const holders = holdersOf(position)
            return (
              <li key={position.id} className="py-2">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-brand-blue">
                  <Award className="size-3 shrink-0" />
                  <span className="truncate">{position.name}</span>
                  {position.can_organize ? (
                    <CalendarCheck
                      className="size-3 shrink-0 text-brand-blue"
                      aria-label="Creates activities and tournaments"
                    />
                  ) : null}
                </p>
                {holders.length > 0 ? (
                  holders.map((holder) => (
                    <div key={holder.id} className="mt-1 flex items-center gap-2.5">
                      <Avatar name={holder.name} src={holder.avatar_url} className="size-8 text-[10px]" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                        {holder.name}
                        {holder.id === viewerId ? (
                          <span className="font-normal text-muted-foreground"> · You</span>
                        ) : null}
                      </span>
                      {club.is_owner ? (
                        <button
                          type="button"
                          aria-label={`Remove ${holder.name} as ${position.name}`}
                          title={`Remove from ${position.name}`}
                          disabled={assign.isPending}
                          onClick={() => {
                            if (window.confirm(`Remove ${holder.name} as ${position.name}?`)) {
                              assign.mutate({ userId: holder.id, positionId: null })
                            }
                          }}
                          className="grid size-7 shrink-0 place-items-center rounded-full text-ink/40 transition hover:bg-muted hover:text-danger disabled:opacity-50"
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="mt-1 flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-amber-500/60 text-amber-600">
                      <UserPlus className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] font-semibold text-amber-700">Vacant</span>
                    {club.is_owner ? <AssignButton clubId={club.id} position={position} members={members} /> : null}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {managing ? <PositionsDialog club={club} positions={positions} onClose={() => setManaging(false)} /> : null}
    </section>
  )
}
