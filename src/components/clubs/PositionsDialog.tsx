import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, CalendarCheck, Check, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Club, ClubPosition } from '@/types/club'
import { inputClass } from '@/components/clubs/ClubForm'
import { CLUB_TYPE_LABEL, plural, refreshClubs, updateClubDetail } from '@/components/clubs/clubUi'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { cn } from '@/lib/utils'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { clubService } from '@/services/clubService'

const PRESETS = ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'Director', 'PRO']

function errorText(err: unknown): string {
  const fieldErrors = apiValidationErrors(err)
  return (fieldErrors && Object.values(fieldErrors)[0]?.[0]) || apiErrorMessage(err)
}

function PositionRow({
  club,
  position,
  index,
  total,
  busy,
  onMove,
  onSaved,
}: {
  club: Club
  position: ClubPosition
  index: number
  total: number
  busy: boolean
  onMove: (from: number, to: number) => void
  onSaved: (positions: Array<ClubPosition>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(position.name)

  const rename = useMutation({
    mutationFn: () => clubService.renamePosition(club.id, position.id, name),
    onSuccess: (positions) => {
      onSaved(positions)
      setEditing(false)
    },
    onError: (err) => toast(errorText(err), 'error'),
  })

  const organize = useMutation({
    mutationFn: () => clubService.setPositionOrganizer(club.id, position.id, !position.can_organize),
    onSuccess: ({ message, positions }) => {
      onSaved(positions)
      toast(message)
    },
    onError: (err) => toast(errorText(err), 'error'),
  })

  const remove = useMutation({
    mutationFn: () => clubService.removePosition(club.id, position.id),
    onSuccess: (positions) => {
      onSaved(positions)
      toast(`${position.name} removed.`)
    },
    onError: (err) => toast(errorText(err), 'error'),
  })

  const iconButton =
    'grid size-8 shrink-0 place-items-center rounded-full text-ink/60 transition hover:bg-muted hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent'

  return (
    <li className="flex items-center gap-2 py-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-blue/10 text-[12px] font-bold text-brand-blue">
        {index + 1}
      </span>
      {editing ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim() === position.name) setEditing(false)
            else rename.mutate()
          }}
        >
          <input
            autoFocus
            value={name}
            maxLength={60}
            aria-label="Position name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setName(position.name)
                setEditing(false)
              }
            }}
            className={cn(inputClass, 'h-8')}
          />
          <button
            type="submit"
            aria-label="Save name"
            disabled={rename.isPending}
            className={cn(iconButton, 'text-brand-blue')}
          >
            {rename.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          </button>
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => {
              setName(position.name)
              setEditing(false)
            }}
            className={iconButton}
          >
            <X className="size-4" />
          </button>
        </form>
      ) : (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-ink">{position.name}</span>
            <span className="text-xs text-muted-foreground">
              {position.holders_count ? plural(position.holders_count, 'holder') : 'Not assigned yet'}
              {position.can_organize ? (
                <span className="font-semibold text-brand-blue"> · Creates activities & tournaments</span>
              ) : null}
            </span>
          </span>
          <button
            type="button"
            aria-pressed={position.can_organize}
            aria-label={`${position.name} can create activities and tournaments`}
            title={
              position.organize_locked
                ? 'The President always creates activities & tournaments.'
                : position.can_organize
                  ? 'Can create activities & tournaments. Click to turn off.'
                  : 'Allow to create activities & tournaments'
            }
            disabled={organize.isPending || position.organize_locked}
            onClick={() => organize.mutate()}
            className={cn(
              iconButton,
              position.can_organize && 'bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/15 hover:text-brand-blue',
            )}
          >
            {organize.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <CalendarCheck className="size-4" />
            )}
          </button>
          <button
            type="button"
            aria-label={`Move ${position.name} up`}
            disabled={busy || index === 0}
            onClick={() => onMove(index, index - 1)}
            className={iconButton}
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Move ${position.name} down`}
            disabled={busy || index === total - 1}
            onClick={() => onMove(index, index + 1)}
            className={iconButton}
          >
            <ArrowDown className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Rename ${position.name}`}
            onClick={() => setEditing(true)}
            className={iconButton}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${position.name}`}
            disabled={remove.isPending}
            onClick={() => {
              const warning = position.holders_count
                ? ` ${plural(position.holders_count, 'member')} will lose this position.`
                : ''
              if (window.confirm(`Delete “${position.name}”?${warning}`)) remove.mutate()
            }}
            className={cn(iconButton, 'hover:text-danger')}
          >
            {remove.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
        </>
      )}
    </li>
  )
}

export function PositionsDialog({
  club,
  positions,
  onClose,
}: {
  club: Club
  positions: Array<ClubPosition>
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const typeLabel = CLUB_TYPE_LABEL[club.type].toLowerCase()

  const saved = (next: Array<ClubPosition>) => {
    updateClubDetail(qc, club.id, (detail) => ({ ...detail, positions: next }))
    refreshClubs(qc)
  }

  const add = useMutation({
    mutationFn: (value: string) => clubService.addPosition(club.id, value),
    onSuccess: (next, value) => {
      saved(next)
      setName('')
      setError(null)
      toast(`${value.trim()} added.`)
    },
    onError: (err) => setError(errorText(err)),
  })

  const reorder = useMutation({
    mutationFn: (ids: Array<number>) => clubService.reorderPositions(club.id, ids),
    onMutate: (ids) => {
      const byId = new Map(positions.map((p) => [p.id, p]))
      saved(ids.flatMap((id) => byId.get(id) ?? []))
    },
    onSuccess: saved,
    onError: (err) => {
      toast(errorText(err), 'error')
      refreshClubs(qc)
    },
  })

  const move = (from: number, to: number) => {
    const ids = positions.map((p) => p.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    reorder.mutate(ids)
  }

  const existing = new Set(positions.map((p) => p.name.toLowerCase()))
  const presets = PRESETS.filter((preset) => !existing.has(preset.toLowerCase()))

  return (
    <Modal
      onClose={onClose}
      className="max-w-[520px]"
      title={
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">Positions</h2>
          <p className="truncate text-xs text-muted-foreground">
            Create the roles in your {typeLabel}. The order here is how officers are listed.
          </p>
        </div>
      }
    >
      <div className="max-h-[60dvh] overflow-y-auto px-5 pb-4">
        <p className="mb-1 flex items-start gap-1.5 rounded-lg bg-brand-blue/5 px-3 py-2 text-xs text-ink/70">
          <CalendarCheck className="mt-px size-3.5 shrink-0 text-brand-blue" />
          <span>
            Turn on the calendar for positions that can create activities and tournaments, like your President. Any
            member can post on the wall.
          </span>
        </p>
        {positions.length > 0 ? (
          <ul className="divide-y divide-border">
            {positions.map((position, index) => (
              <PositionRow
                key={position.id}
                club={club}
                position={position}
                index={index}
                total={positions.length}
                busy={reorder.isPending}
                onMove={move}
                onSaved={saved}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-muted/70 px-4 py-6 text-center text-[13px] text-muted-foreground">
            No positions yet. Add your own or start with a suggestion below.
          </p>
        )}

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) setError('Give the position a name.')
            else add.mutate(name)
          }}
        >
          <input
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="Add a position, e.g. Membership Director"
            aria-label="New position"
            className={cn(inputClass, 'h-10')}
          />
          <button
            type="submit"
            disabled={add.isPending}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-70"
          >
            {add.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </button>
        </form>
        {error ? <p className="mt-2 text-xs font-semibold text-danger">{error}</p> : null}

        {presets.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground">Suggestions</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={add.isPending}
                  onClick={() => add.mutate(preset)}
                  className="flex h-8 items-center gap-1 rounded-full border border-[#c4c9d4] px-3 text-[13px] font-semibold text-ink/80 transition hover:border-brand-blue hover:text-brand-blue disabled:opacity-50"
                >
                  <Plus className="size-3.5" /> {preset}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}
