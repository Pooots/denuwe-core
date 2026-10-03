import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CalendarPlus, Clock, Info, LoaderCircle, Pin, X } from 'lucide-react'
import type { GameDay, ScheduledGame, TournamentDetail, TournamentMatch } from '@/types/tournament'
import { plural } from '@/components/clubs/clubUi'
import { toast } from '@/components/feed/Toaster'
import { canEditMatch, entryById, matchTitle, storeTournament } from '@/components/tournaments/tournamentUi'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { tournamentService } from '@/services/tournamentService'

const MINUTE_CHOICES = [10, 15, 20, 30, 45, 60, 90, 120, 180]
const MAX_DAYS = 60
const MAX_GAMES_A_DAY = 200
const DEFAULT_GAMES_A_DAY = 8
/** Date and time inputs share one row on phones, so they get smaller text and picker icons there. */
const compactPicker =
  'max-sm:px-1.5 max-sm:text-[12px] max-sm:[&::-webkit-calendar-picker-indicator]:ml-0.5 max-sm:[&::-webkit-calendar-picker-indicator]:w-3.5'

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-10-10" as a local date. */
function parseDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const toDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** "Sat 10 Oct" */
const dayLabel = (date: string) =>
  parseDay(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** "13:30" → "1:30 pm"; past midnight wraps around. */
function clock(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(total / 60)
  return `${h % 12 || 12}:${pad(total % 60)} ${h < 12 ? 'am' : 'pm'}`
}

/** "Sat 10 Oct · 9:00 am", or null when the game isn't on a day. */
export const gameWhen = (game: Pick<ScheduledGame, 'date' | 'time'>) =>
  game.date && game.time ? `${dayLabel(game.date)} · ${clock(minutesOf(game.time))}` : null

/** The day after the last one (same start and games), or the tournament's start date for the first. */
function nextDay(detail: TournamentDetail, days: Array<GameDay>): GameDay {
  const last = days.at(-1)
  if (last) {
    const date = parseDay(last.date)
    date.setDate(date.getDate() + 1)
    return { date: toDay(date), start: last.start, games: last.games }
  }
  const starts = new Date(detail.starts_at)
  const games = Math.min(Math.max(detail.schedule.games.length, 1), DEFAULT_GAMES_A_DAY)
  return { date: toDay(starts), start: `${pad(starts.getHours())}:${pad(starts.getMinutes())}`, games }
}

/** What a game is called, e.g. "Group A · Round 1", "Men’s · Semifinals" or "Grand final". */
export function gameTitle(detail: TournamentDetail, game: ScheduledGame, games: Array<ScheduledGame>): string {
  if (game.side === 'group' || detail.bracket === 'round_robin') {
    return matchTitle({ bracket: detail.bracket, rounds: detail.rounds, matches: [] }, game)
  }
  const bracket = detail.brackets.find((b) => b.id === game.bracket_id)
  // A first round with fewer games than a full one has byes: the "Opening round".
  const firstRound = games.filter((g) => g.bracket_id === game.bracket_id && g.side === 'winners' && g.round === 1)
  const title = matchTitle(
    { bracket: detail.bracket, rounds: game.rounds, matches: [], round_names: bracket?.round_names ?? [] },
    game,
    firstRound.length < 2 ** (game.rounds - 1),
  )
  return bracket && detail.brackets.length > 1 ? `${bracket.name} · ${title}` : title
}

function GameRow({
  detail,
  game,
  title,
  onOpen,
}: {
  detail: TournamentDetail
  game: ScheduledGame
  title: string
  onOpen: (match: TournamentMatch) => void
}) {
  const qc = useQueryClient()
  const move = useMutation({
    mutationFn: (date: string | null) => tournamentService.moveGame(detail.id, game.key, date),
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })
  const entries = entryById(detail)
  const match = game.match_id !== null ? detail.matches.find((m) => m.id === game.match_id) : undefined
  const openable = match !== undefined && (canEditMatch(detail, match) || match.completed)
  const mine = detail.my_entry_id !== null && [game.entry1_id, game.entry2_id].includes(detail.my_entry_id)
  const slotWord = game.side === 'group' || !detail.group_stage ? 'Slot' : 'Bracket slot'
  const side = (entryId: number | null, slot: number | null) => {
    const entry = entryId !== null ? entries.get(entryId) : undefined
    if (entry) return { name: entry.name, known: true }
    return { name: slot !== null ? `${slotWord} ${slot}` : 'To be decided', known: false }
  }
  const sides = [side(game.entry1_id, game.slot1), side(game.entry2_id, game.slot2)]
  const scored = game.completed && game.score1 !== null && game.score2 !== null
  const days = detail.schedule.days.map((day, i) => ({ day, number: i + 1 }))
  // A day whose games are all moved there is full: it's only listed for the games already on it.
  const openDays = days.filter(
    ({ day }) =>
      (game.moved && game.date === day.date) ||
      detail.schedule.games.filter((g) => g.moved && g.date === day.date).length < day.games,
  )

  const movedTo = game.moved ? days.find(({ day }) => day.date === game.date) : undefined

  return (
    <li className={cn('flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4', mine && 'bg-brand-blue/5')}>
      <span className="w-[54px] shrink-0 text-[12px] font-semibold text-ink tabular-nums sm:w-[68px] sm:text-[13px]">
        {game.time ? clock(minutesOf(game.time)) : '—'}
      </span>
      <button
        type="button"
        disabled={!openable}
        onClick={() => match && onOpen(match)}
        className={cn('min-w-0 flex-1 text-left', openable && 'rounded-md hover:bg-muted/60')}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <span className="truncate">{title}</span>
          {game.moved ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 text-[10px] text-amber-700">
              <Pin className="size-2.5" /> Moved
            </span>
          ) : null}
          {mine ? (
            <span className="shrink-0 rounded-full bg-brand-blue/10 px-1.5 text-[10px] text-brand-blue">You</span>
          ) : null}
        </span>
        <span className="flex items-center gap-2">
          <span className="flex min-w-0 flex-1 flex-col text-[13px] sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-1.5">
            {sides.map((s, i) => (
              <span key={i} className="contents">
                {i === 1 ? <span className="hidden text-muted-foreground sm:inline">vs</span> : null}
                <span
                  className={cn(
                    'truncate',
                    s.known ? 'text-ink' : 'text-muted-foreground italic',
                    game.completed &&
                      game.winner_id !== null &&
                      game.winner_id === (i === 0 ? game.entry1_id : game.entry2_id) &&
                      'font-semibold',
                  )}
                >
                  {s.name}
                </span>
              </span>
            ))}
          </span>
          {scored ? (
            <span className="shrink-0 rounded bg-muted px-1.5 text-[12px] font-semibold text-ink/80 tabular-nums">
              {game.score1} – {game.score2}
            </span>
          ) : game.completed ? (
            <span className="shrink-0 text-[12px] text-muted-foreground">Played</span>
          ) : null}
        </span>
      </button>
      {detail.can_manage && detail.schedule.days.length > 0 ? (
        <span className="relative shrink-0">
          <span
            aria-hidden
            className="pointer-events-none inline-flex h-8 items-center gap-1 rounded-full border border-[#c4c9d4] bg-white px-2.5 text-[12px] font-semibold text-ink/80 sm:hidden"
          >
            {move.isPending ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <CalendarDays className="size-3.5" />
            )}
            {movedTo ? `Day ${movedTo.number}` : 'Move'}
          </span>
          <select
            aria-label={`Day for ${title}, ${sides[0].name} vs ${sides[1].name}`}
            value={game.moved && game.date ? game.date : ''}
            disabled={move.isPending}
            onChange={(e) => move.mutate(e.target.value === '' ? null : e.target.value)}
            className="absolute inset-0 opacity-0 sm:static sm:h-8 sm:w-[132px] sm:rounded-md sm:border sm:border-[#c4c9d4] sm:bg-white sm:px-2 sm:text-[12px] sm:text-ink sm:opacity-100 sm:disabled:opacity-60"
          >
            <option value="">In order</option>
            {openDays.map(({ day, number }) => (
              <option key={day.date} value={day.date}>
                Day {number} · {dayLabel(day.date)}
              </option>
            ))}
          </select>
        </span>
      ) : null}
    </li>
  )
}

