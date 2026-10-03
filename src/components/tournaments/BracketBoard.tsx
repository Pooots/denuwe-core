import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Crown, MoveHorizontal, Pencil, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import type { BracketScope, TournamentDetail, TournamentEntry, TournamentMatch } from '@/types/tournament'
import { Avatar } from '@/components/feed/Avatar'
import { toast } from '@/components/feed/Toaster'
import {
  bracketEntries,
  canEditMatch,
  entryById,
  roundTitle,
  seedOrder,
  storeTournament,
} from '@/components/tournaments/tournamentUi'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { tournamentService } from '@/services/tournamentService'

/** Slot width, the gap the connector lines run through, and the height each first-round slot gets. */
export const COL_W = 200
export const GAP = 48
export const UNIT = 54
export const BOX_H = 40
export const HEAD = 34
export const FOOT = 70

export const columnX = (column: number) => column * (COL_W + GAP)

/**
 * The lines from a match's two slots (centres `top` and `bottom`, right edges at `left`) out to the slot it feeds,
 * `reach` further right. `won` colours the winner's side.
 */
export function elbowLines(
  key: string,
  left: number,
  top: number,
  bottom: number,
  won: 0 | 1 | null,
  reach = GAP,
): Array<ReactNode> {
  const middle = (top + bottom) / 2
  const line = (on: boolean) => (on ? 'z-[1] border-brand-green' : 'border-brand-navy/20')
  return [
    <span
      key={`top-${key}`}
      aria-hidden
      className={cn('absolute rounded-tr-lg border-t-2 border-r-2', line(won === 0))}
      style={{ left, top: top - 1, width: GAP / 2, height: middle - top + 1 }}
    />,
    <span
      key={`bottom-${key}`}
      aria-hidden
      className={cn('absolute rounded-br-lg border-r-2 border-b-2', line(won === 1))}
      style={{ left, top: middle, width: GAP / 2, height: bottom - middle + 1 }}
    />,
    <span
      key={`out-${key}`}
      aria-hidden
      className={cn('absolute h-0.5', won === null ? 'bg-brand-navy/20' : 'z-[1] bg-brand-green')}
      style={{ left: left + GAP / 2, top: middle - 1, width: reach - GAP / 2 }}
    />,
  ]
}

/** Which side of a played match went through, to colour its line. */
export function wonSide(match: TournamentMatch | undefined): 0 | 1 | null {
  if (!match?.completed || match.is_bye || match.winner_id === null) return null
  return match.winner_id === match.entry1_id ? 0 : 1
}

