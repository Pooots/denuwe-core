import { useState } from 'react'
import { Crown } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Embedding } from '@/components/tournaments/BracketBoard'
import type { BracketScope, MatchSide, TournamentMatch } from '@/types/tournament'
import {
  BOX_H,
  COL_W,
  GAP,
  HEAD,
  MatchSlot,
  SlotBox,
  TrophyBadge,
  UNIT,
  columnX,
  elbowLines,
  knockoutGeometry,
  wonSide,
} from '@/components/tournaments/BracketBoard'
import { entryById, loserMatchCount, loserRoundCount, loserRoundTitle } from '@/components/tournaments/tournamentUi'
import { cn } from '@/lib/utils'

const labelClass = 'absolute truncate text-center text-[11px] font-bold tracking-[0.08em] text-brand-navy/60 uppercase'

/** Height of the "UPPER BRACKET" / "LOWER BRACKET" titles across the board. */
const TITLE_H = 40

function matchMap(scope: BracketScope, side: MatchSide): Map<string, TournamentMatch> {
  return new Map(scope.matches.filter((m) => m.side === side).map((m) => [`${m.round}-${m.position}`, m]))
}

/**
 * Slot centres per lower-bracket round. Round 1 is evenly spaced; a round where players drop in from the upper
 * bracket keeps each survivor level with the match they came from, the newcomer just below.
 */
function lowerColumns(size: number): Array<Array<number>> {
  const columns: Array<Array<number>> = []
  for (let round = 1; round <= loserRoundCount(size); round++) {
    const prev = columns.at(-1) ?? []
    const middle = (match: number) => (prev[match * 2] + prev[match * 2 + 1]) / 2
    columns.push(
      Array.from({ length: loserMatchCount(size, round) * 2 }, (_, i) => {
        if (round === 1) return HEAD + (i + 0.5) * UNIT
        if (round % 2 === 1) return middle(i)
        return i % 2 === 0 ? middle(i / 2) : middle((i - 1) / 2) + UNIT
      }),
    )
  }
  return columns
}

const lowerHeight = (columns: Array<Array<number>>) => Math.max(...columns.flat()) + BOX_H / 2 + 12

/**
 * Where everyone gets a second chance. Upper round 1 losers pair up; after that each round the survivors either
 * meet the next players dropping down from the upper bracket, or each other.
 */
