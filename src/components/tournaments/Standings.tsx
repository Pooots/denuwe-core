import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Crown, LoaderCircle, Pencil, Trophy } from 'lucide-react'
import type { ScheduledGame, StandingRow, TournamentDetail, TournamentMatch } from '@/types/tournament'
import { toast } from '@/components/feed/Toaster'
import { StandingsTable } from '@/components/tournaments/BracketViews'
import { gameTitle, gameWhen } from '@/components/tournaments/GameSetup'
import { canEditMatch, entryById, inGroupStage, storeTournament } from '@/components/tournaments/tournamentUi'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { tournamentService } from '@/services/tournamentService'

const RESULTS_SHOWN = 10

type Status = { label: string; className: string }

const STATUS = {
  champion: { label: 'Champion', className: 'bg-amber-500/15 text-amber-800' },
  runnerUp: { label: 'Runner-up', className: 'bg-slate-500/10 text-slate-700' },
  movingOn: { label: 'Moving on', className: 'bg-emerald-500/10 text-emerald-700' },
  playing: { label: 'Still in', className: 'bg-brand-blue/10 text-brand-blue' },
  out: { label: 'Out', className: 'bg-muted text-ink/50' },
} satisfies Record<string, Status>

/** Whoever lost a bracket's deciding match: its final, or the grand final (and its reset) in double elimination. */
function runnersUp(detail: TournamentDetail): Set<number> {
  const losers = new Set<number>()
  for (const bracket of detail.brackets) {
    if (bracket.winner_id === null) continue
    const deciding = detail.matches
      .filter(
        (m) =>
          m.bracket_id === bracket.id &&
          m.completed &&
          m.winner_id === bracket.winner_id &&
          (detail.bracket === 'double_elimination' ? m.side === 'final' : m.round === bracket.rounds),
      )
      .at(-1)
    const loser = deciding && (deciding.entry1_id === bracket.winner_id ? deciding.entry2_id : deciding.entry1_id)
    if (loser) losers.add(loser)
  }
  return losers
}

/** Where a player or team stands in the tournament: champion, still in, or knocked out. */
function entryStatus(detail: TournamentDetail, entryId: number): Status | null {
  if (detail.winner?.id === entryId || detail.champions.some((c) => c.entry.id === entryId)) return STATUS.champion
  if (runnersUp(detail).has(entryId)) return STATUS.runnerUp
  if (detail.status === 'registration') return null
  if (inGroupStage(detail)) {
    return detail.entries.find((e) => e.id === entryId)?.advanced ? STATUS.movingOn : STATUS.playing
  }
  if (detail.bracket === 'round_robin') return detail.status === 'completed' ? null : STATUS.playing
  if (detail.group_stage && !detail.entries.find((e) => e.id === entryId)?.advanced) return STATUS.out
  const losses = detail.matches.filter(
    (m) =>
      m.side !== 'group' &&
      m.completed &&
      !m.is_bye &&
      m.winner_id !== null &&
      m.winner_id !== entryId &&
      (m.entry1_id === entryId || m.entry2_id === entryId),
  ).length
  if (losses >= (detail.bracket === 'double_elimination' ? 2 : 1)) return STATUS.out
  return detail.status === 'completed' ? STATUS.out : STATUS.playing
}

/** Results so far, champions then runners-up on top; everyone at zero before the first result. */
function tableRows(detail: TournamentDetail): Array<StandingRow> {
  const rows: Array<StandingRow> =
    detail.overall_standings.length > 0
      ? detail.overall_standings
      : detail.entries.map((e) => ({
          entry_id: e.id,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          score_for: 0,
          score_against: 0,
          points: 0,
        }))
  const champions = new Set([...(detail.winner ? [detail.winner.id] : []), ...detail.champions.map((c) => c.entry.id)])
  const seconds = runnersUp(detail)
  const tier = (id: number) => (champions.has(id) ? 0 : seconds.has(id) ? 1 : 2)
  return [...rows].sort((a, b) => tier(a.entry_id) - tier(b.entry_id))
}