/** One side of a match in a bracket; organizers click it to enter the result. */
export function MatchSlot({
  detail,
  entries,
  match,
  side,
  placeholder,
  hovered,
  onHover,
  onOpen,
}: {
  detail: TournamentDetail
  entries: Map<number, TournamentEntry>
  match: TournamentMatch | undefined
  side: 0 | 1
  placeholder: string
  hovered: number | null
  onHover: (matchId: number | null) => void
  onOpen?: (match: TournamentMatch) => void
}) {
  if (!match) return <SlotBox entry={null} placeholder={placeholder} tone="empty" />
  const id = side === 0 ? match.entry1_id : match.entry2_id
  const entry = (id !== null ? entries.get(id) : undefined) ?? null
  const decided = match.completed && !match.is_bye
  const box = (
    <SlotBox
      entry={entry}
      placeholder={match.completed ? 'Bye' : placeholder}
      score={side === 0 ? match.score1 : match.score2}
      tone={!entry ? 'empty' : decided ? (match.winner_id === id ? 'won' : 'lost') : 'pending'}
      mine={id !== null && id === detail.my_entry_id}
      active={hovered === match.id}
    />
  )
  if (!onOpen || !canEditMatch(detail, match)) return box
  return (
    <button
      type="button"
      title={match.completed ? 'Edit result' : 'Enter result'}
      onClick={() => onOpen(match)}
      onMouseEnter={() => onHover(match.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(match.id)}
      onBlur={() => onHover(null)}
      className="group relative block size-full rounded-lg"
    >
      {box}
      <span className="absolute top-1/2 -right-2.5 z-[2] hidden -translate-y-1/2 rounded-full bg-brand-blue p-1 text-white shadow group-hover:block group-focus-visible:block">
        <Pencil className="size-3" />
      </span>
    </button>
  )
}

/** The trophy under the champion's box. */
export function TrophyBadge({ won }: { won: boolean }) {
  return (
    <span
      className={cn(
        'grid size-12 place-items-center rounded-full text-white',
        won ? 'brand-gradient shadow-[0_6px_16px_rgba(42,107,214,0.35)]' : 'bg-brand-navy/15',
      )}
    >
      <Trophy className="size-6" />
    </span>
  )
}

export type SlotTone = 'pending' | 'won' | 'lost' | 'empty' | 'champion'

const BAR: Record<SlotTone, string> = {
  pending: 'bg-brand-navy',
  won: 'bg-brand-green',
  lost: 'bg-ink/15',
  empty: 'bg-brand-navy/15',
  champion: 'bg-gradient-to-b from-brand-green to-brand-sky',
}

export function EntryAvatar({ entry, className }: { entry: TournamentEntry; className?: string }) {
  const solo = entry.team_name === null ? entry.members.at(0) : undefined
  return (
    <Avatar
      name={entry.name}
      src={solo?.avatar_url ?? null}
      className={cn('size-6 text-[9px]', entry.team_name !== null && '[&>span]:rounded-md', className)}
    />
  )
}

export function SlotBox({
  entry,
  placeholder,
  score,
  tone,
  mine,
  active,
  className,
  children,
}: {
  entry: TournamentEntry | null
  placeholder: string
  score?: number | null
  tone: SlotTone
  mine?: boolean
  active?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex size-full items-center overflow-hidden rounded-lg border text-left transition',
        entry || tone === 'champion'
          ? 'border-[#dde2ea] bg-white shadow-[0_1px_2px_rgba(30,58,138,0.08)]'
          : 'border-dashed border-brand-navy/20 bg-white/50',
        tone === 'lost' && 'bg-[#f6f7f9]',
        tone === 'champion' && 'border-brand-green/40 ring-2 ring-brand-green/15',
        mine && 'ring-2 ring-brand-blue/40',
        active && 'border-brand-blue ring-2 ring-brand-blue/25',
        className,
      )}
    >
      <span className={cn('h-full w-1.5 shrink-0', BAR[tone])} />
      {entry ? <EntryAvatar entry={entry} className={cn('ml-2', tone === 'lost' && 'opacity-50')} /> : null}
      <span
        className={cn(
          'min-w-0 flex-1 truncate px-2',
          entry
            ? cn('text-[12px] font-bold tracking-wide uppercase', tone === 'lost' ? 'text-ink/40' : 'text-ink')
            : 'text-[12px] text-muted-foreground italic',
        )}
      >
        {entry ? entry.name : placeholder}
      </span>
      {mine ? (
        <span className="mr-1.5 shrink-0 rounded bg-brand-blue/10 px-1 text-[9px] font-bold text-brand-blue">YOU</span>
      ) : null}
      {score !== undefined && score !== null ? (
        <span
          className={cn(
            'grid h-full w-9 shrink-0 place-items-center border-l border-[#e6e9ef] text-[13px] font-bold tabular-nums',
            tone === 'won' ? 'bg-brand-green/10 text-brand-green' : 'text-ink/45',
          )}
        >
          {score}
        </span>
      ) : null}
      {children}
    </div>
  )
}

