import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Info, LoaderCircle, Repeat, Repeat1, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import type {
  GroupStage,
  TournamentDetail,
  TournamentEntry,
  TournamentGroup,
  TournamentMatch,
} from '@/types/tournament'
import { plural } from '@/components/clubs/clubUi'
import { toast } from '@/components/feed/Toaster'
import { startIssue } from '@/components/tournaments/BracketBoard'
import { MatchRounds, StandingsTable } from '@/components/tournaments/BracketViews'
import { GROUP_STAGE_INFO, entryWord, inGroupStage, storeTournament } from '@/components/tournaments/tournamentUi'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { tournamentService } from '@/services/tournamentService'

const MAX_GROUPS = 8

type Mode = GroupStage | 'off'

/** The smallest and largest group when `count` entries are split into `groups`. */
function groupSizes(count: number, groups: number): { min: number; max: number } {
  return { min: Math.floor(count / groups), max: Math.ceil(count / groups) }
}

function OptionCard({
  selected,
  icon,
  title,
  hint,
  onClick,
}: {
  selected: boolean
  icon: ReactNode
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition',
        selected ? 'border-brand-blue bg-brand-blue/5 ring-2 ring-brand-blue/15' : 'border-border hover:bg-muted/60',
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',
          selected ? 'bg-brand-blue text-white' : 'bg-muted text-ink/60',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-[13px] font-semibold', selected ? 'text-brand-blue' : 'text-ink')}>
          {title}
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  )
}

/** Who the organizer put in each match-map slot, by slot number. */
function placedBySlot(detail: TournamentDetail): Map<number, TournamentEntry> {
  return new Map(detail.entries.filter((e) => e.group_slot !== null).map((e) => [e.group_slot as number, e] as const))
}

/**
 * Before the elimination stage starts, in the Players tab: the organizer puts players or teams in whichever
 * match-map slot they want. Everyone sees who's where; anyone not placed is drawn into an open slot at the start.
 */
