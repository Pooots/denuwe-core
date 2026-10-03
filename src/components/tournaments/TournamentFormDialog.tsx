import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { GitFork, GitMerge, Globe, LoaderCircle, Lock, Repeat, Trophy, User, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ClubSummary } from '@/types/club'
import type {
  TournamentBracket,
  TournamentDetail,
  TournamentFormat,
  TournamentPayload,
  TournamentVisibility,
} from '@/types/tournament'
import type { StagedMedia } from '@/components/tournaments/TournamentMedia'
import { inputClass } from '@/components/clubs/ClubForm'
import { ClubIcon } from '@/components/clubs/clubUi'
import { toDateInput } from '@/components/clubs/CreateActivityDialog'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { FriendPicker } from '@/components/tournaments/FriendPicker'
import { TournamentMediaFields, UNCHANGED, saveStagedMedia } from '@/components/tournaments/TournamentMedia'
import { BRACKET_INFO, storeTournament, tournamentKey, tournamentLink } from '@/components/tournaments/tournamentUi'
import { cn } from '@/lib/utils'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { tournamentService } from '@/services/tournamentService'

const MAX_TEAM_SIZE = 20

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">
        {label} {required ? <span className="text-danger">*</span> : null}
      </span>
      {children}
    </label>
  )
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; title: string; hint: string; icon: ReactNode }>
  onChange: (value: T) => void
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-muted-foreground">{label}</legend>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition',
                selected
                  ? 'border-brand-blue bg-brand-blue/5 ring-1 ring-brand-blue'
                  : 'border-[#c4c9d4] hover:border-ink/40',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',
                  selected ? 'bg-brand-blue text-white' : 'bg-muted text-ink/60',
                )}
              >
                {option.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-ink">{option.title}</span>
                <span className="block text-xs leading-snug text-muted-foreground">{option.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function timeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * Create a tournament (personal or for a club you organize) or edit one before it starts.
 * Pass `club` to host for that club, or `organizeClubs` to let the user choose.
 */
export function TournamentFormDialog({
  tournament,
  club,
  organizeClubs = [],
  onClose,
}: {
  tournament?: TournamentDetail
  club?: ClubSummary
  organizeClubs?: Array<ClubSummary>
  onClose: () => void
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const editing = tournament !== undefined
  const start = tournament ? new Date(tournament.starts_at) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const [hostId, setHostId] = useState<number | null>(club?.id ?? null)
  const [name, setName] = useState(tournament?.name ?? '')
  const [game, setGame] = useState(tournament?.game ?? '')
  const [format, setFormat] = useState<TournamentFormat>(tournament?.format ?? 'individual')
  const [teamSize, setTeamSize] = useState(String(tournament?.team_size ?? 5))
  const [bracket, setBracket] = useState<TournamentBracket>(tournament?.bracket ?? 'single_elimination')
  const [date, setDate] = useState(() => toDateInput(start))
  const [time, setTime] = useState(() => (tournament ? timeInput(start) : '09:00'))
  const [location, setLocation] = useState(tournament?.location ?? '')
  const [prize, setPrize] = useState(tournament?.prize ?? '')
  const [maxEntries, setMaxEntries] = useState(tournament?.max_entries ? String(tournament.max_entries) : '')
  const [description, setDescription] = useState(tournament?.description ?? '')
  const [visibility, setVisibility] = useState<TournamentVisibility>(tournament?.visibility ?? 'private')
  const [invites, setInvites] = useState<Set<number>>(new Set())
  const [avatar, setAvatar] = useState<StagedMedia>(UNCHANGED)
  const [banner, setBanner] = useState<StagedMedia>(UNCHANGED)
  const [error, setError] = useState<string | null>(null)

  const host = club ?? organizeClubs.find((c) => c.id === hostId) ?? null
  const formatLocked = editing && tournament.entries_count > 0
  const entryNoun = format === 'team' ? 'teams' : 'players'
  const maxAllowed = bracket === 'round_robin' ? 32 : 128
  /**
   * While there are brackets (and it stays a knockout), Max players is their slots added up, unless an elimination
   * stage decides who goes in them.
   */
  const bracketSlots = editing ? tournament.brackets.reduce((sum, b) => sum + b.size, 0) : 0
  const setByBrackets = bracketSlots > 0 && bracket !== 'round_robin' && !(editing && tournament.group_stage)

  const save = useMutation({
    mutationFn: async (payload: TournamentPayload) => {
      const result = editing
        ? await tournamentService.update(tournament.id, payload)
        : await tournamentService.create({ ...payload, club_id: host?.id ?? null, invite_ids: [...invites] })
      try {
        const media = await saveStagedMedia(result.tournament.id, { avatar, banner }, tournament)
        return { ...result, tournament: media?.tournament ?? result.tournament, mediaError: null }
      } catch (err) {
        return { ...result, mediaError: apiErrorMessage(err) }
      }
    },
    onSuccess: ({ message, tournament: saved, mediaError }) => {
      storeTournament(qc, saved)
      // A rename changes the slug; the open page sees the new one under its old key and moves to it.
      if (editing && saved.slug !== tournament.slug) qc.setQueryData(tournamentKey(tournament.slug), saved)
      toast(message)
      if (mediaError) toast(`The picture wasn’t saved: ${mediaError}`, 'error')
      onClose()
      if (!editing) void navigate(tournamentLink(saved))
    },
    onError: (err) => {
      const fieldErrors = apiValidationErrors(err)
      setError((fieldErrors && Object.values(fieldErrors)[0]?.[0]) || apiErrorMessage(err))
    },
  })

  const submit = () => {
    const when = date && time ? new Date(`${date}T${time}`) : null
    const valid = when && !Number.isNaN(when.getTime()) ? when : null
    const max = setByBrackets ? bracketSlots : maxEntries ? Number(maxEntries) : null
    const size = Number(teamSize)
    const problem = !name.trim()
      ? 'Give the tournament a name.'
      : format === 'team' && (!Number.isInteger(size) || size < 2 || size > MAX_TEAM_SIZE)
        ? `Teams need 2 to ${MAX_TEAM_SIZE} players.`
        : !valid
          ? 'Pick a date and time.'
          : !editing && valid.getTime() <= Date.now()
            ? 'Pick a date and time in the future.'
            : max !== null && (!Number.isInteger(max) || max < 2 || max > maxAllowed)
              ? `Max ${entryNoun} must be between 2 and ${maxAllowed}.`
              : null
    setError(problem)
    if (problem || !valid) return
    save.mutate({
      name,
      game,
      format,
      team_size: format === 'team' ? size : null,
      bracket,
      starts_at: valid.toISOString(),
      location,
      prize,
      max_entries: max,
      description,
      visibility,
    })
  }

  return (
    <Modal
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          {host ? (
            <ClubIcon
              color={host.color}
              type={host.type}
              src={host.avatar_url}
              className="size-10 rounded-lg"
              iconClassName="size-5"
            />
          ) : (
            <span className="brand-gradient grid size-10 shrink-0 place-items-center rounded-lg text-white">
              <Trophy className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-ink">{editing ? 'Edit tournament' : 'Create tournament'}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {host
                ? host.name
                : editing
                  ? 'Personal tournament'
                  : visibility === 'public'
                    ? 'Open to everyone'
                    : 'Invite people from your society'}
            </p>
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
        <div className="max-h-[65dvh] space-y-4 overflow-y-auto px-5 pb-5">
          <TournamentMediaFields
            color={host?.color ?? tournament?.club?.color ?? null}
            avatar={avatar}
            banner={banner}
            current={tournament}
            onChange={(type, staged) => (type === 'avatar' ? setAvatar : setBanner)(staged)}
            onError={setError}
          />

          {!editing && !club && organizeClubs.length > 0 ? (
            <Field label="Host">
              <select
                value={hostId ?? ''}
                onChange={(e) => setHostId(e.target.value ? Number(e.target.value) : null)}
                className={cn(inputClass, 'mt-1 h-10')}
              >
                <option value="">Just me (personal)</option>
                {organizeClubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Choice<TournamentVisibility>
            label="Who can see and join"
            value={visibility}
            onChange={setVisibility}
            options={[
              {
                value: 'public',
                title: 'Public',
                hint: 'Listed in Tournaments for everyone. Anyone can join.',
                icon: <Globe className="size-4" />,
              },
              {
                value: 'private',
                title: 'Private',
                hint: host
                  ? `Only ${host.name} members and people you invite from your society can join.`
                  : 'Only people you invite from your society can see it and join.',
                icon: <Lock className="size-4" />,
              },
            ]}
          />

          <Field label="Tournament name" required>
            <input
              autoFocus
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Inter-chapter 3x3 Cup"
              className={cn(inputClass, 'mt-1 h-10')}
            />
          </Field>

          <Field label="Game or sport">
            <input
              value={game}
              maxLength={80}
              onChange={(e) => setGame(e.target.value)}
              placeholder="e.g. Basketball, Chess, Mobile Legends"
              className={cn(inputClass, 'mt-1 h-10')}
            />
          </Field>

          <div>
            <Choice<TournamentFormat>
              label="Who plays"
              value={format}
              onChange={(next) => {
                if (!formatLocked) setFormat(next)
              }}
              options={[
                {
                  value: 'individual',
                  title: 'Individual',
                  hint: 'Each player enters on their own.',
                  icon: <User className="size-4" />,
                },
                {
                  value: 'team',
                  title: 'Teams',
                  hint: 'Players create or join a team.',
                  icon: <Users className="size-4" />,
                },
              ]}
            />
            {formatLocked ? (
              <p className="mt-1 text-xs text-muted-foreground">
                People already entered, so this can’t switch between individual and team.
              </p>
            ) : null}
          </div>

          {format === 'team' ? (
            <Field label="Players per team" required>
              <input
                type="number"
                inputMode="numeric"
                min={2}
                max={MAX_TEAM_SIZE}
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                className={cn(inputClass, 'mt-1 h-10 sm:w-40')}
              />
            </Field>
          ) : null}

          <Choice<TournamentBracket>
            label="Bracket"
            value={bracket}
            onChange={setBracket}
            options={[
              {
                value: 'single_elimination',
                title: BRACKET_INFO.single_elimination.label,
                hint: BRACKET_INFO.single_elimination.hint,
                icon: <GitFork className="size-4 rotate-90" />,
              },
              {
                value: 'double_elimination',
                title: BRACKET_INFO.double_elimination.label,
                hint: BRACKET_INFO.double_elimination.hint,
                icon: <GitMerge className="size-4 rotate-90" />,
              },
              {
                value: 'round_robin',
                title: BRACKET_INFO.round_robin.label,
                hint: BRACKET_INFO.round_robin.hint,
                icon: <Repeat className="size-4" />,
              },
            ]}
          />
          {bracket === 'round_robin' && (bracketSlots > 0 || (editing && tournament.group_stage)) ? (
            <p className="-mt-2 text-xs text-amber-700">
              Switching to round robin{' '}
              {[
                bracketSlots > 0 ? 'deletes your brackets' : '',
                editing && tournament.group_stage ? 'turns off the elimination stage' : '',
              ]
                .filter(Boolean)
                .join(' and ')}
              .
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" required>
              <input
                type="date"
                value={date}
                min={editing ? undefined : toDateInput(new Date())}
                onChange={(e) => setDate(e.target.value)}
                className={cn(inputClass, 'mt-1 h-10')}
              />
            </Field>
            <Field label="Start time" required>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={cn(inputClass, 'mt-1 h-10')}
              />
            </Field>
          </div>

          <Field label="Venue">
            <input
              value={location}
              maxLength={120}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where will it be held?"
              className={cn(inputClass, 'mt-1 h-10')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Prize">
              <input
                value={prize}
                maxLength={120}
                onChange={(e) => setPrize(e.target.value)}
                placeholder="e.g. ₱5,000 + trophy"
                className={cn(inputClass, 'mt-1 h-10')}
              />
            </Field>
            <Field label={`Max ${entryNoun}`}>
              <input
                type="number"
                inputMode="numeric"
                min={2}
                max={maxAllowed}
                value={setByBrackets ? String(bracketSlots) : maxEntries}
                disabled={setByBrackets}
                onChange={(e) => setMaxEntries(e.target.value)}
                placeholder="No limit"
                className={cn(inputClass, 'mt-1 h-10 disabled:opacity-60')}
              />
              {setByBrackets ? (
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Set by your brackets ({bracketSlots} slots). Change a bracket’s size to change it.
                </span>
              ) : null}
            </Field>
          </div>

          <Field label="Rules & details">
            <textarea
              value={description}
              maxLength={2000}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Match format, rules, registration fee, what to bring…"
              className={cn(inputClass, 'mt-1 resize-none py-2')}
            />
          </Field>

          {!editing ? (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Invite from your society{' '}
                <span className="font-normal">
                  {visibility === 'public'
                    ? '(optional, anyone can join a public tournament)'
                    : host
                      ? `(optional, ${host.name} members can join anyway)`
                      : '(only invited people can enter)'}
                </span>
              </p>
              <FriendPicker selected={invites} onChange={setInvites} className="mt-1" />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-danger">{error}</p>
          <button
            type="submit"
            disabled={save.isPending}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-70"
          >
            {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {editing ? 'Save changes' : invites.size ? `Create & invite ${invites.size}` : 'Create tournament'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