function DeclareRow({
  detail,
  match,
  game,
  title,
  onOpen,
}: {
  detail: TournamentDetail
  match: TournamentMatch
  game: ScheduledGame | undefined
  title: string
  onOpen: (match: TournamentMatch) => void
}) {
  const qc = useQueryClient()
  const [picked, setPicked] = useState<number | 'draw' | null>(null)
  const declare = useMutation({
    mutationFn: (winner: number | null) =>
      tournamentService.recordMatch(detail.id, match.id, { winner_id: winner, score1: null, score2: null }),
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
    onSettled: () => setPicked(null),
  })
  const entries = entryById(detail)
  const draws = detail.bracket === 'round_robin' || match.side === 'group'
  const when = game ? gameWhen(game) : null
  const pick = (choice: number | 'draw') => {
    setPicked(choice)
    declare.mutate(choice === 'draw' ? null : choice)
  }

  return (
    <li className="px-3 py-3 sm:px-4">
      <div className="flex items-start gap-2">
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-[11px] font-semibold text-muted-foreground">
          <span>{title}</span>
          {when ? <span className="font-normal">· {when}</span> : null}
        </p>
        <button
          type="button"
          disabled={declare.isPending}
          onClick={() => onOpen(match)}
          aria-label="Enter scores"
          title="Enter scores"
          className="-mt-1.5 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-ink/50 transition hover:bg-muted hover:text-ink disabled:opacity-60 sm:hidden"
        >
          <Pencil className="size-4" />
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {[match.entry1_id, match.entry2_id].map((id, i) => {
          const entry = id !== null ? entries.get(id) : undefined
          return (
            <span key={i} className="contents">
              {i === 1 ? <span className="text-xs text-muted-foreground">vs</span> : null}
              <button
                type="button"
                disabled={declare.isPending || id === null}
                onClick={() => id !== null && pick(id)}
                aria-label={`${entry?.name ?? 'Side'} won`}
                className={cn(
                  'flex min-h-10 min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 rounded-2xl border px-3 py-1 text-[13px] leading-tight font-semibold transition sm:h-9 sm:min-h-0 sm:max-w-[220px] sm:basis-auto sm:rounded-full sm:py-0',
                  picked === id
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-[#c4c9d4] text-ink hover:border-amber-400 hover:bg-amber-50 disabled:opacity-60',
                )}
              >
                {picked === id ? (
                  <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
                ) : (
                  <Crown className="size-3.5 shrink-0 text-amber-500" />
                )}
                <span className="line-clamp-2 break-words sm:truncate">{entry?.name ?? 'TBD'}</span>
              </button>
            </span>
          )
        })}
        {draws ? (
          <button
            type="button"
            disabled={declare.isPending}
            onClick={() => pick('draw')}
            className={cn(
              'h-9 w-full rounded-full border border-dashed px-3 text-[12px] font-semibold transition disabled:opacity-60 sm:w-auto',
              picked === 'draw'
                ? 'border-brand-blue bg-brand-blue/5 text-brand-blue'
                : 'border-[#c4c9d4] text-ink/60 hover:bg-muted',
            )}
          >
            Draw
          </button>
        ) : null}
        <button
          type="button"
          disabled={declare.isPending}
          onClick={() => onOpen(match)}
          aria-label="Enter scores"
          title="Enter scores"
          className="hidden size-9 shrink-0 place-items-center rounded-full text-ink/50 transition hover:bg-muted hover:text-ink disabled:opacity-60 sm:grid"
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </li>
  )
}

function ResultRow({
  detail,
  match,
  title,
  onOpen,
}: {
  detail: TournamentDetail
  match: TournamentMatch
  title: string
  onOpen: (match: TournamentMatch) => void
}) {
  const entries = entryById(detail)
  const editable = canEditMatch(detail, match)
  const scored = match.score1 !== null && match.score2 !== null
  const body = (
    <>
      <span className="block text-[11px] font-semibold text-muted-foreground">{title}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px]">
        {[match.entry1_id, match.entry2_id].map((id, i) => {
          const won = match.winner_id !== null && match.winner_id === id
          return (
            <span key={i} className="contents">
              {i === 1 ? <span className="text-muted-foreground">vs</span> : null}
              <span
                className={cn(
                  'inline-flex min-w-0 items-center gap-1',
                  won ? 'font-semibold text-ink' : 'text-ink/55',
                  id === detail.my_entry_id && 'underline decoration-brand-blue decoration-2 underline-offset-2',
                )}
              >
                {won ? <Crown className="size-3.5 shrink-0 text-amber-500" /> : null}
                <span className="truncate">{id !== null ? (entries.get(id)?.name ?? 'Removed') : 'TBD'}</span>
              </span>
            </span>
          )
        })}
        {scored ? (
          <span className="ml-1 rounded bg-muted px-1.5 text-[12px] font-semibold text-ink/80 tabular-nums">
            {match.score1} – {match.score2}
          </span>
        ) : null}
        {match.winner_id === null ? <span className="ml-1 text-[12px] text-muted-foreground">Draw</span> : null}
      </span>
    </>
  )
  return (
    <li>
      {editable ? (
        <button
          type="button"
          onClick={() => onOpen(match)}
          title="Change result"
          className="block w-full px-4 py-2.5 text-left transition hover:bg-muted/60"
        >
          {body}
        </button>
      ) : (
        <div className="px-4 py-2.5">{body}</div>
      )}
    </li>
  )
}