/** Big title with the accent bar (the bracket's name, or "Tournament bracket"), plus room for actions on the right. */
export function BracketHeading({ title, note, children }: { title?: string; note?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-none sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-11 w-1.5 shrink-0 rounded-full bg-brand-green" aria-hidden />
          <div className="min-w-0">
            {title ? (
              <h2 className="line-clamp-2 max-w-[420px] text-[18px] leading-tight font-black tracking-tight break-words text-brand-navy uppercase sm:truncate sm:text-[20px]">
                {title}
              </h2>
            ) : (
              <h2 className="text-[18px] leading-[1.05] font-black tracking-tight text-brand-navy uppercase sm:text-[20px]">
                Tournament
                <br />
                Bracket
              </h2>
            )}
          </div>
        </div>
        {note ? <div className="max-w-[340px] text-xs text-muted-foreground sm:ml-2">{note}</div> : null}
      </div>
      {children ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{children}</div> : null}
    </div>
  )
}

/** Dotted board the bracket sits on. */
export function BracketBoard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#f3f6fb] bg-[radial-gradient(#d6dff0_1px,transparent_1px)] [background-size:18px_18px] p-3 sm:p-4">
      <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-ink/50 sm:hidden">
        <MoveHorizontal className="size-3.5" /> Swipe sideways to see every round
      </p>
      {children}
    </div>
  )
}

/**
 * Where everything sits in a knockout bracket of `size` first-round positions. `finalColumn` moves the final out
 * to that column (the lines from the semifinals stretch to reach it), to line it up with another bracket.
 */
export function knockoutGeometry(size: number, byes?: ReadonlySet<number>, finalColumn?: number) {
  const rounds = Math.log2(size)
  /** When every first-round match is a bye there's nothing to show in that round. */
  const skip = byes !== undefined && byes.size === size / 2 ? 1 : 0
  const x = (column: number) =>
    column === rounds - 1 && finalColumn !== undefined ? columnX(finalColumn) : columnX(column - skip)
  /** Each round doubles the spacing, so a slot sits halfway between the two it's fed from. */
  const y = (column: number, index: number) => HEAD + (index + 0.5) * UNIT * 2 ** (column - skip)
  return { rounds, skip, x, y, rows: size / 2 ** skip, columns: rounds - skip }
}

/**
 * Lays out a knockout bracket of `size` first-round positions: each column halves until the champion, with lines
 * joining every pair to the slot they feed. First-round pairs in `byes` aren't drawn; whoever has the bye is
 * shown straight in the second round. `renderSlot` draws what goes in each slot.
 */
