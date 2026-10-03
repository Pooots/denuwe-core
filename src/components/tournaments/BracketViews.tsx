import { Crown, Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import type { StandingRow, TournamentDetail, TournamentEntry, TournamentMatch } from '@/types/tournament'
import { canEditMatch, entryById, roundName } from '@/components/tournaments/tournamentUi'
import { cn } from '@/lib/utils'

type MatchProps = {
  detail: TournamentDetail
  match: TournamentMatch
  entries: Map<number, TournamentEntry>
  myEntryId: number | null
  onOpen?: (match: TournamentMatch) => void
}

function SideRow({
  entry,
  score,
  won,
  lost,
  mine,
  bye,
}: {
  entry: TournamentEntry | undefined
  score: number | null
  won: boolean
  lost: boolean
  mine: boolean
  bye: boolean
}) {
  return (
    <div
      className={cn(
        'flex h-8 items-center gap-2 px-2.5 text-[13px]',
        won && 'bg-amber-50',
        mine && 'shadow-[inset_3px_0_0] shadow-brand-blue',
      )}
    >
      <span className="w-4 shrink-0 text-right text-[10px] font-semibold text-muted-foreground">
        {entry?.seed ?? ''}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          !entry && 'text-muted-foreground italic',
          won && 'font-semibold text-ink',
          lost && 'text-ink/45',
          entry && !won && !lost && 'text-ink',
        )}
      >
        {entry ? entry.name : bye ? 'Bye' : 'TBD'}
      </span>
      {won ? <Crown className="size-3.5 shrink-0 text-amber-500" /> : null}
      <span className={cn('w-6 shrink-0 text-right font-semibold tabular-nums', won ? 'text-ink' : 'text-ink/50')}>
        {score ?? ''}
      </span>
    </div>
  )
}

function MatchCard({ detail, match, entries, myEntryId, onOpen }: MatchProps) {
  const sides = [match.entry1_id, match.entry2_id]
  const editable = canEditMatch(detail, match) && onOpen
  const body = (
    <>
      {sides.map((id, i) => (
        <SideRow
          key={i}
          entry={id ? entries.get(id) : undefined}
          score={i === 0 ? match.score1 : match.score2}
          won={match.completed && id !== null && match.winner_id === id}
          lost={match.completed && id !== null && match.winner_id !== null && match.winner_id !== id}
          mine={id !== null && id === myEntryId}
          bye={match.is_bye}
        />
      ))}
    </>
  )
  const frame = cn(
    'block w-full overflow-hidden rounded-lg border bg-white text-left [&>div+div]:border-t [&>div+div]:border-border',
    match.completed ? 'border-border' : 'border-[#c4c9d4]',
    match.is_bye && 'opacity-70',
  )

  if (!editable) return <div className={frame}>{body}</div>
  return (
    <button
      type="button"
      onClick={() => onOpen(match)}
      title={match.completed ? 'Edit result' : 'Enter result'}
      className={cn(frame, 'group relative transition hover:border-brand-blue hover:ring-2 hover:ring-brand-blue/15')}
    >
      {body}
      <span className="absolute top-1/2 right-1 hidden -translate-y-1/2 rounded-full bg-brand-blue p-1 text-white shadow group-hover:block">
        <Pencil className="size-3" />
      </span>
    </button>
  )
}

/** An extra column at the end of the standings, e.g. who moves on. */
type StandingsColumn = { header: ReactNode; cell: (row: StandingRow) => ReactNode }

/** A league table, leader first. */
export function StandingsTable({
  detail,
  rows,
  matches,
  column,
  marked,
}: {
  detail: TournamentDetail
  rows: Array<StandingRow>
  /** The matches the table counts, for the "played" line. */
  matches: Array<TournamentMatch>
  column?: StandingsColumn
  /** Rows to highlight, e.g. those moving on. */
  marked?: Set<number>
}) {
  const entries = entryById(detail)
  const played = matches.filter((m) => m.completed).length

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase">
            <th className="w-6 py-2 text-left sm:w-8">#</th>
            <th className="py-2 text-left">{detail.format === 'team' ? 'Team' : 'Player'}</th>
            <th className="w-7 py-2 text-center sm:w-9" title="Played">
              P
            </th>
            <th className="w-7 py-2 text-center sm:w-9" title="Won">
              W
            </th>
            <th className="hidden w-9 py-2 text-center sm:table-cell" title="Drawn">
              D
            </th>
            <th className="w-7 py-2 text-center sm:w-9" title="Lost">
              L
            </th>
            <th className="hidden w-12 py-2 text-center sm:table-cell" title="Score difference">
              +/-
            </th>
            <th className="w-9 py-2 text-center sm:w-10" title="Points">
              Pts
            </th>
            {column ? <th className="w-[88px] py-2 pl-2 text-right sm:w-28">{column.header}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const entry = entries.get(row.entry_id)
            const diff = row.score_for - row.score_against
            const leader = i === 0 && played > 0
            return (
              <tr
                key={row.entry_id}
                className={cn(
                  'border-b border-border last:border-0',
                  marked?.has(row.entry_id)
                    ? 'bg-emerald-500/5'
                    : row.entry_id === detail.my_entry_id && 'bg-brand-blue/5',
                )}
              >
                <td className="py-2 font-semibold text-muted-foreground">{i + 1}</td>
                <td className="py-2">
                  <span className="flex items-center gap-1.5 font-semibold text-ink">
                    {leader ? <Crown className="size-3.5 shrink-0 text-amber-500" /> : null}
                    <span className="truncate" title={entry?.name}>
                      {entry?.name ?? 'Removed'}
                    </span>
                  </span>
                </td>
                <td className="py-2 text-center text-ink/70">{row.played}</td>
                <td className="py-2 text-center text-ink/70">{row.won}</td>
                <td className="hidden py-2 text-center text-ink/70 sm:table-cell">{row.drawn}</td>
                <td className="py-2 text-center text-ink/70">{row.lost}</td>
                <td className="hidden py-2 text-center text-ink/70 sm:table-cell">{diff > 0 ? `+${diff}` : diff}</td>
                <td className="py-2 text-center font-semibold text-ink">{row.points}</td>
                {column ? <td className="py-2 pl-2 text-right whitespace-nowrap">{column.cell(row)}</td> : null}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        {played} of {matches.length} matches played · 3 points a win, 1 a draw
      </p>
    </div>
  )
}

/** Matches round by round, two rounds a row. */
export function MatchRounds({
  detail,
  matches,
  rounds,
  onOpen,
}: {
  detail: TournamentDetail
  matches: Array<TournamentMatch>
  rounds: number
  onOpen?: (match: TournamentMatch) => void
}) {
  const entries = entryById(detail)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
        <div key={round}>
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {roundName(round, rounds, 'round_robin')}
          </p>
          <div className="space-y-1.5">
            {matches
              .filter((m) => m.round === round)
              .map((match) => (
                <MatchCard
                  key={match.id}
                  detail={detail}
                  match={match}
                  entries={entries}
                  myEntryId={detail.my_entry_id}
                  onOpen={onOpen}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** League table plus every match, round by round. */
export function RoundRobinBoard({
  detail,
  onOpen,
}: {
  detail: TournamentDetail
  onOpen?: (match: TournamentMatch) => void
}) {
  return (
    <div className="space-y-5">
      <StandingsTable detail={detail} rows={detail.standings} matches={detail.matches} />
      <MatchRounds detail={detail} matches={detail.matches} rounds={detail.rounds} onOpen={onOpen} />
    </div>
  )
}