function LowerBracket({
  scope,
  size,
  byes,
  onOpen,
}: {
  scope: BracketScope
  size: number
  byes?: ReadonlySet<number>
  onOpen?: (match: TournamentMatch) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const rounds = loserRoundCount(size)
  const entries = entryById(scope)
  const matches = matchMap(scope, 'losers')
  const upperRounds = Math.log2(size)
  const columns = lowerColumns(size)

  /** Short name of the upper round someone drops from, e.g. "upper R2" or the organizer's name for it. */
  const upperName = (round: number) =>
    scope.round_names.at(upperRounds - round) ?? (round === upperRounds ? 'upper final' : `upper R${round}`)
  const dropFrom = (round: number, position: number) =>
    size / 2 ** round > 1 ? `Loser, ${upperName(round)} #${position + 1}` : `Loser, ${upperName(round)}`
  const placeholder = (round: number, index: number) => {
    const match = Math.floor(index / 2)
    if (round === 1) {
      const pair = match * 2 + (index % 2)
      return byes?.has(pair) ? 'Bye' : dropFrom(1, pair)
    }
    if (round % 2 === 0 && index % 2 === 1) return dropFrom(round / 2 + 1, loserMatchCount(size, round) - 1 - match)
    return 'TBD'
  }

  const cells: Array<ReactNode> = []
  const lines: Array<ReactNode> = []
  columns.forEach((ys, column) => {
    const round = column + 1
    ys.forEach((y, index) => {
      cells.push(
        <div
          key={`slot-${round}-${index}`}
          className="absolute"
          style={{ left: columnX(column), top: y - BOX_H / 2, width: COL_W, height: BOX_H }}
        >
          <MatchSlot
            detail={scope}
            entries={entries}
            match={matches.get(`${round}-${Math.floor(index / 2)}`)}
            side={index % 2 === 0 ? 0 : 1}
            placeholder={placeholder(round, index)}
            hovered={hovered}
            onHover={setHovered}
            onOpen={onOpen}
          />
        </div>,
      )
    })
    for (let match = 0; match < ys.length / 2; match++) {
      lines.push(
        ...elbowLines(
          `${round}-${match}`,
          columnX(column) + COL_W,
          ys[match * 2],
          ys[match * 2 + 1],
          wonSide(matches.get(`${round}-${match}`)),
        ),
      )
    }
  })

  return (
    <div className="relative" style={{ width: columnX(rounds - 1) + COL_W + GAP, height: lowerHeight(columns) }}>
      {columns.map((_, column) => (
        <p key={column} className={cn(labelClass, 'top-1')} style={{ left: columnX(column), width: COL_W }}>
          {loserRoundTitle(column + 1, rounds)}
        </p>
      ))}
      {lines}
      {cells}
    </div>
  )
}

function SectionTitle({ top, width, note, children }: { top: number; width: number; note?: string; children: string }) {
  return (
    <div
      className="absolute left-0 flex items-end gap-3 border-b-2 border-brand-navy/15 pb-1.5"
      style={{ top, width, height: TITLE_H - 6 }}
    >
      <h3 className="shrink-0 text-[18px] leading-none font-black tracking-tight whitespace-nowrap text-brand-navy uppercase">
        {children}
      </h3>
      {note ? (
        <p title={note} className="min-w-0 truncate text-xs text-muted-foreground">
          {note}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A double-elimination bracket on one board: the upper bracket on top, the lower bracket under it, and the grand
 * final on the right where both bracket champions meet. If the lower bracket's champion wins it, both have lost
 * once and a reset match decides it.
 */
export function DoubleBoard({
  scope,
  size,
  byes,
  previewByes,
  renderUpper,
  onOpen,
}: {
  scope: BracketScope
  /** First-round positions in the upper bracket. */
  size: number
  /** Upper first-round pairs that are byes (they aren't drawn). */
  byes: ReadonlySet<number>
  /** Before the start: the same byes, so the lower bracket can show who never drops down. */
  previewByes?: ReadonlySet<number>
  /** The upper bracket canvas, placed on this board. */
  renderUpper: (embedding: Embedding) => ReactNode
  onOpen?: (match: TournamentMatch) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const entries = entryById(scope)
  const upper = knockoutGeometry(size, byes)
  const lowerRounds = loserRoundCount(size)
  const columns = lowerColumns(size)
  const finalColumn = Math.max(upper.columns - 1, lowerRounds - 1)
  const upperFinalMatches = matchMap(scope, 'winners')
  const lowerMatches = matchMap(scope, 'losers')
  const finals = matchMap(scope, 'final')
  const first = finals.get('1-0')
  const reset = finals.get('2-0')
  const games = reset ? [first, reset] : [first]

  const upperTop = TITLE_H
  const upperHeight = HEAD + upper.rows * UNIT + 12
  const lowerTitleTop = upperTop + upperHeight + 8
  const lowerTop = lowerTitleTop + TITLE_H
  const sectionWidth = columnX(finalColumn) + COL_W

  const yUpper = upperTop + (upper.y(upper.rounds - 1, 0) + upper.y(upper.rounds - 1, 1)) / 2
  const lastLower = columns.at(-1)
  const yLower = lastLower ? lowerTop + (lastLower[0] + lastLower[1]) / 2 : null
  const middle = yLower !== null ? (yUpper + yLower) / 2 : yUpper + UNIT
  const top = middle - UNIT / 2
  const bottom = middle + UNIT / 2

  /** Both finals' lines come out at the same x, then bend into the grand final's two slots. */
  const out = columnX(finalColumn) + COL_W + GAP
  const finalX = out + GAP
  const gameX = (i: number) => finalX + i * (COL_W + GAP)
  const championX = gameX(games.length)
  const line = (on: boolean) => (on ? 'z-[1] border-brand-green' : 'border-brand-navy/20')
  const upperDone = upperFinalMatches.get(`${upper.rounds}-0`)?.completed === true
  const lowerFinal = lowerMatches.get(`${lowerRounds}-0`)
  const lowerDone = lowerFinal?.completed === true && lowerFinal.winner_id !== null
  const lowerOut = columnX(lowerRounds - 1) + COL_W + GAP
  const champion = scope.winner

  const height = Math.max(
    yLower !== null ? lowerTop + lowerHeight(columns) : upperTop + upperHeight,
    middle + BOX_H / 2 + 12 + 48 + 12,
  )

  return (
    <div className="overflow-x-auto pb-1">
      <div className="relative mx-auto" style={{ width: championX + COL_W, height }}>
        <SectionTitle top={0} width={sectionWidth}>
          Upper bracket
        </SectionTitle>
        <div className="absolute left-0" style={{ top: upperTop }}>
          {renderUpper({ bare: true, finalColumn })}
        </div>

        {yLower !== null ? (
          <>
            <SectionTitle
              top={lowerTitleTop}
              width={sectionWidth}
              note="Lose once and you drop here. Lose again and you’re out."
            >
              Lower bracket
            </SectionTitle>
            <div className="absolute left-0" style={{ top: lowerTop }}>
              <LowerBracket scope={scope} size={size} byes={previewByes} onOpen={onOpen} />
            </div>
            {lowerOut < out ? (
              <span
                aria-hidden
                className={cn('absolute h-0.5', lowerDone ? 'z-[1] bg-brand-green' : 'bg-brand-navy/20')}
                style={{ left: lowerOut, top: yLower - 1, width: out - lowerOut }}
              />
            ) : null}
            <span
              aria-hidden
              className={cn('absolute rounded-br-lg border-r-2 border-b-2', line(lowerDone))}
              style={{ left: out, top: bottom, width: GAP / 2, height: yLower - bottom + 1 }}
            />
            <span
              aria-hidden
              className={cn('absolute h-0.5', lowerDone ? 'z-[1] bg-brand-green' : 'bg-brand-navy/20')}
              style={{ left: out + GAP / 2, top: bottom - 1, width: GAP / 2 }}
            />
          </>
        ) : (
          <p
            className="absolute left-0 text-xs text-muted-foreground"
            style={{ top: lowerTitleTop, width: sectionWidth }}
          >
            With two {scope.format === 'team' ? 'teams' : 'players'}, whoever loses the first match gets a second chance
            in the grand final.
          </p>
        )}

        <span
          aria-hidden
          className={cn('absolute rounded-tr-lg border-t-2 border-r-2', line(upperDone))}
          style={{ left: out, top: yUpper - 1, width: GAP / 2, height: top - yUpper + 1 }}
        />
        <span
          aria-hidden
          className={cn('absolute h-0.5', upperDone ? 'z-[1] bg-brand-green' : 'bg-brand-navy/20')}
          style={{ left: out + GAP / 2, top: top - 1, width: GAP / 2 }}
        />

        {[...games.map((_, i) => (i === 0 ? 'Grand final' : 'Reset match')), 'Champion'].map((label, column) => (
          <p
            key={label}
            className={labelClass}
            style={{ left: gameX(column), top: top - BOX_H / 2 - 22, width: COL_W }}
          >
            {label}
          </p>
        ))}
        {games.map((match, column) => (
          <div key={column}>
            {elbowLines(`gf-${column}`, gameX(column) + COL_W, top, bottom, wonSide(match))}
            {[top, bottom].map((y, side) => (
              <div
                key={side}
                className="absolute"
                style={{ left: gameX(column), top: y - BOX_H / 2, width: COL_W, height: BOX_H }}
              >
                <MatchSlot
                  detail={scope}
                  entries={entries}
                  match={match}
                  side={side === 0 ? 0 : 1}
                  placeholder={
                    column > 0
                      ? 'TBD'
                      : side === 0
                        ? 'Upper bracket champion'
                        : yLower !== null
                          ? 'Lower bracket champion'
                          : 'Loser of the upper final'
                  }
                  hovered={hovered}
                  onHover={setHovered}
                  onOpen={onOpen}
                />
              </div>
            ))}
          </div>
        ))}
        <div className="absolute" style={{ left: championX, top: middle - BOX_H / 2, width: COL_W, height: BOX_H }}>
          <SlotBox entry={champion} placeholder="To be decided" tone={champion ? 'champion' : 'empty'}>
            {champion ? <Crown className="mr-2 size-4 shrink-0 text-amber-500" /> : null}
          </SlotBox>
        </div>
        <div
          className="absolute flex justify-center"
          style={{ left: championX, top: middle + BOX_H / 2 + 12, width: COL_W }}
        >
          <TrophyBadge won={champion !== null} />
        </div>
      </div>
    </div>
  )
}