export function BracketCanvas({
  size,
  labels,
  defaultLabels,
  onRename,
  champion,
  finale = 'champion',
  bare = false,
  finalColumn,
  byes,
  advanced,
  renderSlot,
  renderOpeningTool,
  renderByeSpot,
}: {
  size: number
  /** One per round, then the champion column. */
  labels: Array<string>
  /** The usual round names, shown as the placeholder while renaming. */
  defaultLabels?: Array<string>
  /** Organizers rename a round's column (null = back to the usual name). */
  onRename?: (column: number, name: string | null) => void
  champion: TournamentEntry | null
  /** The last column: the champion with the trophy, or nothing (the final's winner goes on to a grand final). */
  finale?: 'champion' | 'none'
  /** Without its own scroll area, for a board that places it next to other parts. */
  bare?: boolean
  /** Column the final is drawn in (see `knockoutGeometry`). */
  finalColumn?: number
  byes?: ReadonlySet<number>
  /** Which side of a pair went through (0 top, 1 bottom), to colour its line. */
  advanced?: (column: number, pair: number) => 0 | 1 | null
  renderSlot: (column: number, index: number) => ReactNode
  /** Drawn on the elbow where an opening match's lines meet. */
  renderOpeningTool?: (pair: number) => ReactNode
  /** Drawn in the opening round where a bye pair would be. */
  renderByeSpot?: (pair: number) => ReactNode
}) {
  const { rounds, skip, x, y, rows } = knockoutGeometry(size, byes, finalColumn)
  const hidden = (column: number, pair: number) => column === 0 && byes?.has(pair) === true
  const cells: Array<ReactNode> = []
  const lines: Array<ReactNode> = []

  if (skip === 0) {
    for (let pair = 0; pair < size / 2; pair++) {
      const top = y(0, pair * 2)
      const bottom = y(0, pair * 2 + 1)
      const spot = hidden(0, pair) ? renderByeSpot?.(pair) : renderOpeningTool?.(pair)
      if (!spot) continue
      cells.push(
        hidden(0, pair) ? (
          <div
            key={`bye-${pair}`}
            className="absolute"
            style={{ left: x(0), top: top - BOX_H / 2, width: COL_W, height: bottom - top + BOX_H }}
          >
            {spot}
          </div>
        ) : (
          <div
            key={`tool-${pair}`}
            className="absolute z-[3] -translate-x-1/2 -translate-y-1/2"
            style={{ left: x(0) + COL_W + GAP / 2, top: (top + bottom) / 2 }}
          >
            {spot}
          </div>
        ),
      )
    }
  }

  for (let column = skip; column < rounds; column++) {
    const count = size / 2 ** column
    for (let index = 0; index < count; index++) {
      if (hidden(column, Math.floor(index / 2))) continue
      cells.push(
        <div
          key={`slot-${column}-${index}`}
          className="absolute"
          style={{ left: x(column), top: y(column, index) - BOX_H / 2, width: COL_W, height: BOX_H }}
        >
          {renderSlot(column, index)}
        </div>,
      )
    }
    for (let pair = 0; pair < count / 2; pair++) {
      if (hidden(column, pair)) continue
      lines.push(
        ...elbowLines(
          `${column}-${pair}`,
          x(column) + COL_W,
          y(column, pair * 2),
          y(column, pair * 2 + 1),
          advanced?.(column, pair) ?? null,
          column + 1 < rounds ? x(column + 1) - x(column) - COL_W : GAP,
        ),
      )
    }
  }

  const championY = y(rounds, 0)
  const crowned = finale === 'champion'
  const canvas = (
    <div
      className={cn('relative', !bare && 'mx-auto')}
      style={{
        width: crowned ? x(rounds) + COL_W : x(rounds - 1) + COL_W + GAP,
        height: HEAD + rows * UNIT + (crowned ? FOOT : 12),
      }}
    >
      {labels.map((label, column) =>
        column < skip || (!crowned && column >= rounds) ? null : (
          <div key={column} className="absolute top-0 h-6" style={{ left: x(column), width: COL_W }}>
            <RoundLabel
              key={label}
              text={label}
              placeholder={defaultLabels?.[column] ?? label}
              onSave={onRename && column < rounds ? (name) => onRename(column, name) : undefined}
            />
          </div>
        ),
      )}
      {lines}
      {cells}
      {crowned ? (
        <>
          <div
            className="absolute"
            style={{ left: x(rounds), top: championY - BOX_H / 2, width: COL_W, height: BOX_H }}
          >
            <SlotBox entry={champion} placeholder="To be decided" tone={champion ? 'champion' : 'empty'}>
              {champion ? <Crown className="mr-2 size-4 shrink-0 text-amber-500" /> : null}
            </SlotBox>
          </div>
          <div
            className="absolute flex justify-center"
            style={{ left: x(rounds), top: championY + BOX_H / 2 + 12, width: COL_W }}
          >
            <TrophyBadge won={champion !== null} />
          </div>
        </>
      ) : null}
    </div>
  )

  return bare ? canvas : <div className="overflow-x-auto pb-1">{canvas}</div>
}

const labelText = 'text-[11px] font-bold tracking-[0.08em] text-brand-navy/60 uppercase'

