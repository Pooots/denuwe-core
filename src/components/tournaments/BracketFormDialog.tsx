import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GitFork, LoaderCircle, Trash2 } from 'lucide-react'
import type { Bracket, TournamentDetail } from '@/types/tournament'
import { inputClass } from '@/components/clubs/ClubForm'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { bracketRoom, fullSize, openingCount } from '@/components/tournaments/BracketBoard'
import { isDrawing, storeTournament } from '@/components/tournaments/tournamentUi'
import { cn } from '@/lib/utils'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { tournamentService } from '@/services/tournamentService'

const PRESETS = [4, 8, 16, 32, 64]

/** The confirm question before deleting `bracket`; after the start it also says what's cleared. */
export function deleteBracketQuestion(detail: TournamentDetail, bracket: Bracket): string {
  const words = detail.format === 'team' ? 'teams' : 'players'
  const every = `every result${detail.brackets.length > 1 ? ' in every bracket' : ''}`
  if (isDrawing(detail)) return `Delete “${bracket.name}”? Its ${words} go back to not placed.`
  return detail.group_stage
    ? `Delete “${bracket.name}”? The bracket has started, so ${every} is cleared and you go back to the elimination stage (its results stay). This can’t be undone.`
    : `Delete “${bracket.name}”? The tournament has started, so ${every} is cleared and registration opens again. This can’t be undone.`
}

/** "8 slots: 4 first-round matches." or "10 slots: 2 opening matches, 6 byes into the quarterfinals." */
function sizeHint(size: number, words: string): string {
  if (!Number.isInteger(size) || size < 2) return `A bracket needs at least 2 ${words}.`
  const pairs = fullSize(size) / 2
  const opening = openingCount(size)
  if (opening === pairs) return `${size} slots: ${pairs} first-round ${pairs === 1 ? 'match' : 'matches'}.`
  const byes = pairs - opening
  return `${size} slots: ${opening} opening ${opening === 1 ? 'match' : 'matches'}, and ${byes} ${byes === 1 ? 'gets a bye' : 'get byes'} into the next round.`
}

/**
 * Create a bracket (a name and how many slots it has), or rename / resize one. Max players becomes every
 * bracket's slots added up.
 */
export function BracketFormDialog({
  detail,
  bracket,
  onClose,
  onCreated,
}: {
  detail: TournamentDetail
  bracket?: Bracket
  onClose: () => void
  onCreated?: (bracket: Bracket) => void
}) {
  const qc = useQueryClient()
  const editing = bracket !== undefined
  const room = bracketRoom(detail, bracket?.id)
  const first = detail.brackets.length === 0
  const words = detail.format === 'team' ? 'teams' : 'players'
  const suggested = first ? (detail.max_entries ?? Math.max(detail.entries_count, 8)) : 8
  const [name, setName] = useState(bracket?.name ?? '')
  const [size, setSize] = useState(String(bracket?.size ?? Math.max(2, Math.min(suggested, room.left))))
  const [error, setError] = useState<string | null>(null)
  const resizable = isDrawing(detail)
  const count = Number(size)

  const save = useMutation({
    mutationFn: (payload: { name: string; size: number }) =>
      editing
        ? tournamentService.updateBracket(detail.id, bracket.id, payload)
        : tournamentService.createBracket(detail.id, payload),
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
      onClose()
      if (!editing) {
        const known = new Set(detail.brackets.map((b) => b.id))
        const created = tournament.brackets.find((b) => !known.has(b.id))
        if (created) onCreated?.(created)
      }
    },
    onError: (err) => {
      const fieldErrors = apiValidationErrors(err)
      setError((fieldErrors && Object.values(fieldErrors)[0]?.[0]) || apiErrorMessage(err))
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => tournamentService.removeBracket(detail.id, id),
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
      onClose()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const submit = () => {
    const problem = !name.trim()
      ? 'Give the bracket a name.'
      : !Number.isInteger(count) || count < 2
        ? 'A bracket needs at least 2 slots.'
        : count > room.left
          ? `All the brackets together can have up to ${room.used + room.left} slots, so this one can have up to ${room.left}.`
          : null
    setError(problem)
    if (!problem) save.mutate({ name: name.trim(), size: count })
  }

  return (
    <Modal
      onClose={onClose}
      className="max-w-[460px]"
      title={
        <div className="flex items-center gap-3">
          <span className="brand-gradient grid size-10 shrink-0 place-items-center rounded-lg text-white">
            <GitFork className="size-5 rotate-90" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-ink">{editing ? 'Edit bracket' : 'Create bracket'}</h2>
            <p className="truncate text-xs text-muted-foreground">{detail.name}</p>
          </div>
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
        <div className="space-y-4 px-5 pb-5">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">
              Name of bracket <span className="text-danger">*</span>
            </span>
            <input
              autoFocus
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder={first ? 'e.g. Main bracket, Men’s division' : 'e.g. Women’s division'}
              className={cn(inputClass, 'mt-1 h-10')}
            />
          </label>

          <div>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">
                Bracket size <span className="text-danger">*</span>
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={room.left}
                  disabled={!resizable}
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className={cn(inputClass, 'h-10 w-28 disabled:opacity-60')}
                />
                <span className="text-[13px] text-ink/70">{words}</span>
              </div>
            </label>
            {resizable ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESETS.filter((preset) => preset <= room.left).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={count === preset}
                    onClick={() => setSize(String(preset))}
                    className={cn(
                      'h-7 rounded-full border px-3 text-[12px] font-semibold transition',
                      count === preset
                        ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                        : 'border-[#c4c9d4] text-ink/70 hover:bg-muted',
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {resizable ? sizeHint(count, words) : 'The tournament has started, so only the name can change.'}
            </p>
          </div>

          <ul className="space-y-1 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-ink/70">
            {detail.group_stage ? (
              <li>Only the {words} who move on from the elimination stage go in the bracket.</li>
            ) : resizable && Number.isInteger(count) && count >= 2 ? (
              <li>
                Max {words} becomes <strong className="text-ink">{room.used + count}</strong>
                {detail.brackets.length > (editing ? 1 : 0) ? ', every bracket’s slots added up.' : '.'}
              </li>
            ) : null}
            {detail.bracket === 'double_elimination' ? (
              <li>This is the upper bracket. The lower bracket and the grand final are added for you.</li>
            ) : null}
            {!editing ? (
              <li>Next you put the {words} in their slots. Anyone you don’t place is drawn at random.</li>
            ) : null}
          </ul>
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          {editing ? (
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(deleteBracketQuestion(detail, bracket))) remove.mutate(bracket.id)
              }}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-60"
            >
              {remove.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete bracket
            </button>
          ) : null}
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-danger">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-full px-3 text-[13px] font-semibold text-ink/70 transition hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-70"
          >
            {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {editing ? 'Save bracket' : 'Create bracket'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
