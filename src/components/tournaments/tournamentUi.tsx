import { Trophy } from 'lucide-react'
import type { QueryClient } from '@tanstack/react-query'
import type {
  Bracket,
  BracketScope,
  GroupStage,
  TournamentBracket,
  TournamentDetail,
  TournamentEntry,
  TournamentMatch,
  TournamentStatus,
  TournamentSummary,
} from '@/types/tournament'
import { CLUB_BG, plural } from '@/components/clubs/clubUi'
import { cn } from '@/lib/utils'

export const TOURNAMENTS_KEY = ['tournaments'] as const

/** Tournament pages are cached by slug, the key in their URL. */
export const tournamentKey = (slug: string) => ['tournament', slug] as const

export function tournamentLink(t: Pick<TournamentSummary, 'slug'>) {
  return { to: '/tournaments/$slug', params: { slug: t.slug } } as const
}

export const BRACKET_INFO: Record<TournamentBracket, { label: string; hint: string }> = {
  single_elimination: {
    label: 'Single elimination',
    hint: 'Lose once and you’re out. Winners move on until one is left.',
  },
  double_elimination: {
    label: 'Double elimination',
    hint: 'Lose twice and you’re out. A first loss drops you to the losers bracket.',
  },
  round_robin: {
    label: 'Round robin',
    hint: 'Everyone plays everyone. Most points wins (3 a win, 1 a draw).',
  },
}

const STATUS_INFO: Record<TournamentStatus, { label: string; className: string }> = {
  registration: { label: 'Registration open', className: 'bg-brand-blue/10 text-brand-blue' },
  in_progress: { label: 'Live', className: 'bg-emerald-500/10 text-emerald-700' },
  completed: { label: 'Completed', className: 'bg-muted text-ink/60' },
}

export function StatusPill({ status, className }: { status: TournamentStatus; className?: string }) {
  const { label, className: tone } = STATUS_INFO[status]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        tone,
        className,
      )}
    >
      {status === 'in_progress' ? (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
      ) : null}
      {label}
    </span>
  )
}

/** "Individual" or "Teams of 5". */
export function formatLabel(t: Pick<TournamentSummary, 'format' | 'team_size'>): string {
  return t.format === 'team' ? `Teams of ${t.team_size ?? 2}` : 'Individual'
}

export function entryWord(t: Pick<TournamentSummary, 'format'>, count: number): string {
  return t.format === 'team' ? plural(count, 'team') : plural(count, 'player')
}

/** "6 / 8 teams" or "6 players". */
export function entriesLabel(t: TournamentSummary): string {
  return t.max_entries
    ? `${t.entries_count} / ${t.max_entries} ${t.format === 'team' ? 'teams' : 'players'}`
    : entryWord(t, t.entries_count)
}

/** Final, Semifinals, Quarterfinals, then "Round of 16" and so on. */
export function roundName(round: number, rounds: number, bracket: TournamentBracket): string {
  if (bracket === 'round_robin') return `Round ${round}`
  const left = rounds - round
  if (left === 0) return 'Final'
  if (left === 1) return 'Semifinals'
  if (left === 2) return 'Quarterfinals'
  return `Round of ${2 ** (left + 1)}`
}

/** What round titles need: a whole tournament (round robin) or one bracket's view of it. */
type Titled = Pick<TournamentDetail, 'bracket' | 'rounds' | 'matches'> & { round_names?: Array<string | null> }

/**
 * A round's title: the organizer's name for it, otherwise the usual one. A knockout first round that's partly
 * byes is the "Opening round"; double elimination numbers its upper bracket rounds up to the "Upper bracket final".
 */
export function roundTitle(
  detail: Titled,
  round: number,
  rounds = detail.rounds,
  openingRound = detail.matches.some((m) => m.side === 'winners' && m.round === 1 && m.is_bye),
): string {
  if (detail.bracket === 'round_robin') return roundName(round, rounds, detail.bracket)
  const custom = detail.round_names?.at(rounds - round)
  if (custom) return custom
  if (detail.bracket === 'double_elimination') return round === rounds ? 'Upper bracket final' : `Round ${round}`
  if (round === 1 && openingRound) return 'Opening round'
  return roundName(round, rounds, detail.bracket)
}

/** Lower-bracket rounds for an upper bracket of `size` first-round positions. */
export const loserRoundCount = (size: number) => Math.max(0, 2 * (Math.log2(size) - 1))

/** Matches in lower round `round`: the upper-round-1 losers pair up, then it halves every other round. */
export const loserMatchCount = (size: number, round: number) => size / 2 ** (Math.ceil(round / 2) + 1)

export function loserRoundTitle(round: number, rounds: number): string {
  return round === rounds ? 'Lower bracket final' : `Round ${round}`
}