/** A column title; organizers click it to rename the round. */
function RoundLabel({
  text,
  placeholder,
  onSave,
}: {
  text: string
  placeholder: string
  onSave?: (name: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(text)

  if (!onSave) return <p className={cn('mt-1 truncate text-center', labelText)}>{text}</p>

  if (editing) {
    const commit = () => {
      setEditing(false)
      const name = value.trim()
      const next = name === '' || name.toLowerCase() === placeholder.toLowerCase() ? null : name
      if ((next ?? placeholder) !== text) onSave(next)
    }
    return (
      <input
        autoFocus
        value={value}
        maxLength={40}
        placeholder={placeholder}
        aria-label={`Name for ${text}`}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setValue(text)
            setEditing(false)
          }
        }}
        className={cn(
          'h-6 w-full rounded-md border border-brand-blue bg-white px-2 text-center ring-2 ring-brand-blue/20 outline-none',
          labelText,
          'text-brand-navy normal-case placeholder:uppercase',
        )}
      />
    )
  }

  return (
    <button
      type="button"
      title="Rename this round"
      aria-label={`Rename ${text}`}
      onClick={() => {
        setValue(text)
        setEditing(true)
      }}
      className={cn(
        'group flex h-6 w-full items-center justify-center gap-1 rounded-md transition hover:bg-white/80 hover:text-brand-navy',
        labelText,
      )}
    >
      <span className="truncate">{text}</span>
      <Pencil className="size-3 shrink-0 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  )
}

/** Column titles for a bracket of `size` positions: custom names first, then the usual ones. */
function bracketTitles(scope: BracketScope, size: number, openingRound: boolean) {
  const rounds = Math.log2(size)
  const titles = (custom: boolean) => [
    ...Array.from({ length: rounds }, (_, i) =>
      roundTitle(custom ? scope : { ...scope, round_names: [] }, i + 1, rounds, openingRound),
    ),
    'Champion',
  ]
  return { labels: titles(true), defaultLabels: titles(false) }
}

/** Saves a renamed round straight away; undefined for people who can't manage the tournament. */
function useRenameRound(scope: BracketScope, size: number) {
  const qc = useQueryClient()
  const rename = useMutation({
    mutationFn: (names: Array<string | null>) => tournamentService.saveRoundNames(scope.id, scope.group.id, names),
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })
  if (!scope.can_manage) return undefined

  const rounds = Math.log2(size)
  return (column: number, name: string | null) => {
    const back = rounds - (column + 1)
    const names = Array.from({ length: Math.max(scope.round_names.length, back + 1) }, (_, i) =>
      i === back ? name : (scope.round_names.at(i) ?? null),
    )
    rename.mutate(names)
  }
}

/** How a knockout canvas fits on a double-elimination board (see `DoubleBoard`). */
export type Embedding = { bare: true; finalColumn: number }

/**
 * The live knockout bracket (the upper bracket in double elimination, where the final's winner goes on to the
 * grand final instead of taking the trophy). Organizers click a match to enter its result.
 */
