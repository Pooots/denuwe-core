import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eraser, Info, LoaderCircle, MoveVertical, Pencil, Shuffle, X } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import type { BracketScope } from '@/types/tournament'
import { toast } from '@/components/feed/Toaster'
import {
  BracketBoard,
  DrawCanvas,
  EntryAvatar,
  SlotBox,
  defaultOpening,
  fillOrder,
  openingCount,
  reshapeDraw,
  startIssue,
} from '@/components/tournaments/BracketBoard'
import { bracketEntries, entryById, storeTournament } from '@/components/tournaments/tournamentUi'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { tournamentService } from '@/services/tournamentService'

/** What's being moved: a player from the tray, or one already in a slot. */
type Held = { from: 'tray'; id: number } | { from: 'slot'; index: number }

function shuffled<T>(items: Array<T>): Array<T> {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function onActivate(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }
}

const toolButton =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-[#c4c9d4] bg-white px-3 text-[12px] font-semibold text-ink/80 transition hover:bg-muted disabled:opacity-50'

/** The organizer places players or teams in one bracket's first round. Saved as a draw that Start uses. */
export function BracketEditor({ scope, onDone }: { scope: BracketScope; onDone: () => void }) {
  const qc = useQueryClient()
  const detail = scope
  const size = scope.group.size
  const [slots, setSlots] = useState<Array<number | null>>(() =>
    Array.from({ length: size }, (_, i) => scope.draw?.at(i) ?? null),
  )
  const [opening, setOpening] = useState<Array<number>>(() =>
    scope.opening && scope.opening.length === openingCount(size) ? scope.opening : defaultOpening(size),
  )
  /** The opening match being moved to another spot, by first-round pair. */
  const [moving, setMoving] = useState<number | null>(null)
  const [held, setHeld] = useState<Held | null>(null)
  const [over, setOver] = useState<number | 'tray' | null>(null)
  const dragging = useRef<Held | null>(null)

  const entries = entryById(detail)
  const placed = new Set(slots.filter((id): id is number => id !== null && entries.has(id)))
  /** Already in another bracket; they can be moved by taking them out there first. */
  const elsewhere = new Set(
    scope.brackets.filter((b) => b.id !== scope.group.id).flatMap((b) => (b.draw ?? []).filter((id) => id !== null)),
  )
  const pool = bracketEntries(detail)
  const available = pool.filter((e) => !elsewhere.has(e.id))
  const unplaced = available.filter((e) => !placed.has(e.id))
  const several = scope.brackets.length > 1
  const word = detail.format === 'team' ? 'team' : 'player'
  const words = detail.format === 'team' ? 'teams' : 'players'
  const issue = startIssue(detail, { bracketId: scope.group.id, slots, opening })
  const pairs = Math.max(1, 2 ** Math.ceil(Math.log2(size)) / 2)
  const hasByes = opening.length < pairs
  const presets = {
    spread: defaultOpening(size),
    top: Array.from({ length: opening.length }, (_, i) => i),
    bottom: Array.from({ length: opening.length }, (_, i) => pairs - opening.length + i),
  }
  const preset = (Object.keys(presets) as Array<keyof typeof presets>).find(
    (key) => presets[key].join() === opening.join(),
  )

  const rearrange = (next: Array<number>) => {
    const sorted = [...next].sort((a, b) => a - b)
    setSlots((current) => reshapeDraw(current, opening, sorted))
    setOpening(sorted)
    setMoving(null)
    setHeld(null)
  }

  const move = (target: number, what: Held) => {
    setSlots((current) => {
      const next = [...current]
      if (what.from === 'tray') next[target] = what.id
      else [next[target], next[what.index]] = [next[what.index], next[target]]
      return next
    })
  }
  const takeOut = (index: number) => setSlots((current) => current.map((id, i) => (i === index ? null : id)))

  const save = useMutation({
    mutationFn: () =>
      tournamentService.saveBracketDraw(
        detail.id,
        scope.group.id,
        slots.map((id) => (id !== null && entries.has(id) ? id : null)),
        opening,
      ),
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
      onDone()
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })

  const clickSlot = (index: number) => {
    const filled = placed.has(slots[index] ?? -1)
    if (held && !(held.from === 'slot' && held.index === index)) {
      move(index, held)
      setHeld(null)
    } else if (held) {
      setHeld(null)
    } else if (filled) {
      setHeld({ from: 'slot', index })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          title="Change it with Edit bracket"
          className="inline-flex h-8 items-center gap-2 rounded-full border border-[#c4c9d4] bg-white pr-1 pl-3 text-[12px] font-semibold text-ink/80"
        >
          Bracket size
          <span className="rounded-full bg-muted px-2 py-0.5 text-ink">{size} slots</span>
        </span>
        {hasByes ? (
          <label className="inline-flex h-8 items-center gap-2 rounded-full border border-[#c4c9d4] bg-white pr-1 pl-3 text-[12px] font-semibold text-ink/80">
            Opening matches
            <select
              value={preset ?? 'custom'}
              onChange={(e) => {
                const key = e.target.value as keyof typeof presets | 'custom'
                if (key !== 'custom') rearrange(presets[key])
              }}
              className="h-6 rounded-full bg-muted px-2 text-[12px] font-semibold text-ink outline-none"
            >
              <option value="spread">Spread out</option>
              <option value="top">At the top</option>
              <option value="bottom">At the bottom</option>
              {preset === undefined ? <option value="custom">Custom</option> : null}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          disabled={available.length === 0}
          onClick={() => {
            const ids = shuffled(available.map((e) => e.id))
            const order = fillOrder(size, opening)
            const next = Array<number | null>(size).fill(null)
            ids.forEach((id, i) => {
              if (i < order.length) next[order[i]] = id
            })
            setSlots(next)
            setHeld(null)
          }}
          className={toolButton}
        >
          <Shuffle className="size-3.5" /> {several ? 'Shuffle everyone left' : 'Shuffle everyone'}
        </button>
        <button
          type="button"
          disabled={placed.size === 0}
          onClick={() => {
            setSlots(Array<null>(size).fill(null))
            setHeld(null)
          }}
          className={toolButton}
        >
          <Eraser className="size-3.5" /> Clear
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onDone}
          className="h-8 rounded-full px-3 text-[12px] font-semibold text-ink/70 transition hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[12px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-60"
        >
          {save.isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
          Save bracket
        </button>
      </div>

      <div
        role="region"
        aria-label={`${words} not placed yet`}
        onDragOver={(e) => {
          if (dragging.current?.from !== 'slot') return
          e.preventDefault()
          setOver('tray')
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          e.preventDefault()
          if (dragging.current?.from === 'slot') takeOut(dragging.current.index)
          dragging.current = null
          setOver(null)
        }}
        onClick={() => {
          if (held?.from === 'slot') {
            takeOut(held.index)
            setHeld(null)
          }
        }}
        className={cn(
          'rounded-xl border border-dashed px-3 py-2.5 transition',
          over === 'tray' ? 'border-brand-blue bg-brand-blue/5' : 'border-[#c4c9d4] bg-white',
        )}
      >
        <p className="text-[12px] font-semibold text-ink">
          Not placed yet <span className="font-normal text-muted-foreground">({unplaced.length})</span>
        </p>
        {unplaced.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unplaced.map((entry) => {
              const isHeld = held?.from === 'tray' && held.id === entry.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  draggable
                  aria-pressed={isHeld}
                  onDragStart={(e) => {
                    dragging.current = { from: 'tray', id: entry.id }
                    e.dataTransfer.setData('text/plain', entry.name)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    dragging.current = null
                    setOver(null)
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setHeld(isHeld ? null : { from: 'tray', id: entry.id })
                  }}
                  className={cn(
                    'inline-flex cursor-grab items-center gap-1.5 rounded-full border bg-white py-1 pr-3 pl-1 text-[12px] font-semibold text-ink transition active:cursor-grabbing',
                    isHeld
                      ? 'border-brand-blue ring-2 ring-brand-blue/25'
                      : 'border-[#dde2ea] hover:border-brand-navy/40',
                  )}
                >
                  <EntryAvatar entry={entry} />
                  {entry.name}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pool.length === 0
              ? detail.group_stage
                ? `No ${words} are moving on yet. Pick them in the Elimination tab.`
                : `No ${words} have joined yet.`
              : several
                ? 'Everyone’s in a bracket.'
                : 'Everyone’s in the bracket.'}
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Drag {words} into the first round, or tap one and then a slot. Tap two placed {words} to swap them; drop one
          back here to take it out.
          {elsewhere.size > 0
            ? ` ${elsewhere.size} ${elsewhere.size === 1 ? word : words} in other brackets aren’t listed; take them out there to move them here.`
            : ''}
        </p>
      </div>

      {issue && pool.length >= 2 ? (
        <p className="flex items-start gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-ink/80">
          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
          {issue}
        </p>
      ) : (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {pool.length < 2
            ? detail.group_stage
              ? `${size} slots ready. As you pick who moves on, they show up above.`
              : `${size} slots ready. As ${words} join they show up above, and you can place them in the bracket.`
            : unplaced.length > 0
              ? `When you start, anyone you didn’t place goes into a random open slot${several ? ' in any bracket' : ''}.`
              : size > placed.size
                ? `Empty slots are byes: the ${word} facing one goes straight to the next round.`
                : 'Everyone’s placed. Save, then start when you’re ready.'}
        </p>
      )}

      {moving !== null ? (
        <p className="flex items-start gap-2 rounded-lg bg-brand-blue/10 px-3 py-2 text-xs text-brand-navy">
          <MoveVertical className="mt-0.5 size-3.5 shrink-0" />
          Pick a dashed spot in the opening round to move this match there, or tap its handle again to leave it.
        </p>
      ) : (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Pencil className="mt-0.5 size-3.5 shrink-0" />
          Click a round’s title to rename it.
          {hasByes ? ' Use the handle on an opening match to move it to another spot.' : ''}
          {detail.bracket === 'double_elimination'
            ? ' This is the upper bracket; the lower bracket fills itself as people lose.'
            : ''}
        </p>
      )}

      <BracketBoard>
        <DrawCanvas
          scope={scope}
          slots={slots}
          opening={opening}
          renderOpeningTool={
            hasByes
              ? (pair) => {
                  const active = moving === pair
                  const number = opening.indexOf(pair) + 1
                  return (
                    <button
                      type="button"
                      aria-pressed={active}
                      aria-label={`Move opening match ${number}`}
                      title={active ? 'Leave it here' : 'Move this opening match'}
                      onClick={() => setMoving(active ? null : pair)}
                      className={cn(
                        'grid size-6 place-items-center rounded-full border shadow-sm transition',
                        active
                          ? 'border-brand-blue bg-brand-blue text-white'
                          : 'border-[#c4c9d4] bg-white text-ink/60 hover:border-brand-blue hover:text-brand-blue',
                      )}
                    >
                      <MoveVertical className="size-3.5" />
                    </button>
                  )
                }
              : undefined
          }
          renderByeSpot={
            moving !== null
              ? (pair) => (
                  <button
                    type="button"
                    aria-label={`Move the opening match to spot ${pair + 1}`}
                    onClick={() => rearrange([...opening.filter((p) => p !== moving), pair])}
                    className="grid size-full place-items-center rounded-lg border-2 border-dashed border-brand-blue/50 bg-brand-blue/5 text-[12px] font-semibold text-brand-blue transition hover:border-brand-blue hover:bg-brand-blue/10"
                  >
                    Move the match here
                  </button>
                )
              : undefined
          }
          renderEntrySlot={(index) => {
            const id = slots[index]
            const entry = (id !== null ? entries.get(id) : undefined) ?? null
            const isHeld = held?.from === 'slot' && held.index === index
            return (
              <div
                role="button"
                tabIndex={0}
                aria-label={entry ? `${entry.name}, slot ${index + 1}` : `Empty slot ${index + 1}`}
                draggable={!!entry}
                onDragStart={(e) => {
                  dragging.current = { from: 'slot', index }
                  e.dataTransfer.setData('text/plain', entry?.name ?? '')
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => {
                  dragging.current = null
                  setOver(null)
                }}
                onDragOver={(e) => {
                  if (!dragging.current) return
                  e.preventDefault()
                  setOver(index)
                }}
                onDragLeave={() => setOver((current) => (current === index ? null : current))}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragging.current) move(index, dragging.current)
                  dragging.current = null
                  setOver(null)
                  setHeld(null)
                }}
                onClick={() => clickSlot(index)}
                onKeyDown={onActivate(() => clickSlot(index))}
                className={cn('group size-full rounded-lg outline-none', entry ? 'cursor-grab' : 'cursor-pointer')}
              >
                <SlotBox
                  entry={entry}
                  placeholder={held ? 'Place here' : `Drop a ${word} here`}
                  tone={entry ? 'pending' : 'empty'}
                  active={isHeld || over === index}
                  className="group-focus-visible:ring-2 group-focus-visible:ring-brand-blue/40"
                >
                  {entry ? (
                    <button
                      type="button"
                      aria-label={`Take ${entry.name} out of the bracket`}
                      onClick={(e) => {
                        e.stopPropagation()
                        takeOut(index)
                        setHeld(null)
                      }}
                      className="mr-1 grid size-6 shrink-0 place-items-center rounded-full text-ink/40 opacity-0 transition group-hover:opacity-100 hover:bg-muted hover:text-danger focus-visible:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </SlotBox>
              </div>
            )
          }}
        />
      </BracketBoard>
    </div>
  )
}