/** "Group A" for group 1. */
export const groupName = (number: number) => `Group ${String.fromCharCode(64 + number)}`

/** What a match is called wherever it's shown on its own, e.g. "Semifinals", "Lower bracket round 2", "Grand final". */
export function matchTitle(
  detail: Titled,
  match: Pick<TournamentMatch, 'side' | 'round' | 'group_number'>,
  openingRound?: boolean,
): string {
  if (match.side === 'group') return `${groupName(match.group_number ?? 1)} · Round ${match.round}`
  if (match.side === 'final') return match.round === 1 ? 'Grand final' : 'Grand final reset'
  if (match.side === 'losers') {
    const rounds = loserRoundCount(2 ** detail.rounds)
    return match.round === rounds ? 'Lower bracket final' : `Lower bracket round ${match.round}`
  }
  const custom = detail.round_names?.at(detail.rounds - match.round)
  if (detail.bracket === 'double_elimination' && !custom && match.round < detail.rounds) {
    return `Upper bracket round ${match.round}`
  }
  return roundTitle(detail, match.round, undefined, openingRound)
}

/** The tournament as `bracket` sees it (see `BracketScope`). */
export function scopeBracket(detail: TournamentDetail, bracket: Bracket): BracketScope {
  const entries = entryById(detail)
  return {
    ...detail,
    group: bracket,
    matches: detail.matches.filter((m) => m.bracket_id === bracket.id),
    rounds: bracket.rounds,
    winner: (bracket.winner_id !== null ? entries.get(bracket.winner_id) : undefined) ?? null,
    draw: bracket.draw,
    opening: bracket.opening,
    round_names: bracket.round_names,
  }
}

export function TournamentBadge({ tournament, className }: { tournament: TournamentSummary; className?: string }) {
  if (tournament.avatar_url) {
    return (
      <img
        src={tournament.avatar_url}
        alt=""
        className={cn('size-12 shrink-0 rounded-xl bg-muted object-cover', className)}
      />
    )
  }
  return (
    <span
      className={cn(
        'grid size-12 shrink-0 place-items-center rounded-xl text-white',
        tournament.status === 'completed'
          ? 'bg-gradient-to-br from-amber-400 to-amber-600'
          : tournament.club
            ? CLUB_BG[tournament.club.color]
            : 'brand-gradient',
        className,
      )}
    >
      <Trophy className="size-1/2" />
    </span>
  )
}

export const GROUP_STAGE_INFO: Record<GroupStage, { label: string; hint: string }> = {
  single: { label: 'Single round robin', hint: 'Everyone plays each player in their group once.' },
  double: { label: 'Double round robin', hint: 'Everyone plays each player in their group twice, home and away.' },
}

/** Live and still in the elimination stage's groups. */
export const inGroupStage = (t: Pick<TournamentSummary, 'status' | 'stage'>) =>
  t.status === 'in_progress' && t.stage === 'groups'

/** Brackets can still be made and drawn: before the start, or during the elimination stage. */
export const isDrawing = (t: Pick<TournamentSummary, 'status' | 'stage'>) =>
  t.status === 'registration' || inGroupStage(t)

/** Who can go in a bracket: everyone, or only those moving on when there's an elimination stage. */
export function bracketEntries(detail: TournamentDetail): Array<TournamentEntry> {
  return detail.group_stage ? detail.entries.filter((e) => e.advanced) : detail.entries
}

/**
 * The organizer can enter a result once both sides are known. Elimination-stage results are final once the
 * bracket starts, and the bracket's matches don't exist until then.
 */
export function canEditMatch(detail: TournamentDetail, match: TournamentMatch): boolean {
  if (!detail.can_manage || detail.status === 'registration' || match.is_bye || !match.entry1_id || !match.entry2_id) {
    return false
  }
  return (match.side === 'group') === inGroupStage(detail)
}

/** Standard seeding so the top seeds meet last and byes go to the highest seeds, e.g. 8 → 1,8,4,5,2,7,3,6. */
export function seedOrder(size: number): Array<number> {
  let order = [1]
  while (order.length < size) {
    const sum = order.length * 2 + 1
    order = order.flatMap((seed) => [seed, sum - seed])
  }
  return order
}

export function entryById(detail: TournamentDetail): Map<number, TournamentEntry> {
  return new Map(detail.entries.map((e) => [e.id, e]))
}

/** Replace the cached tournament page and refresh the lists it appears in. */
export function storeTournament(qc: QueryClient, detail: TournamentDetail): void {
  qc.setQueryData(tournamentKey(detail.slug), detail)
  refreshTournamentLists(qc)
}

export function refreshTournamentLists(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: TOURNAMENTS_KEY })
  void qc.invalidateQueries({ queryKey: ['club'] })
}