export function GroupSlotBoard({ detail }: { detail: TournamentDetail }) {
  const qc = useQueryClient()
  const map = detail.group_map
  /** Slots being saved, shown straight away. */
  const [pending, setPending] = useState<Array<number | null> | null>(null)
  const save = useMutation({
    mutationFn: (slots: Array<number | null>) => tournamentService.saveGroupSlots(detail.id, slots),
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
    onSettled: () => setPending(null),
  })
  if (!map || detail.status !== 'registration') return null

  const words = detail.format === 'team' ? 'teams' : 'players'
  const word = detail.format === 'team' ? 'team' : 'player'
  const placed = placedBySlot(detail)
  const slots = pending ?? Array.from({ length: map.slots }, (_, i) => placed.get(i + 1)?.id ?? null)
  const entries = new Map(detail.entries.map((e) => [e.id, e]))
  const placedIds = new Set(slots.filter((id): id is number => id !== null))
  const notPlaced = detail.entries.filter((e) => !placedIds.has(e.id))
  const editable = detail.can_manage

  const put = (slot: number, entryId: number | null) => {
    const next = slots.map((id) => (id === entryId && entryId !== null ? null : id))
    next[slot - 1] = entryId
    setPending(next)
    save.mutate(next)
  }

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">Slot map</h2>
          <p className="text-[13px] text-muted-foreground">
            {editable
              ? `Put ${words} in the slot you want them in. Slot 1 plays Slot 2 first, Slot 3 plays Slot 4, and so on (see the Elimination tab). Anyone you don’t place is drawn into an open slot when you start.`
              : `Where the organizer has put ${words} for the elimination stage. Anyone not placed is drawn into an open slot at the start.`}
          </p>
        </div>
        {editable && placedIds.size > 0 ? (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              const next = Array<null>(map.slots).fill(null)
              setPending(next)
              save.mutate(next)
            }}
            className="h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold text-ink/60 transition hover:bg-muted hover:text-danger disabled:opacity-50"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {map.groups.length === 0 ? (
        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-ink/70">
          {detail.group_count} groups need at least {detail.group_count * 2} slots
          {map.from_max_entries ? `; raise Max ${words} or use fewer groups.` : '.'}
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {map.groups.map((group) => (
            <div key={group.number} className="rounded-lg border border-border">
              <p className="border-b border-border bg-muted/40 px-3 py-2 text-[13px] font-semibold text-ink">
                {group.name}
              </p>
              <ul className="divide-y divide-border">
                {group.slots.map((slot) => {
                  const entry = slots[slot - 1] !== null ? entries.get(slots[slot - 1] as number) : undefined
                  return (
                    <li key={slot} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="w-12 shrink-0 text-[12px] font-semibold text-muted-foreground">Slot {slot}</span>
                      {editable ? (
                        <select
                          aria-label={`Slot ${slot}`}
                          value={entry?.id ?? ''}
                          disabled={save.isPending}
                          onChange={(e) => put(slot, e.target.value === '' ? null : Number(e.target.value))}
                          className={cn(
                            'h-8 min-w-0 flex-1 rounded-md border border-[#c4c9d4] bg-white px-2 text-[13px] disabled:opacity-60',
                            entry ? 'font-semibold text-ink' : 'text-muted-foreground',
                          )}
                        >
                          <option value="">Open (drawn at random)</option>
                          {entry ? <option value={entry.id}>{entry.name}</option> : null}
                          {notPlaced.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                          {detail.entries
                            .filter((e) => placedIds.has(e.id) && e.id !== entry?.id)
                            .map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name} (move from Slot {slots.indexOf(e.id) + 1})
                              </option>
                            ))}
                        </select>
                      ) : (
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-[13px]',
                            entry ? 'font-semibold text-ink' : 'text-muted-foreground italic',
                          )}
                        >
                          {entry?.name ?? 'Open'}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {placedIds.size} of {map.slots} slots taken
        {notPlaced.length > 0
          ? ` · ${notPlaced.length} ${notPlaced.length === 1 ? word : words} not placed yet`
          : detail.entries.length > 0
            ? ` · everyone’s placed`
            : ''}
        {save.isPending ? ' · saving…' : ''}
      </p>
    </section>
  )
}

/** "Slot 3", or who the organizer put there with the slot number. */
function SlotName({ slot, entry, end }: { slot: number; entry?: TournamentEntry; end?: boolean }) {
  if (!entry) return <span className="shrink-0 font-semibold text-ink">Slot {slot}</span>
  return (
    <span className={cn('flex min-w-0 items-baseline gap-1', end && 'flex-row-reverse')}>
      <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{slot}</span>
      <span className="truncate font-semibold text-ink">{entry.name}</span>
    </span>
  )
}

/** Before the start: who plays who by slot in every group, round by round. */
function SlotMap({ detail, stale }: { detail: TournamentDetail; stale?: boolean }) {
  const map = detail.group_map
  if (!map || !detail.group_stage) return null
  const words = detail.format === 'team' ? 'teams' : 'players'
  const double = detail.group_stage === 'double'
  const placed = placedBySlot(detail)

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold text-ink">Match map</h2>
        <span className="text-xs text-muted-foreground">
          {GROUP_STAGE_INFO[detail.group_stage].label} · {plural(map.slots, 'slot')}
        </span>
      </div>
      <p className="mt-0.5 text-[13px] text-muted-foreground">
        {map.from_max_entries
          ? `Built from Max ${words} (${map.slots}).`
          : `There’s no Max ${words}, so it uses the ${map.slots} in so far.`}{' '}
        The organizer places {words} in slots from the Players tab; anyone not placed is drawn into an open slot when
        the elimination stage starts
        {map.from_max_entries ? `. If fewer join, empty slots are dropped and everyone after them moves up.` : '.'}
      </p>
      {stale ? (
        <p className="mt-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-ink/80">
          Save your changes to see the new map.
        </p>
      ) : null}

      {map.groups.length === 0 ? (
        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-ink/70">
          {detail.group_count === 1
            ? `The map needs at least 2 slots.`
            : `${detail.group_count} groups need at least ${detail.group_count * 2} slots for a map${map.from_max_entries ? `; raise Max ${words} or use fewer groups` : ''}.`}
        </p>
      ) : (
        <div className={cn('mt-3 space-y-4', stale && 'opacity-50')}>
          {map.groups.map((group) => {
            const firstLeg = double ? group.rounds / 2 : group.rounds
            return (
              <div key={group.number} className="rounded-lg border border-border">
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
                  <h3 className="text-[14px] font-semibold text-ink">{group.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    Slots {group.slots[0]}–{group.slots[group.slots.length - 1]}
                  </span>
                </div>
                <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: group.rounds }, (_, i) => i + 1).map((round) => (
                    <div key={round}>
                      <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Round {round}
                        {double && round > firstLeg ? ' · return' : ''}
                      </p>
                      <ul className="space-y-1">
                        {group.matches
                          .filter((m) => m.round === round)
                          .map((m) => (
                            <li
                              key={`${m.slot1}-${m.slot2}`}
                              className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-[13px]"
                            >
                              <SlotName slot={m.slot1} entry={placed.get(m.slot1)} />
                              <span className="shrink-0 text-[11px] font-semibold text-muted-foreground uppercase">
                                vs
                              </span>
                              <SlotName slot={m.slot2} entry={placed.get(m.slot2)} end />
                            </li>
                          ))}
                        {group.slots.length % 2 === 1 ? (
                          <li className="px-2.5 text-[11px] text-muted-foreground">
                            Rest: Slot{' '}
                            {group.slots.find(
                              (s) => !group.matches.some((m) => m.round === round && (m.slot1 === s || m.slot2 === s)),
                            )}
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/** Before the start: the organizer turns the elimination stage on (single or double round robin) and sets the groups. */
function GroupStageSettings({ detail }: { detail: TournamentDetail }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<Mode>(detail.group_stage ?? 'off')
  const [groups, setGroups] = useState(detail.group_count)
  const words = detail.format === 'team' ? 'teams' : 'players'
  const dirty = mode !== (detail.group_stage ?? 'off') || (mode !== 'off' && groups !== detail.group_count)
  const count = detail.entries_count
  const { min, max } = groupSizes(count, groups)
  const legs = mode === 'double' ? 2 : 1

  const save = useMutation({
    mutationFn: () =>
      tournamentService.saveGroupStage(detail.id, {
        group_stage: mode === 'off' ? null : mode,
        group_count: groups,
      }),
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })

  return (
    <div className="space-y-2">
      <section className="rounded-xl border border-border bg-white px-4 py-4 sm:px-5">
        <h2 className="text-[17px] font-semibold text-ink">Elimination stage</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Optional. Split the {words} into groups that play a round robin first, then pick who moves on to the bracket.
        </p>

        <div role="radiogroup" aria-label="Elimination stage" className="mt-3 grid gap-2 sm:grid-cols-3">
          <OptionCard
            selected={mode === 'off'}
            icon={<Check className="size-4" />}
            title="No elimination stage"
            hint="Everyone goes straight into the bracket."
            onClick={() => setMode('off')}
          />
          <OptionCard
            selected={mode === 'single'}
            icon={<Repeat1 className="size-4" />}
            title={GROUP_STAGE_INFO.single.label}
            hint={GROUP_STAGE_INFO.single.hint}
            onClick={() => setMode('single')}
          />
          <OptionCard
            selected={mode === 'double'}
            icon={<Repeat className="size-4" />}
            title={GROUP_STAGE_INFO.double.label}
            hint={GROUP_STAGE_INFO.double.hint}
            onClick={() => setMode('double')}
          />
        </div>

        {mode !== 'off' ? (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground">Number of groups</p>
            <div role="radiogroup" aria-label="Number of groups" className="mt-1.5 flex flex-wrap gap-1.5">
              {Array.from({ length: MAX_GROUPS }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={groups === n}
                  onClick={() => setGroups(n)}
                  className={cn(
                    'h-8 min-w-8 rounded-full border px-2.5 text-[13px] font-semibold transition',
                    groups === n
                      ? 'border-brand-blue bg-brand-blue text-white'
                      : 'border-[#c4c9d4] text-ink/70 hover:bg-muted',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <ul className="mt-3 space-y-1 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-ink/70">
              <li>
                {groups === 1
                  ? 'One group: everyone plays everyone.'
                  : `Groups A to ${String.fromCharCode(64 + groups)} take the slots in order.`}{' '}
                {words[0].toUpperCase() + words.slice(1)} are drawn into slots at random when you start.
              </li>
              {count >= groups * 2 ? (
                <li>
                  With {entryWord(detail, count)}: groups of {min === max ? min : `${min}–${max}`}, so each plays{' '}
                  {min === max ? (max - 1) * legs : `${(min - 1) * legs}–${(max - 1) * legs}`} group matches.
                </li>
              ) : (
                <li className="text-amber-700">
                  {groups} {groups === 1 ? 'group needs' : 'groups need'} at least {groups * 2} {words} to start (
                  {entryWord(detail, count)} so far).
                </li>
              )}
              <li>Then you tick who moves on, place them in your brackets and start the bracket.</li>
            </ul>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          {dirty ? <span className="text-xs text-muted-foreground">Not saved yet</span> : null}
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-50"
          >
            {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Save
          </button>
        </div>
      </section>
      <SlotMap detail={detail} stale={dirty} />
    </div>
  )
}

function GroupCard({
  detail,
  group,
  picking,
  advancing,
  busy,
  onToggle,
  onOpen,
}: {
  detail: TournamentDetail
  group: TournamentGroup
  /** The organizer is ticking who moves on. */
  picking: boolean
  advancing: Set<number>
  busy: boolean
  onToggle: (entryId: number) => void
  onOpen: (match: TournamentMatch) => void
}) {
  const matches = detail.matches.filter((m) => m.side === 'group' && m.group_number === group.number)
  const [open, setOpen] = useState(inGroupStage(detail))
  const played = matches.filter((m) => m.completed).length
  const showMoved = picking || group.entry_ids.some((id) => advancing.has(id))
  const name = (id: number) => detail.entries.find((e) => e.id === id)?.name ?? 'Player'

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-4 sm:px-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-ink">{group.name}</h3>
        <span className="text-xs text-muted-foreground">{entryWord(detail, group.entry_ids.length)}</span>
      </div>
      <StandingsTable
        detail={detail}
        rows={group.standings}
        matches={matches}
        marked={advancing}
        column={
          showMoved
            ? {
                header: picking ? 'Moves on' : 'Moved on',
                cell: (row) =>
                  picking ? (
                    <input
                      type="checkbox"
                      checked={advancing.has(row.entry_id)}
                      disabled={busy}
                      onChange={() => onToggle(row.entry_id)}
                      aria-label={`${name(row.entry_id)} moves on`}
                      className="size-4 accent-emerald-600"
                    />
                  ) : advancing.has(row.entry_id) ? (
                    <Check className="ml-auto size-4 text-emerald-600" aria-label="Moved on" />
                  ) : null,
              }
            : undefined
        }
      />
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="mt-3 flex w-full items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-[13px] font-semibold text-ink/80 transition hover:bg-muted"
      >
        Matches · {played} of {matches.length} played
        <ChevronDown className={cn('size-4 transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="mt-3">
          <MatchRounds detail={detail} matches={matches} rounds={group.rounds} onOpen={onOpen} />
        </div>
      ) : null}
    </section>
  )
}

/** The Elimination tab: the settings before the start, then every group's table and matches. */
export function GroupStagePanel({
  detail,
  onOpen,
}: {
  detail: TournamentDetail
  onOpen: (match: TournamentMatch) => void
}) {
  const qc = useQueryClient()
  const words = detail.format === 'team' ? 'teams' : 'players'
  const picking = detail.can_manage && inGroupStage(detail)
  /** Picks being saved, shown straight away. */
  const [pending, setPending] = useState<Array<number> | null>(null)
  const save = useMutation({
    mutationFn: (ids: Array<number>) => tournamentService.saveAdvancing(detail.id, ids),
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
    onSettled: () => setPending(null),
  })
  const advancing = new Set(pending ?? detail.entries.filter((e) => e.advanced).map((e) => e.id))
  const pick = (ids: Array<number>) => {
    setPending(ids)
    save.mutate(ids)
  }

  if (detail.status === 'registration') {
    if (detail.can_manage) return <GroupStageSettings detail={detail} />
    return (
      <div className="space-y-2">
        <section className="rounded-xl border border-border bg-white px-5 py-10 text-center sm:px-6">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-blue/10 text-brand-blue">
            <Users className="size-6" />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-ink">
            {detail.group_stage ? GROUP_STAGE_INFO[detail.group_stage].label : 'Elimination stage'}
            {detail.group_count > 1 ? ` in ${detail.group_count} groups` : ''}
          </p>
          <p className="mx-auto mt-1 max-w-[420px] text-[13px] text-muted-foreground">
            {detail.group_stage ? GROUP_STAGE_INFO[detail.group_stage].hint : ''} Groups are drawn at random when the
            organizer starts, and the best move on to the bracket.
          </p>
        </section>
        <SlotMap detail={detail} />
      </div>
    )
  }

  if (detail.groups.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-white px-5 py-10 text-center text-[13px] sm:px-6 text-muted-foreground">
        This tournament went straight to the bracket.
      </section>
    )
  }

  const smallest = Math.min(...detail.groups.map((g) => g.entry_ids.length))
  const quickPicks = [1, 2, 3, 4].filter((n) => n < smallest)
  const topOf = (n: number) => detail.groups.flatMap((g) => g.standings.slice(0, n).map((row) => row.entry_id))
  const toggle = (id: number) => {
    const next = new Set(advancing)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    pick([...next])
  }
  const issue = picking && detail.brackets.length > 0 && advancing.size >= 2 ? startIssue(detail) : null

  return (
    <div className="space-y-2">
      <section className="rounded-xl border border-border bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-ink">Elimination stage</h2>
            <p className="text-[13px] text-muted-foreground">
              {detail.group_stage ? GROUP_STAGE_INFO[detail.group_stage].label : 'Round robin'} ·{' '}
              {detail.groups.length === 1 ? '1 group' : `${detail.groups.length} groups`}
            </p>
          </div>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-[12px] font-semibold',
              advancing.size > 0 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-ink/60',
            )}
          >
            {advancing.size} {inGroupStage(detail) ? 'moving on' : 'moved on'}
          </span>
        </div>
        {picking ? (
          <>
            <p className="mt-2 text-[13px] text-ink/80">
              Enter the group results, then tick who moves on to the bracket. When you’re ready, use Start bracket.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">Quick pick:</span>
              {quickPicks.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={save.isPending}
                  onClick={() => pick(topOf(n))}
                  className="h-7 rounded-full border border-[#c4c9d4] px-3 text-[12px] font-semibold text-ink/80 transition hover:bg-muted disabled:opacity-50"
                >
                  Top {n} of each group
                </button>
              ))}
              {advancing.size > 0 ? (
                <button
                  type="button"
                  disabled={save.isPending}
                  onClick={() => pick([])}
                  className="h-7 rounded-full px-3 text-[12px] font-semibold text-ink/60 transition hover:bg-muted hover:text-danger disabled:opacity-50"
                >
                  Clear
                </button>
              ) : null}
              {save.isPending ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" /> : null}
            </div>
          </>
        ) : inGroupStage(detail) ? (
          <p className="mt-2 text-[13px] text-muted-foreground">
            The organizer picks who moves on to the bracket once the group matches are played.
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-muted-foreground">
            The elimination stage is over; its results are final. The {words} who moved on are in the Bracket tab.
          </p>
        )}
        {issue ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-ink/80">
            <Info className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
            {issue}
          </p>
        ) : null}
      </section>

      {detail.groups.map((group) => (
        <GroupCard
          key={group.number}
          detail={detail}
          group={group}
          picking={picking}
          advancing={advancing}
          busy={save.isPending}
          onToggle={toggle}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}
