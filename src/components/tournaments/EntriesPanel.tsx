import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Crown, LoaderCircle, Plus, UserPlus, Users, X } from 'lucide-react'
import type { TournamentDetail, TournamentEntry } from '@/types/tournament'
import { inputClass } from '@/components/clubs/ClubForm'
import { Avatar } from '@/components/feed/Avatar'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { GroupSlotBoard } from '@/components/tournaments/GroupStage'
import { entryWord, storeTournament } from '@/components/tournaments/tournamentUi'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { tournamentService } from '@/services/tournamentService'

export function CreateTeamDialog({ detail, onClose }: { detail: TournamentDetail; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: () => tournamentService.join(detail.id, { team_name: name }),
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
      onClose()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <Modal
      onClose={onClose}
      className="max-w-[420px]"
      title={
        <div>
          <h2 className="text-[17px] font-semibold text-ink">Create a team</h2>
          <p className="text-xs text-muted-foreground">
            You’ll be the captain. Up to {detail.team_size} players can join.
          </p>
        </div>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) setError('Give your team a name.')
          else create.mutate()
        }}
      >
        <div className="px-5 pb-4">
          <input
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team name"
            aria-label="Team name"
            className={cn(inputClass, 'h-10')}
          />
        </div>
        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-danger">{error}</p>
          <button
            type="submit"
            disabled={create.isPending}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-70"
          >
            {create.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Create team
          </button>
        </div>
      </form>
    </Modal>
  )
}

function useEntryActions(detail: TournamentDetail) {
  const qc = useQueryClient()
  const onSuccess = ({ message, tournament }: { message: string; tournament: TournamentDetail }) => {
    storeTournament(qc, tournament)
    toast(message)
  }
  const onError = (err: unknown) => toast(apiErrorMessage(err), 'error')

  return {
    joinTeam: useMutation({
      mutationFn: (entryId: number) => tournamentService.join(detail.id, { entry_id: entryId }),
      onSuccess,
      onError,
    }),
    remove: useMutation({
      mutationFn: (entryId: number) => tournamentService.removeEntry(detail.id, entryId),
      onSuccess,
      onError,
    }),
  }
}

function RemoveButton({ entry, onRemove, busy }: { entry: TournamentEntry; onRemove: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${entry.name}`}
      title={`Remove ${entry.name}`}
      disabled={busy}
      onClick={() => {
        if (window.confirm(`Remove ${entry.name} from the tournament?`)) onRemove()
      }}
      className="grid size-7 shrink-0 place-items-center rounded-full text-ink/40 transition hover:bg-muted hover:text-danger disabled:opacity-50"
    >
      <X className="size-4" />
    </button>
  )
}

function SlotChip({ slot }: { slot: number }) {
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-ink/70">
      Slot {slot}
    </span>
  )
}

export function EntriesPanel({ detail, onCreateTeam }: { detail: TournamentDetail; onCreateTeam: () => void }) {
  const { joinTeam, remove } = useEntryActions(detail)
  const registering = detail.status === 'registration'
  const canRemove = detail.can_manage && registering
  const isTeam = detail.format === 'team'
  const ordered = registering ? detail.entries : [...detail.entries].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))

  return (
    <div className="space-y-2">
      <section className="rounded-xl border border-border bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">{isTeam ? 'Teams' : 'Players'}</h2>
            <p className="text-xs text-muted-foreground">
              {entryWord(detail, detail.entries_count)}
              {detail.max_entries ? ` of ${detail.max_entries}` : ''}
              {isTeam ? ` · ${detail.players_count} ${detail.players_count === 1 ? 'player' : 'players'}` : ''}
            </p>
          </div>
          {isTeam && detail.can_enter && !detail.is_full ? (
            <button
              type="button"
              onClick={onCreateTeam}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
            >
              <Plus className="size-4" /> Create a team
            </button>
          ) : null}
        </div>

        {detail.entries.length === 0 ? (
          <div className="py-8 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-blue/10 text-brand-blue">
              <Users className="size-6" />
            </span>
            <p className="mt-2 text-[14px] font-semibold text-ink">No {isTeam ? 'teams' : 'players'} yet</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {detail.visibility === 'public'
                ? 'It’s public, so anyone can join.'
                : detail.club
                  ? `${detail.club.name} members and invited friends can enter.`
                  : 'Invited friends can enter once they accept.'}
            </p>
          </div>
        ) : isTeam ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {ordered.map((entry) => {
              const size = detail.team_size ?? 0
              const open = size - entry.members.length
              const mine = entry.id === detail.my_entry_id
              return (
                <li
                  key={entry.id}
                  className={cn(
                    'rounded-lg border px-3 py-2.5',
                    mine ? 'border-brand-blue/50 bg-brand-blue/5' : 'border-border',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {entry.seed ? (
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-ink/70">
                        {entry.seed}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">{entry.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {entry.members.length} / {size} players{mine ? ' · Your team' : ''}
                      </span>
                    </span>
                    {registering && entry.group_slot ? <SlotChip slot={entry.group_slot} /> : null}
                    {canRemove ? (
                      <RemoveButton entry={entry} busy={remove.isPending} onRemove={() => remove.mutate(entry.id)} />
                    ) : null}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {entry.members.map((member) => (
                      <li key={member.id} className="flex items-center gap-2 text-[13px]">
                        <Avatar name={member.name} src={member.avatar_url} className="size-6 text-[9px]" />
                        <Link
                          to="/people/$userId"
                          params={{ userId: String(member.id) }}
                          className="min-w-0 truncate text-ink hover:underline"
                        >
                          {member.name}
                        </Link>
                        {member.id === entry.captain_id ? (
                          <span className="flex items-center gap-0.5 text-[11px] font-semibold text-amber-700">
                            <Crown className="size-3" /> Captain
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {detail.can_enter && open > 0 ? (
                    <button
                      type="button"
                      disabled={joinTeam.isPending}
                      onClick={() => joinTeam.mutate(entry.id)}
                      className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-full border border-brand-blue text-[13px] font-semibold text-brand-blue transition hover:bg-brand-blue/5 disabled:opacity-60"
                    >
                      <UserPlus className="size-4" /> Join team · {open} {open === 1 ? 'spot' : 'spots'} left
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {ordered.map((entry) => {
              const player = entry.members.at(0)
              const mine = entry.id === detail.my_entry_id
              return (
                <li key={entry.id} className="flex items-center gap-2.5 border-b border-border py-2">
                  {entry.seed ? (
                    <span className="w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground">
                      {entry.seed}
                    </span>
                  ) : null}
                  <Avatar name={entry.name} src={player?.avatar_url} className="size-9 text-xs" />
                  {player ? (
                    <Link
                      to="/people/$userId"
                      params={{ userId: String(player.id) }}
                      className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink hover:underline"
                    >
                      {entry.name}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-[14px] text-muted-foreground">{entry.name}</span>
                  )}
                  {registering && entry.group_slot ? <SlotChip slot={entry.group_slot} /> : null}
                  {mine ? (
                    <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[11px] font-semibold text-brand-blue">
                      You
                    </span>
                  ) : null}
                  {canRemove ? (
                    <RemoveButton entry={entry} busy={remove.isPending} onRemove={() => remove.mutate(entry.id)} />
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <GroupSlotBoard detail={detail} />
    </div>
  )
}
