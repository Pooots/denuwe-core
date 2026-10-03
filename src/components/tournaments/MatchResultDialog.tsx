import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Crown, LoaderCircle } from 'lucide-react'
import type { TournamentDetail, TournamentEntry, TournamentMatch } from '@/types/tournament'
import { inputClass } from '@/components/clubs/ClubForm'
import { Avatar } from '@/components/feed/Avatar'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { entryById, matchTitle, storeTournament } from '@/components/tournaments/tournamentUi'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { tournamentService } from '@/services/tournamentService'

type WinnerChoice = number | 'draw' | null

function scoreValue(text: string): number | null {
  return text.trim() === '' ? null : Number(text)
}

export function MatchResultDialog({
  detail,
  match,
  bracketName,
  onClose,
}: {
  /** The match's bracket view of the tournament (see `scopeBracket`), or the tournament for round robin and groups. */
  detail: TournamentDetail
  match: TournamentMatch
  /** Shown when the tournament has several brackets. */
  bracketName?: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const entries = entryById(detail)
  const sides = [match.entry1_id, match.entry2_id].map((id) => (id ? entries.get(id) : undefined)) as [
    TournamentEntry | undefined,
    TournamentEntry | undefined,
  ]
  /** Round-robin and elimination-stage matches score points and can be drawn. */
  const roundRobin = detail.bracket === 'round_robin' || match.side === 'group'

  const [scores, setScores] = useState<[string, string]>([
    match.score1 === null ? '' : String(match.score1),
    match.score2 === null ? '' : String(match.score2),
  ])
  const [winner, setWinner] = useState<WinnerChoice>(match.completed ? (match.winner_id ?? 'draw') : null)
  const [error, setError] = useState<string | null>(null)

  const onScore = (index: 0 | 1, text: string) => {
    const next: [string, string] = index === 0 ? [text, scores[1]] : [scores[0], text]
    setScores(next)
    const [a, b] = next.map(scoreValue)
    if (a === null || b === null || Number.isNaN(a) || Number.isNaN(b)) return
    if (a !== b) setWinner(a > b ? match.entry1_id : match.entry2_id)
    else if (roundRobin) setWinner('draw')
  }

  const done = (message: string, next: TournamentDetail) => {
    storeTournament(qc, next)
    toast(message)
    onClose()
  }

  const save = useMutation({
    mutationFn: () =>
      tournamentService.recordMatch(detail.id, match.id, {
        winner_id: winner === 'draw' ? null : winner,
        score1: scoreValue(scores[0]),
        score2: scoreValue(scores[1]),
      }),
    onSuccess: ({ message, tournament }) => done(message, tournament),
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const clear = useMutation({
    mutationFn: () => tournamentService.clearMatch(detail.id, match.id),
    onSuccess: ({ message, tournament }) => done(message, tournament),
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const submit = () => {
    const [a, b] = scores.map(scoreValue)
    const problem =
      (a === null) !== (b === null)
        ? 'Enter both scores, or leave both empty.'
        : [a, b].some((s) => s !== null && (!Number.isInteger(s) || s < 0 || s > 9999))
          ? 'Scores must be whole numbers from 0 to 9999.'
          : winner === null
            ? roundRobin
              ? 'Pick the winner, or mark it a draw.'
              : 'Pick the winner.'
            : null
    setError(problem)
    if (!problem) save.mutate()
  }

  const busy = save.isPending || clear.isPending

  return (
    <Modal
      onClose={onClose}
      className="max-w-[440px]"
      title={
        <div>
          <h2 className="text-[17px] font-semibold text-ink">Match result</h2>
          <p className="text-xs text-muted-foreground">
            {matchTitle(detail, match)} · {bracketName ?? detail.name}
          </p>
        </div>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="space-y-2 px-5 pb-4">
          {sides.map((entry, index) => {
            const id = index === 0 ? match.entry1_id : match.entry2_id
            const picked = winner !== null && winner === id
            return (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-2.5 transition sm:gap-3 sm:px-3',
                  picked ? 'border-amber-400 bg-amber-50' : 'border-border',
                )}
              >
                <Avatar
                  name={entry?.name ?? '?'}
                  src={entry && !entry.team_name ? entry.members[0]?.avatar_url : null}
                  className="size-8 text-[11px] sm:size-9 sm:text-xs"
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[14px] leading-tight font-semibold break-words text-ink sm:truncate">
                    {entry?.name ?? 'TBD'}
                  </span>
                  {entry?.seed ? <span className="text-xs text-muted-foreground">Seed {entry.seed}</span> : null}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={9999}
                  value={scores[index]}
                  onChange={(e) => onScore(index as 0 | 1, e.target.value)}
                  placeholder="–"
                  aria-label={`${entry?.name ?? 'Side'} score`}
                  className={cn(inputClass, 'h-10 w-16 shrink-0 text-center text-[16px] font-semibold sm:w-20')}
                />
                <button
                  type="button"
                  aria-pressed={picked}
                  onClick={() => setWinner(id)}
                  className={cn(
                    'flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-semibold transition',
                    picked ? 'bg-amber-500 text-white' : 'border border-[#c4c9d4] text-ink/70 hover:bg-muted',
                  )}
                >
                  <Crown className="size-3.5" /> {picked ? 'Winner' : 'Won'}
                </button>
              </div>
            )
          })}
          {roundRobin ? (
            <button
              type="button"
              aria-pressed={winner === 'draw'}
              onClick={() => setWinner('draw')}
              className={cn(
                'h-9 w-full rounded-lg border text-[13px] font-semibold transition',
                winner === 'draw'
                  ? 'border-brand-blue bg-brand-blue/5 text-brand-blue'
                  : 'border-dashed border-[#c4c9d4] text-ink/60 hover:bg-muted',
              )}
            >
              It’s a draw
            </button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Scores are optional.{' '}
            {roundRobin ? 'A win is worth 3 points and a draw 1.' : 'The winner moves on to the next round.'}
          </p>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          {match.completed ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => clear.mutate()}
              className="h-9 rounded-full px-3 text-[13px] font-semibold text-ink/60 transition hover:bg-muted hover:text-danger disabled:opacity-50"
            >
              {clear.isPending ? <LoaderCircle className="size-4 animate-spin" /> : 'Clear result'}
            </button>
          ) : null}
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-danger">{error}</p>
          <button
            type="submit"
            disabled={busy}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-70"
          >
            {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Save result
          </button>
        </div>
      </form>
    </Modal>
  )
}