/** The organizer's playing days: date, first game's time and how many games, plus how long a game takes. */
function DaysEditor({ detail }: { detail: TournamentDetail }) {
  const qc = useQueryClient()
  const schedule = detail.schedule
  const [minutes, setMinutes] = useState(schedule.minutes)
  const [days, setDays] = useState<Array<GameDay>>(schedule.days)
  const save = useMutation({
    mutationFn: () => tournamentService.saveSchedule(detail.id, { minutes, days }),
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })

  const total = schedule.games.length
  const room = days.reduce((sum, d) => sum + (Number.isFinite(d.games) ? d.games : 0), 0)
  const changed = minutes !== schedule.minutes || JSON.stringify(days) !== JSON.stringify(schedule.days)
  const dates = days.map((d) => d.date)
  const repeated = dates.some((d, i) => d !== '' && dates.indexOf(d) !== i)
  const incomplete = days.some((d) => d.date === '' || d.start === '' || !(d.games >= 1))
  const edit = (index: number, patch: Partial<GameDay>) =>
    setDays((all) => all.map((d, i) => (i === index ? { ...d, ...patch } : d)))

  return (
    <div className="mt-3 space-y-3">
      <label className="flex flex-wrap items-center gap-2 text-[13px] text-ink">
        <Clock className="size-4 text-ink/60" />
        Each game takes
        <select
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="h-8 rounded-md border border-[#c4c9d4] bg-white px-2 text-[13px] font-semibold"
        >
          {[...new Set([...MINUTE_CHOICES, minutes])]
            .sort((a, b) => a - b)
            .map((m) => (
              <option key={m} value={m}>
                {m < 60
                  ? `${m} minutes`
                  : m % 60 === 0
                    ? plural(m / 60, 'hour')
                    : `${Math.floor(m / 60)} h ${m % 60} min`}
              </option>
            ))}
        </select>
      </label>

      {days.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {days.map((day, i) => {
            const end = day.start && day.games >= 1 ? clock(minutesOf(day.start) + day.games * minutes) : null
            return (
              <li key={i} className="px-3 py-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                <div className="flex items-center gap-2 sm:contents">
                  <span className="shrink-0 text-[13px] font-semibold text-ink sm:w-12">Day {i + 1}</span>
                  {end ? (
                    <span className="ml-auto text-xs text-muted-foreground sm:order-last sm:ml-0">
                      until about {end}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Remove day ${i + 1}`}
                    onClick={() => setDays((all) => all.filter((_, j) => j !== i))}
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-full text-ink/50 transition hover:bg-muted hover:text-danger sm:order-last sm:ml-auto',
                      !end && 'ml-auto',
                    )}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-1 grid grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)_70px] gap-1 sm:contents">
                  <input
                    type="date"
                    aria-label={`Day ${i + 1} date`}
                    value={day.date}
                    onChange={(e) => edit(i, { date: e.target.value })}
                    className={cn(
                      'h-9 w-full min-w-0 rounded-md border bg-white px-2 text-[13px] sm:h-8 sm:w-auto',
                      compactPicker,
                      repeated && dates.indexOf(day.date) !== i ? 'border-danger' : 'border-[#c4c9d4]',
                    )}
                  />
                  <input
                    type="time"
                    aria-label={`Day ${i + 1} first game`}
                    value={day.start}
                    onChange={(e) => edit(i, { start: e.target.value })}
                    className={cn(
                      'h-9 w-full min-w-0 rounded-md border border-[#c4c9d4] bg-white px-2 text-[13px] sm:h-8 sm:w-auto',
                      compactPicker,
                    )}
                  />
                  <span className="relative flex items-center gap-1.5 text-[13px] text-ink">
                    <input
                      type="number"
                      min={1}
                      max={MAX_GAMES_A_DAY}
                      aria-label={`Day ${i + 1} games`}
                      value={Number.isFinite(day.games) ? day.games : ''}
                      onChange={(e) => edit(i, { games: e.target.valueAsNumber })}
                      className="h-9 w-full min-w-0 rounded-md border border-[#c4c9d4] bg-white pr-9 pl-2 text-[13px] max-sm:[appearance:textfield] sm:h-8 sm:w-16 sm:pr-2 max-sm:[&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="pointer-events-none absolute right-1.5 text-[10px] text-muted-foreground sm:static sm:text-[13px] sm:text-ink">
                      games
                    </span>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={days.length >= MAX_DAYS}
          onClick={() => setDays((all) => [...all, nextDay(detail, all)])}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-semibold text-ink transition hover:bg-muted disabled:opacity-50"
        >
          <CalendarPlus className="size-4" /> Add day
        </button>
        <span className="flex-1" />
        {changed ? (
          <button
            type="button"
            onClick={() => {
              setMinutes(schedule.minutes)
              setDays(schedule.days)
            }}
            className="h-8 rounded-full px-3 text-[13px] font-semibold text-ink/60 transition hover:bg-muted"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          disabled={!changed || repeated || incomplete || save.isPending}
          onClick={() => save.mutate()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-50"
        >
          {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Save game setup
        </button>
      </div>

      <p
        className={cn(
          'rounded-lg px-3 py-2 text-xs',
          days.length > 0 && room < total ? 'bg-amber-50 text-amber-800' : 'bg-muted/60 text-ink/70',
        )}
      >
        {repeated
          ? 'Two days have the same date. Give each day its own date.'
          : days.length === 0
            ? `Add the days you’ll play. There are ${plural(total, 'game')} to fit in.`
            : room < total
              ? `${plural(total, 'game')}, but these days have room for ${room}. Add a day or more games a day so ${total - room === 1 ? 'the last one fits' : `the last ${total - room} fit`}.`
              : `${plural(total, 'game')}, room for ${room}. Every game has a day.`}
      </p>
    </div>
  )
}

/**
 * Game setup: the playing days and which games are played when. Games fill the days in playing order, the
 * elimination stage first and then the bracket round by round; the organizer can move any game to another day.
 */
export function GameSetupPanel({
  detail,
  onOpen,
}: {
  detail: TournamentDetail
  onOpen: (match: TournamentMatch) => void
}) {
  const schedule = detail.schedule
  const words = detail.format === 'team' ? 'teams' : 'players'
  const titles = new Map(schedule.games.map((g) => [g.key, gameTitle(detail, g, schedule.games)]))
  const unscheduled = schedule.games.filter((g) => g.date === null)
  const before = detail.status === 'registration'

  return (
    <div className="space-y-2">
      <section className="rounded-xl border border-border bg-white px-4 py-4 sm:px-5">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-ink">
          <CalendarDays className="size-5 text-brand-blue" /> Game setup
        </h2>
        <p className="text-[13px] text-muted-foreground">
          {detail.can_manage
            ? `Pick the days you’ll play and how many games a day. Games fill the days in playing order${detail.group_stage ? ', the elimination stage first and then the bracket' : ''}. Move any game to another day with its menu.`
            : 'When each game is played.'}
        </p>
        {before && schedule.games.length > 0 ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-ink/70">
            <Info className="mt-px size-3.5 shrink-0" />
            Until the start, games show by slot (Slot 1 vs Slot 2). Names appear as {words} are placed or drawn.
          </p>
        ) : null}
        {detail.can_manage ? (
          <DaysEditor key={JSON.stringify([schedule.minutes, schedule.days, schedule.games.length])} detail={detail} />
        ) : schedule.days.length === 0 ? (
          <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] text-ink/70">
            The organizer hasn’t set up the game days yet.
          </p>
        ) : null}
      </section>

      {schedule.bracket_pending ? (
        <p className="rounded-xl border border-border bg-white px-4 py-3 text-[13px] text-ink/70 sm:px-5">
          The bracket’s games show here once {detail.can_manage ? 'you create' : 'the organizer creates'} the bracket.
        </p>
      ) : null}

      {schedule.games.length === 0 && !schedule.bracket_pending ? (
        <p className="rounded-xl border border-border bg-white px-4 py-6 text-center sm:px-5 text-[13px] text-muted-foreground">
          No games yet. They show here once there are enough {words} to play.
        </p>
      ) : null}

      {schedule.days.map((day, i) => {
        const games = schedule.games.filter((g) => g.date === day.date)
        const first = minutesOf(day.start)
        const last = games.at(-1)?.time
        return (
          <section key={day.date} className="overflow-hidden rounded-xl border border-border bg-white">
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border bg-muted/40 px-3 py-2.5 sm:px-4">
              <h3 className="text-[15px] font-semibold text-ink">
                Day {i + 1} <span className="font-normal text-muted-foreground">· {dayLabel(day.date)}</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {games.length === 0
                  ? 'No games'
                  : `${plural(games.length, 'game')} · ${clock(first)} – ${clock(minutesOf(last ?? day.start) + schedule.minutes)}`}
                {games.length > day.games ? (
                  <span className="ml-1 font-semibold text-amber-700">({games.length - day.games} over the plan)</span>
                ) : null}
              </p>
            </header>
            {games.length > 0 ? (
              <ul className="divide-y divide-border">
                {games.map((game) => (
                  <GameRow
                    key={game.key}
                    detail={detail}
                    game={game}
                    title={titles.get(game.key) ?? ''}
                    onOpen={onOpen}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-[13px] text-muted-foreground">
                Every game fits on the days before this one.
              </p>
            )}
          </section>
        )
      })}

      {schedule.days.length > 0 && unscheduled.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-amber-300 bg-white">
          <header className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
            <h3 className="text-[15px] font-semibold text-amber-900">Not on a day yet</h3>
            <p className="text-xs text-amber-800">
              {plural(unscheduled.length, 'game')} didn’t fit.{' '}
              {detail.can_manage ? 'Add a day, allow more games a day, or move these to a day.' : ''}
            </p>
          </header>
          <ul className="divide-y divide-border">
            {unscheduled.map((game) => (
              <GameRow key={game.key} detail={detail} game={game} title={titles.get(game.key) ?? ''} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      ) : null}

      {schedule.days.length === 0 && schedule.games.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <header className="border-b border-border bg-muted/40 px-4 py-2.5">
            <h3 className="text-[15px] font-semibold text-ink">All games, in playing order</h3>
          </header>
          <ul className="divide-y divide-border">
            {schedule.games.map((game) => (
              <GameRow key={game.key} detail={detail} game={game} title={titles.get(game.key) ?? ''} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
