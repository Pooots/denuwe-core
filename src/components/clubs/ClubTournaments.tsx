import { useState } from 'react'
import { Trophy } from 'lucide-react'
import type { ClubDetail } from '@/types/club'
import { organizerNote } from '@/components/clubs/ClubActivities'
import { TournamentCard } from '@/components/tournaments/TournamentCard'
import { TournamentFormDialog } from '@/components/tournaments/TournamentFormDialog'

export function ClubTournaments({ detail, viewerId }: { detail: ClubDetail; viewerId: number }) {
  const [creating, setCreating] = useState(false)
  const { club, tournaments, can_organize: canOrganize } = detail
  const active = tournaments.filter((t) => t.status !== 'completed')
  const finished = tournaments.filter((t) => t.status === 'completed')

  return (
    <section className="rounded-xl border border-border bg-white px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-ink">Tournaments</h2>
        {canOrganize ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
          >
            <Trophy className="size-4" /> Create tournament
          </button>
        ) : null}
      </div>

      {active.length > 0 ? (
        <div className="mt-3 space-y-2">
          {active.map((t) => (
            <TournamentCard key={t.id} tournament={t} viewerId={viewerId} showClub={false} />
          ))}
        </div>
      ) : (
        <div className="py-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-400/15 text-amber-700">
            <Trophy className="size-6" />
          </span>
          <p className="mt-2 text-[13px] text-muted-foreground">No upcoming tournaments.</p>
          {canOrganize ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-3 h-8 rounded-full border border-brand-blue px-4 text-[13px] font-semibold text-brand-blue transition hover:bg-brand-blue/5"
            >
              Host the first one
            </button>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{organizerNote(detail, 'tournaments')}</p>
          )}
        </div>
      )}

      {finished.length > 0 ? (
        <>
          <p className="mt-4 border-t border-border pt-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Finished
          </p>
          <div className="mt-2 space-y-2">
            {finished.map((t) => (
              <TournamentCard key={t.id} tournament={t} viewerId={viewerId} showClub={false} />
            ))}
          </div>
        </>
      ) : null}

      {creating ? <TournamentFormDialog club={club} onClose={() => setCreating(false)} /> : null}
    </section>
  )
}