/**
 * Standings: every player or team ranked by their results so far (3 points a win, 1 a draw), elimination stage and
 * bracket together. The organizer declares each match's winner here and the table updates straight away.
 */
export function StandingsPanel({
  detail,
  onOpen,
}: {
  detail: TournamentDetail
  onOpen: (match: TournamentMatch) => void
}) {
  const [allResults, setAllResults] = useState(false)
  const games = detail.schedule.games
  const gameByMatch = new Map(games.filter((g) => g.match_id !== null).map((g) => [g.match_id as number, g]))
  const order = new Map(games.map((g, i) => [g.match_id, i]))
  const played = detail.matches
    .filter((m) => !m.is_bye && m.entry1_id !== null && m.entry2_id !== null)
    .sort((a, b) => (order.get(a.id) ?? 1e6) - (order.get(b.id) ?? 1e6))
  const ready = played.filter((m) => !m.completed && canEditMatch(detail, m))
  const results = played.filter((m) => m.completed)
  const shownResults = (allResults ? results : results.slice(-RESULTS_SHOWN)).reverse()
  const title = (match: TournamentMatch) => {
    const game = gameByMatch.get(match.id)
    return game ? gameTitle(detail, game, games) : ''
  }
  const words = detail.format === 'team' ? 'teams' : 'players'

  return (
    <div className="space-y-2">
      <section className="rounded-xl border border-border bg-white px-4 py-4 sm:px-5">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink">
          <Trophy className="size-5 text-brand-blue" /> Standings
        </h2>
        <p className="mb-3 text-[13px] text-muted-foreground">
          {detail.status === 'registration'
            ? `Everyone starts at zero. Once the games begin, every winner the organizer declares updates the table.`
            : `Every result so far${detail.group_stage ? ', elimination stage and bracket together' : ''}. The table updates as soon as the organizer declares a winner.`}
        </p>
        {detail.entries.length === 0 ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] text-ink/70">No {words} yet.</p>
        ) : (
          <StandingsTable
            detail={detail}
            rows={tableRows(detail)}
            matches={played}
            column={{
              header: 'Status',
              cell: (row) => {
                const status = entryStatus(detail, row.entry_id)
                return status ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
                      status.className,
                    )}
                  >
                    {status === STATUS.champion ? <Crown className="size-3" /> : null}
                    {status.label}
                  </span>
                ) : null
              },
            }}
          />
        )}
      </section>

      {ready.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <header className="border-b border-border bg-muted/40 px-4 py-2.5">
            <h3 className="text-[15px] font-semibold text-ink">Declare winners</h3>
            <p className="text-xs text-muted-foreground">
              Tap who won and the standings update. Use the pencil to add scores.
            </p>
          </header>
          <ul className="divide-y divide-border">
            {ready.map((match) => (
              <DeclareRow
                key={match.id}
                detail={detail}
                match={match}
                game={gameByMatch.get(match.id)}
                title={title(match)}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {results.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <header className="flex items-baseline justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
            <h3 className="text-[15px] font-semibold text-ink">Results</h3>
            <span className="text-xs text-muted-foreground">
              {results.length} of {played.length} played
            </span>
          </header>
          <ul className="divide-y divide-border">
            {shownResults.map((match) => (
              <ResultRow key={match.id} detail={detail} match={match} title={title(match)} onOpen={onOpen} />
            ))}
          </ul>
          {results.length > RESULTS_SHOWN ? (
            <button
              type="button"
              onClick={() => setAllResults((all) => !all)}
              className="w-full border-t border-border py-2 text-[13px] font-semibold text-brand-blue hover:bg-muted/60"
            >
              {allResults ? 'Show the latest only' : `Show all ${results.length} results`}
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