export function EliminationBracket({
  scope,
  onOpen,
  embedding,
}: {
  scope: BracketScope
  onOpen?: (match: TournamentMatch) => void
  embedding?: Embedding
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const entries = entryById(scope)
  const winners = scope.matches.filter((m) => m.side === 'winners')
  const matches = new Map(winners.map((m) => [`${m.round}-${m.position}`, m]))
  const matchAt = (column: number, pair: number) => matches.get(`${column + 1}-${pair}`)
  const size = 2 ** scope.rounds
  const byes = upperByes(scope)
  const rename = useRenameRound(scope, size)

  return (
    <BracketCanvas
      size={size}
      {...bracketTitles(scope, size, byes.size > 0)}
      onRename={rename}
      champion={scope.winner}
      finale={scope.bracket === 'double_elimination' ? 'none' : 'champion'}
      {...embedding}
      byes={byes}
      advanced={(column, pair) => wonSide(matchAt(column, pair))}
      renderSlot={(column, index) => (
        <MatchSlot
          detail={scope}
          entries={entries}
          match={matchAt(column, Math.floor(index / 2))}
          side={index % 2 === 0 ? 0 : 1}
          placeholder="TBD"
          hovered={hovered}
          onHover={setHovered}
          onOpen={onOpen}
        />
      )}
    />
  )
}

/** Upper-bracket first-round matches that were byes, by position. */
export function upperByes(scope: BracketScope): Set<number> {
  return new Set(scope.matches.filter((m) => m.side === 'winners' && m.round === 1 && m.is_bye).map((m) => m.position))
}

/** Before the start: the organizer's draw (or empty slots), later rounds still to be played. */
export function DrawCanvas({
  scope,
  slots,
  opening = scope.opening ?? undefined,
  embedding,
  renderEntrySlot,
  renderOpeningTool,
  renderByeSpot,
}: {
  scope: BracketScope
  slots: Array<number | null>
  /** First-round pairs that play an opening match; the spread-out default if left out. */
  opening?: Array<number>
  embedding?: Embedding
  renderEntrySlot?: (index: number) => ReactNode
  renderOpeningTool?: (pair: number) => ReactNode
  renderByeSpot?: (pair: number) => ReactNode
}) {
  const entries = entryById(scope)
  const layout = bracketLayout(slots.length, opening)
  const byes = byePairs(layout)
  const rename = useRenameRound(scope, layout.length)
  const slotAt = (column: number, index: number) => {
    if (column === 0) return layout[index]
    if (column === 1 && byes.has(index)) return layout[index * 2] ?? layout[index * 2 + 1]
    return null
  }

  return (
    <BracketCanvas
      size={layout.length}
      {...bracketTitles(scope, layout.length, byes.size > 0)}
      onRename={rename}
      champion={null}
      finale={scope.bracket === 'double_elimination' ? 'none' : 'champion'}
      {...embedding}
      byes={byes}
      renderOpeningTool={renderOpeningTool}
      renderByeSpot={renderByeSpot}
      renderSlot={(column, index) => {
        const slot = slotAt(column, index)
        if (slot === null) return <SlotBox entry={null} placeholder="" tone="empty" />
        if (renderEntrySlot) return renderEntrySlot(slot)
        const id = slots[slot]
        const entry = (id !== null ? entries.get(id) : undefined) ?? null
        return (
          <SlotBox
            entry={entry}
            placeholder="Open slot"
            tone={entry ? 'pending' : 'empty'}
            mine={id !== null && id === scope.my_entry_id}
          />
        )
      }}
    />
  )
}

export const MAX_BRACKET = 128

/** Positions in a full first round with room for `slots`: the next power of two, at least 2. */
export const fullSize = (slots: number) => 2 ** Math.ceil(Math.log2(Math.max(slots, 2)))

/** How many first-round pairs play an opening match in a bracket of `slots`; the rest are byes. */
export const openingCount = (slots: number) => slots - fullSize(slots) / 2

/**
 * Opening matches spread out like seeds past the field, so byes go to the top of each section, e.g. 10 slots →
 * pairs 1 and 5 play and six go straight into the quarterfinals.
 */
export function defaultOpening(slots: number): Array<number> {
  const order = seedOrder(fullSize(slots))
  return Array.from({ length: order.length / 2 }, (_, pair) => pair).filter(
    (pair) => Math.max(order[pair * 2], order[pair * 2 + 1]) <= slots,
  )
}

/**
 * Where each of `slots` bracket slots sits in the full first round: the slot index at each position, or null for
 * a bye. Pairs in `opening` play an opening match; every other pair is one slot with a bye into the next round.
 * Same as `TournamentBracket::layout` on the server.
 */
export function bracketLayout(slots: number, opening: Array<number> = defaultOpening(slots)): Array<number | null> {
  const playing = new Set(opening)
  let slot = 0
  return Array.from({ length: fullSize(slots) / 2 }, (_, pair) => [slot++, playing.has(pair) ? slot++ : null]).flat()
}

/** First-round pairs where one side is a bye. */
export function byePairs(layout: Array<number | null>): Set<number> {
  const pairs = new Set<number>()
  for (let pair = 0; pair < layout.length / 2; pair++) {
    if (layout[pair * 2] === null || layout[pair * 2 + 1] === null) pairs.add(pair)
  }
  return pairs
}

/**
 * Change which pairs play an opening match, keeping everyone where they are on the board: the second player of a
 * match that becomes a bye moves to the newly opened match.
 */
export function reshapeDraw(slots: Array<number | null>, from: Array<number>, to: Array<number>): Array<number | null> {
  const positions = bracketLayout(slots.length, from).map((slot) => (slot === null ? null : slots[slot]))
  const removed = from.filter((pair) => !to.includes(pair))
  const added = to.filter((pair) => !from.includes(pair))
  const displaced = removed.map((pair) => positions[pair * 2 + 1])
  removed.forEach((pair) => (positions[pair * 2 + 1] = null))
  added.forEach((pair, i) => (positions[pair * 2 + 1] = displaced.at(i) ?? null))

  const next = Array<number | null>(slots.length).fill(null)
  bracketLayout(slots.length, to).forEach((slot, position) => {
    if (slot !== null) next[slot] = positions[position]
  })
  return next
}

/** Slots in the order a shuffle fills them: one in every first-round match first, then the opponents. */
export function fillOrder(slots: number, opening: Array<number>): Array<number> {
  const layout = bracketLayout(slots, opening)
  const firsts = layout.filter((_, position) => position % 2 === 0)
  const seconds = layout.filter((slot, position) => position % 2 === 1 && slot !== null)
  return [...firsts, ...seconds].filter((slot) => slot !== null)
}

/** All the slots the brackets have together, and how many more a new bracket could have. */
export function bracketRoom(detail: TournamentDetail, except?: number) {
  const used = detail.brackets.filter((b) => b.id !== except).reduce((sum, b) => sum + b.size, 0)
  return { used, left: MAX_BRACKET - used }
}

/**
 * What would stop the tournament from starting with these brackets, or null. Anyone not placed goes into an open
 * slot in any bracket, filling empty first-round matches first (same as the server). `draft` swaps in a bracket's
 * unsaved slots while the organizer edits it.
 */
export function startIssue(
  detail: TournamentDetail,
  draft?: { bracketId: number; slots: Array<number | null>; opening: Array<number> },
): string | null {
  const brackets = detail.brackets.map((b) =>
    b.id === draft?.bracketId ? { ...b, draw: draft.slots, opening: draft.opening } : b,
  )
  if (brackets.length === 0) return null
  const several = brackets.length > 1
  const pool = bracketEntries(detail)
  const count = pool.length
  const words = detail.format === 'team' ? 'teams' : 'players'
  const total = brackets.reduce((sum, b) => sum + b.size, 0)
  const are = detail.group_stage ? 'are moving on' : 'are in'
  if (count > total)
    return several
      ? `${count} ${words} ${are} but the brackets have ${total} slots. Make one bigger or create another before you start.`
      : `${count} ${words} ${are} but the bracket has ${total} slots. Make it bigger before you start.`

  const ids = new Set(pool.map((e) => e.id))
  const isIn = (id: number | null | undefined) => id !== null && id !== undefined && ids.has(id)
  let placed = 0
  let empty = 0
  let needed = 0
  for (const b of brackets) {
    const slots = b.draw ?? []
    placed += slots.filter(isIn).length
    const layout = bracketLayout(b.size, b.opening ?? undefined)
    for (let pair = 0; pair < layout.length / 2; pair++) {
      needed++
      const real = [layout[pair * 2], layout[pair * 2 + 1]].filter((slot) => slot !== null)
      if (!real.some((slot) => isIn(slots[slot]))) empty++
    }
  }
  if (empty <= count - placed) return null
  if (count >= needed)
    return `${empty === 1 ? 'A first-round match has' : `${empty} first-round matches have`} no one in it. Spread the ${words} out before you start.`
  return several
    ? `Your brackets need at least ${needed} ${words} so every first-round match has someone. Wait for more to join, or make a bracket smaller before you start.`
    : `A ${total}-slot bracket needs at least ${needed} ${words} so every first-round match has someone. Wait for more to join, or make it ${Math.max(2, count)} slots before you start.`
}
