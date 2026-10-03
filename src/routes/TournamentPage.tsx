import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import {
  ArrowLeft,
  Camera,
  Check,
  Clock,
  Crown,
  GitFork,
  Globe,
  Info,
  LoaderCircle,
  Lock,
  MapPin,
  Move,
  Pencil,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { TournamentMedia } from '@/services/tournamentService'
import type { Bracket, TournamentDetail, TournamentMatch } from '@/types/tournament'
import { ClubIcon, activityWhen, clubLink, plural } from '@/components/clubs/clubUi'
import { Avatar } from '@/components/feed/Avatar'
import { FeedNavbar } from '@/components/feed/FeedNavbar'
import { MessagingDock } from '@/components/feed/MessagingDock'
import { Toaster, toast } from '@/components/feed/Toaster'
import {
  BracketBoard,
  BracketHeading,
  DrawCanvas,
  EliminationBracket,
  bracketLayout,
  byePairs,
  fullSize,
  startIssue,
  upperByes,
} from '@/components/tournaments/BracketBoard'
import { BracketEditor } from '@/components/tournaments/BracketEditor'
import { BracketFormDialog, deleteBracketQuestion } from '@/components/tournaments/BracketFormDialog'
import { RoundRobinBoard } from '@/components/tournaments/BracketViews'
import { DoubleBoard } from '@/components/tournaments/DoubleBracket'
import { CreateTeamDialog, EntriesPanel } from '@/components/tournaments/EntriesPanel'
import { GameSetupPanel } from '@/components/tournaments/GameSetup'
import { GroupStagePanel } from '@/components/tournaments/GroupStage'
import { StandingsPanel } from '@/components/tournaments/Standings'
import { InviteDialog } from '@/components/tournaments/InviteDialog'
import { ShareTournamentButton } from '@/components/tournaments/ShareTournament'
import { MatchResultDialog } from '@/components/tournaments/MatchResultDialog'
import { TournamentFormDialog } from '@/components/tournaments/TournamentFormDialog'
import { MediaInput, TournamentBanner, mediaButton, mediaProblem } from '@/components/tournaments/TournamentMedia'
import {
  BRACKET_INFO,
  GROUP_STAGE_INFO,
  StatusPill,
  TournamentBadge,
  bracketEntries,
  entryWord,
  formatLabel,
  inGroupStage,
  isDrawing,
  refreshTournamentLists,
  scopeBracket,
  storeTournament,
  tournamentKey,
  tournamentLink,
} from '@/components/tournaments/tournamentUi'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { tournamentService } from '@/services/tournamentService'

type Tab = 'elimination' | 'bracket' | 'schedule' | 'standings' | 'entries'

/** Tailwind's `lg`: the page gets its sidebar from here up. */
const LARGE = '(min-width: 1024px)'

function useLarge(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(LARGE)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia(LARGE).matches,
  )
}

/** Knockout tournaments with an elimination stage, and organizers who might add one before the start. */
const hasEliminationTab = (detail: TournamentDetail) =>
  detail.bracket !== 'round_robin' &&
  (detail.group_stage !== null || (detail.can_manage && detail.status === 'registration'))

const primaryButton =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-60'
const outlineButton =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-[#c4c9d4] px-4 text-[13px] font-semibold text-ink/80 transition hover:bg-muted disabled:opacity-60'

function useTournamentAction<T>(
  fn: (arg: T) => Promise<{ message: string; tournament: TournamentDetail }>,
  onDone?: (tournament: TournamentDetail) => void,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: ({ message, tournament }) => {
      storeTournament(qc, tournament)
      toast(message)
      onDone?.(tournament)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })
}

function ViewerActions({
  detail,
  viewerId,
  onCreateTeam,
}: {
  detail: TournamentDetail
  viewerId: number
  onCreateTeam: () => void
}) {
  const qc = useQueryClient()
  const join = useTournamentAction(() => tournamentService.join(detail.id))
  const leave = useTournamentAction(() => tournamentService.leave(detail.id))
  const decline = useMutation({
    mutationFn: () => tournamentService.uninvite(detail.id, viewerId),
    onSuccess: ({ message }) => {
      toast(message)
      refreshTournamentLists(qc)
      void qc.invalidateQueries({ queryKey: tournamentKey(detail.slug) })
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })

  const myEntry = detail.entries.find((e) => e.id === detail.my_entry_id)
  const registering = detail.status === 'registration'
  const isTeam = detail.format === 'team'

  if (myEntry) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-3 py-1.5 text-[13px] font-semibold text-emerald-700">
          <Check className="size-4" />
          {detail.status === 'completed'
            ? `You played${isTeam ? ` with ${myEntry.name}` : ''}`
            : isTeam
              ? `You’re on ${myEntry.name}`
              : 'You’re in'}
        </span>
        {registering ? (
          <button
            type="button"
            disabled={leave.isPending}
            onClick={() => {
              if (window.confirm(`Leave ${detail.name}?`)) leave.mutate(undefined)
            }}
            className="h-8 rounded-full px-3 text-[13px] font-semibold text-ink/60 transition hover:bg-muted hover:text-danger disabled:opacity-50"
          >
            Leave
          </button>
        ) : null}
      </div>
    )
  }

  if (!registering) return null

  const enter = isTeam ? (
    <button
      type="button"
      onClick={onCreateTeam}
      disabled={detail.is_full}
      className={cn(primaryButton, 'h-10 flex-1 sm:h-9 sm:flex-none')}
    >
      <Users className="size-4" /> {detail.is_full ? 'Full' : 'Create a team'}
    </button>
  ) : (
    <button
      type="button"
      disabled={join.isPending || detail.is_full}
      onClick={() => join.mutate(undefined)}
      className={cn(primaryButton, 'h-10 flex-1 sm:h-9 sm:flex-none')}
    >
      {join.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Trophy className="size-4" />}
      {detail.is_full ? 'Full' : 'Join tournament'}
    </button>
  )

  if (detail.invite_pending) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-400/10 px-3 py-2.5">
        {detail.invited_by ? (
          <Avatar name={detail.invited_by.name} src={detail.invited_by.avatar_url} className="size-8 text-[11px]" />
        ) : null}
        <p className="min-w-0 flex-1 text-[13px] text-ink">
          <strong className="font-semibold">{detail.invited_by?.name ?? 'The organizer'}</strong> invited you to play.
          {isTeam ? ' Create a team or join one below.' : ''}
        </p>
        <span className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            disabled={decline.isPending}
            onClick={() => decline.mutate()}
            className="h-9 rounded-full px-3 text-[13px] font-semibold text-ink/60 transition hover:bg-white hover:text-ink disabled:opacity-50"
          >
            Decline
          </button>
          {enter}
        </span>
      </div>
    )
  }

  if (detail.can_enter) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {enter}
        {isTeam ? (
          <span className="w-full text-center text-xs text-muted-foreground sm:w-auto sm:text-left">
            or join a team with open spots below
          </span>
        ) : null}
      </div>
    )
  }

  if (detail.club) {
    return (
      <p className="text-[13px] text-muted-foreground">
        <Link {...clubLink(detail.club)} className="font-semibold text-brand-blue hover:underline">
          Join {detail.club.name}
        </Link>{' '}
        to enter this tournament.
      </p>
    )
  }
  return null
}

/** Banner and profile picture; organizers can change or remove either right here. */
function Cover({ detail }: { detail: TournamentDetail }) {
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)
  const [avatarMenu, setAvatarMenu] = useState(false)
  const upload = useTournamentAction(({ type, file }: { type: TournamentMedia; file: File }) =>
    tournamentService.uploadMedia(detail.id, type, file),
  )
  const remove = useTournamentAction((type: TournamentMedia) => tournamentService.removeMedia(detail.id, type))
  const busy = upload.isPending || remove.isPending
  const pending = upload.isPending ? upload.variables.type : remove.isPending ? remove.variables : null

  const pick = (type: TournamentMedia) => (file: File) => {
    const problem = mediaProblem(type, file)
    if (problem) toast(problem, 'error')
    else upload.mutate({ type, file })
  }

  return (
    <>
      <TournamentBanner src={detail.banner_url} color={detail.club?.color ?? null} className="h-28 sm:h-44">
        {detail.can_manage ? (
          <div className="absolute top-3 right-3 flex gap-1.5">
            {detail.banner_url ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Remove the banner?')) remove.mutate('banner')
                }}
                className={cn(mediaButton, 'hover:text-danger')}
              >
                <Trash2 className="size-3.5" /> Remove
              </button>
            ) : null}
            <button type="button" disabled={busy} onClick={() => bannerInput.current?.click()} className={mediaButton}>
              {pending === 'banner' ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Camera className="size-3.5" />
              )}
              {detail.banner_url ? 'Change banner' : 'Upload banner'}
            </button>
          </div>
        ) : null}
      </TournamentBanner>

      <div className="relative -mt-9 ml-4 w-fit sm:-mt-10 sm:ml-6">
        <TournamentBadge
          tournament={detail}
          className="size-[72px] rounded-2xl border-4 border-white shadow-sm sm:size-20"
        />
        {pending === 'avatar' ? (
          <span className="absolute inset-1 grid place-items-center rounded-xl bg-black/40 text-white">
            <LoaderCircle className="size-6 animate-spin" />
          </span>
        ) : null}
        {detail.can_manage ? (
          <>
            <button
              type="button"
              aria-label="Change tournament profile picture"
              aria-expanded={detail.avatar_url ? avatarMenu : undefined}
              disabled={busy}
              onClick={() => (detail.avatar_url ? setAvatarMenu((open) => !open) : avatarInput.current?.click())}
              className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border-2 border-white bg-brand-blue text-white shadow transition hover:bg-brand-blue/90 disabled:opacity-60"
            >
              <Camera className="size-4" />
            </button>
            {avatarMenu ? (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setAvatarMenu(false)}
                />
                <div
                  role="menu"
                  className="absolute top-full left-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-white py-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAvatarMenu(false)
                      avatarInput.current?.click()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold text-ink hover:bg-muted"
                  >
                    <Camera className="size-4 text-ink/60" /> Change picture
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAvatarMenu(false)
                      if (window.confirm('Remove the profile picture?')) remove.mutate('avatar')
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold text-ink hover:bg-muted hover:text-danger"
                  >
                    <Trash2 className="size-4 text-ink/60" /> Remove picture
                  </button>
                </div>
              </>
            ) : null}
            <MediaInput inputRef={avatarInput} label="Upload tournament profile picture" onPick={pick('avatar')} />
            <MediaInput inputRef={bannerInput} label="Upload tournament banner" onPick={pick('banner')} />
          </>
        ) : null}
      </div>
    </>
  )
}

function OrganizerCard({
  detail,
  onEdit,
  onInvite,
  onCreateBracket,
  onTab,
}: {
  detail: TournamentDetail
  onEdit: () => void
  onInvite: () => void
  onCreateBracket: () => void
  onTab: (tab: Tab) => void
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const start = useTournamentAction(
    () => tournamentService.start(detail.id),
    (next) => onTab(next.stage === 'groups' ? 'elimination' : 'bracket'),
  )
  const reset = useTournamentAction(
    () => tournamentService.reset(detail.id),
    (next) => onTab(next.stage === 'groups' ? 'elimination' : 'entries'),
  )
  const remove = useMutation({
    mutationFn: () => tournamentService.remove(detail.id),
    onSuccess: () => {
      refreshTournamentLists(qc)
      qc.removeQueries({ queryKey: tournamentKey(detail.slug) })
      toast('Tournament deleted.')
      void navigate({ to: '/tournaments' })
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })
  const registering = detail.status === 'registration'
  const groupsLive = inGroupStage(detail)
  const words = detail.format === 'team' ? 'teams' : 'players'
  const knockout = detail.bracket !== 'round_robin'
  const grouped = knockout && detail.group_stage !== null
  const moving = detail.entries.filter((e) => e.advanced).length
  /** Who goes in the brackets when they start: everyone, or those moving on. */
  const pool = groupsLive ? moving : detail.entries_count
  const placedCount = detail.brackets.reduce((sum, b) => sum + (b.draw ?? []).filter((id) => id !== null).length, 0)
  const notPlaced = pool - placedCount
  const hasBracket = detail.brackets.length > 0
  const brackets = detail.brackets.length > 1 ? 'brackets' : 'bracket'
  const needed = registering && grouped ? Math.max(2, detail.group_count * 2) : 2
  const enough = pool >= needed
  const backToGroups = detail.groups.length > 0 && detail.stage === 'knockout'

  let startNote: string
  let startLabel = 'Start tournament'
  let startQuestion = `Start ${detail.name} with ${entryWord(detail, detail.entries_count)}? Registration closes.`
  if (groupsLive) {
    startLabel = 'Start bracket'
    startQuestion = `Start the bracket with ${moving} moving on? The elimination stage results become final.`
    startNote = !enough
      ? `Tick at least 2 ${words} to move on in the Elimination tab.`
      : hasBracket
        ? `Starting fills your ${brackets} with the ${moving} moving on${notPlaced > 0 ? ` (${notPlaced} not placed yet go into random open slots)` : ''}. The elimination stage results become final.`
        : `Starting draws one bracket at random from the ${moving} moving on. Create a bracket first to name it and pick who plays who.`
  } else if (grouped) {
    startLabel = 'Start elimination stage'
    startQuestion = `Start the elimination stage with ${entryWord(detail, detail.entries_count)} in ${plural(detail.group_count, 'group')}? Registration closes.`
    startNote = !enough
      ? `${plural(detail.group_count, 'group')} ${detail.group_count === 1 ? 'needs' : 'need'} at least ${needed} ${words} to start. Wait for more${detail.group_count > 1 ? ', or use fewer groups' : ''}.`
      : `Starting puts the ${entryWord(detail, detail.entries_count)} into ${plural(detail.group_count, 'group')} by their slots (anyone not placed in the Players tab is drawn into an open slot), creates every group match and closes registration.`
  } else {
    startNote = !enough
      ? `You need at least 2 ${words} to start.`
      : knockout && hasBracket
        ? `Starting uses your ${brackets}${notPlaced > 0 ? ` (${entryWord(detail, notPlaced)} not placed go into random open slots)` : ''} and closes registration.`
        : knockout
          ? `Starting draws one bracket at random and closes registration (${entryWord(detail, detail.entries_count)}). Create a bracket first to name it and pick who plays who.`
          : `Starting creates every match and closes registration (${entryWord(detail, detail.entries_count)}).`
  }

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3">
      <h2 className="text-[15px] font-semibold text-ink">Organizer tools</h2>
      {registering || groupsLive ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{startNote}</p>
          <button
            type="button"
            disabled={!enough || start.isPending}
            onClick={() => {
              if (window.confirm(startQuestion)) start.mutate(undefined)
            }}
            className={cn(primaryButton, 'mt-3 h-10 w-full lg:h-9')}
          >
            {start.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
            {startLabel}
          </button>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {detail.status === 'completed'
            ? 'The tournament is over. You can still correct results.'
            : 'Click a match in the bracket to enter its result.'}
        </p>
      )}
      <div className="scrollbar-none -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 *:shrink-0 *:whitespace-nowrap lg:mx-0 lg:grid lg:overflow-visible lg:px-0">
        {(registering || groupsLive) && knockout ? (
          <button type="button" onClick={onCreateBracket} className={outlineButton}>
            {hasBracket ? <Plus className="size-4" /> : <GitFork className="size-4 rotate-90" />}
            {hasBracket ? 'Create another bracket' : 'Create bracket'}
          </button>
        ) : null}
        {detail.status !== 'completed' ? (
          <button type="button" onClick={onInvite} className={outlineButton}>
            <UserPlus className="size-4" /> Invite from society
          </button>
        ) : null}
        {registering ? (
          <button type="button" onClick={onEdit} className={outlineButton}>
            <Pencil className="size-4" /> Edit details
          </button>
        ) : (
          <button
            type="button"
            disabled={reset.isPending}
            onClick={() => {
              const question = groupsLive
                ? 'Reset the elimination stage? Every group result is cleared and registration reopens.'
                : backToGroups
                  ? 'Reset the bracket? Its results are cleared and you go back to the elimination stage (group results stay).'
                  : 'Reset the bracket? Every result is cleared and registration reopens.'
              if (window.confirm(question)) reset.mutate(undefined)
            }}
            className={outlineButton}
          >
            <RotateCcw className="size-4" /> {groupsLive ? 'Reset elimination stage' : 'Reset bracket'}
          </button>
        )}
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Delete “${detail.name}”? This can’t be undone.`)) remove.mutate()
          }}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink/60 transition hover:bg-muted hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="size-4" /> Delete tournament
        </button>
      </div>
    </section>
  )
}

function InvitedCard({ detail }: { detail: TournamentDetail }) {
  const withdraw = useTournamentAction(async (userId: number) => {
    const result = await tournamentService.uninvite(detail.id, userId)
    return { message: result.message, tournament: result.tournament ?? detail }
  })
  if (!detail.can_manage || detail.invites.length === 0) return null

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3">
      <h2 className="text-[15px] font-semibold text-ink">Invited</h2>
      <p className="text-xs text-muted-foreground">
        {detail.invites.length} waiting to {detail.format === 'team' ? 'create or join a team' : 'join'}
      </p>
      <ul className="mt-2 divide-y divide-border">
        {detail.invites.map((invite) => (
          <li key={invite.user.id} className="flex items-center gap-2 py-2">
            <Avatar name={invite.user.name} src={invite.user.avatar_url} className="size-8 text-[11px]" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{invite.user.name}</span>
            <button
              type="button"
              aria-label={`Withdraw invite for ${invite.user.name}`}
              title="Withdraw invite"
              disabled={withdraw.isPending}
              onClick={() => withdraw.mutate(invite.user.id)}
              className="grid size-7 place-items-center rounded-full text-ink/40 transition hover:bg-muted hover:text-danger disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DetailRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-2.5 py-1.5 text-[13px] text-ink/80">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}

function DetailsCard({ detail }: { detail: TournamentDetail }) {
  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3">
      <h2 className="text-[15px] font-semibold text-ink">Details</h2>
      <ul className="mt-1">
        <DetailRow icon={<Clock className="size-4" />}>{activityWhen(detail.starts_at)}</DetailRow>
        {detail.location ? <DetailRow icon={<MapPin className="size-4" />}>{detail.location}</DetailRow> : null}
        {detail.prize ? (
          <DetailRow icon={<Trophy className="size-4 text-amber-600" />}>
            <span className="font-semibold text-amber-700">{detail.prize}</span>
          </DetailRow>
        ) : null}
        <DetailRow icon={<Users className="size-4" />}>{formatLabel(detail)}</DetailRow>
        <DetailRow icon={<GitFork className="size-4 rotate-90" />}>
          <span className="font-semibold text-ink">{BRACKET_INFO[detail.bracket].label}.</span>{' '}
          {BRACKET_INFO[detail.bracket].hint}
        </DetailRow>
        {detail.group_stage ? (
          <DetailRow icon={<Repeat className="size-4" />}>
            <span className="font-semibold text-ink">Elimination stage first.</span>{' '}
            {GROUP_STAGE_INFO[detail.group_stage].label}
            {detail.group_count > 1 ? ` in ${detail.group_count} groups` : ''}; the best move on to the bracket.
          </DetailRow>
        ) : null}
        <DetailRow
          icon={
            <Avatar name={detail.created_by.name} src={detail.created_by.avatar_url} className="size-4 text-[7px]" />
          }
        >
          Organized by{' '}
          <Link
            to="/people/$userId"
            params={{ userId: String(detail.created_by.id) }}
            className="font-semibold text-ink hover:underline"
          >
            {detail.created_by.name}
          </Link>
        </DetailRow>
      </ul>
      {detail.description ? (
        <p className="mt-2 border-t border-border pt-2 text-[13px] leading-relaxed whitespace-pre-line text-ink/80">
          {detail.description}
        </p>
      ) : null}
    </section>
  )
}

function Tabs({ detail, active, onChange }: { detail: TournamentDetail; active: Tab; onChange: (tab: Tab) => void }) {
  const navRef = useRef<HTMLElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  // Phones scroll the tab bar sideways; keep the open tab in view without scrolling the page.
  useEffect(() => {
    const nav = navRef.current
    const button = activeRef.current
    if (!nav || !button) return
    const left = button.offsetLeft - 8
    const right = button.offsetLeft + button.offsetWidth + 8
    if (left < nav.scrollLeft) nav.scrollTo({ left, behavior: 'smooth' })
    else if (right > nav.scrollLeft + nav.clientWidth)
      nav.scrollTo({ left: right - nav.clientWidth, behavior: 'smooth' })
  }, [active])
  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    ...(hasEliminationTab(detail) ? [{ id: 'elimination' as const, label: 'Elimination' }] : []),
    { id: 'bracket', label: detail.bracket === 'round_robin' ? 'Standings & matches' : 'Bracket' },
    { id: 'schedule', label: 'Game setup' },
    { id: 'standings', label: 'Standings' },
    { id: 'entries', label: detail.format === 'team' ? 'Teams' : 'Players', count: detail.entries_count },
  ]
  return (
    <nav
      ref={navRef}
      role="tablist"
      aria-label="Tournament sections"
      className="scrollbar-none relative flex gap-0.5 overflow-x-auto border-t border-border px-1.5 sm:gap-1 sm:px-4"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            ref={selected ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex h-12 shrink-0 items-center gap-1.5 px-2.5 text-[14px] font-semibold whitespace-nowrap transition sm:px-3',
              selected ? 'text-brand-blue' : 'text-ink/60 hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count ? (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] leading-[18px]',
                  selected ? 'bg-brand-blue/10' : 'bg-muted text-ink/60',
                )}
              >
                {tab.count}
              </span>
            ) : null}
            {selected ? <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-brand-blue" /> : null}
          </button>
        )
      })}
    </nav>
  )
}

/** One named bracket: its board, and for organizers the tools to place players, edit or delete it. */
function DeleteBracketButton({ detail, bracket }: { detail: TournamentDetail; bracket: Bracket }) {
  const remove = useTournamentAction(() => tournamentService.removeBracket(detail.id, bracket.id))
  return (
    <button
      type="button"
      aria-label={`Delete ${bracket.name}`}
      disabled={remove.isPending}
      onClick={() => {
        if (window.confirm(deleteBracketQuestion(detail, bracket))) remove.mutate(undefined)
      }}
      className={cn(outlineButton, 'text-danger hover:border-danger/40 hover:bg-danger/5 disabled:opacity-50')}
    >
      {remove.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete
    </button>
  )
}

function BracketSection({
  detail,
  bracket,
  editing,
  onEditing,
  onOpen,
  onBracketForm,
}: {
  detail: TournamentDetail
  bracket: Bracket
  editing: boolean
  onEditing: (editing: boolean) => void
  onOpen: (match: TournamentMatch) => void
  onBracketForm: (bracket?: Bracket) => void
}) {
  const scope = scopeBracket(detail, bracket)
  const drawing = isDrawing(detail)
  /** Registration with an elimination stage: nobody can be placed until it picks who moves on. */
  const waiting = detail.status === 'registration' && detail.group_stage !== null
  const double = detail.bracket === 'double_elimination'
  const words = detail.format === 'team' ? 'teams' : 'players'
  const slots = bracket.draw ?? Array<null>(bracket.size).fill(null)
  const placed = slots.filter((id) => id !== null).length
  const champion = scope.winner

  if (drawing && !waiting && editing && detail.can_manage) {
    return (
      <section className="rounded-xl border border-border bg-white px-4 py-4 sm:px-5">
        <BracketHeading
          title={bracket.name}
          note={
            detail.group_stage
              ? `Put the ${words} moving on where you want them. Anyone you tick later shows up here too.`
              : `Put the ${words} where you want them. You can keep placing people as they join.`
          }
        >
          <DeleteBracketButton detail={detail} bracket={bracket} />
        </BracketHeading>
        <BracketEditor scope={scope} onDone={() => onEditing(false)} />
      </section>
    )
  }

  const layout = bracketLayout(bracket.size, bracket.opening ?? undefined)
  let board: ReactNode
  if (drawing) {
    board = double ? (
      <DoubleBoard
        scope={scope}
        size={fullSize(bracket.size)}
        byes={byePairs(layout)}
        previewByes={byePairs(layout)}
        renderUpper={(embedding) => <DrawCanvas scope={scope} slots={slots} embedding={embedding} />}
      />
    ) : (
      <DrawCanvas scope={scope} slots={slots} />
    )
  } else {
    board = double ? (
      <DoubleBoard
        scope={scope}
        size={2 ** bracket.rounds}
        byes={upperByes(scope)}
        renderUpper={(embedding) => <EliminationBracket scope={scope} onOpen={onOpen} embedding={embedding} />}
        onOpen={onOpen}
      />
    ) : (
      <EliminationBracket scope={scope} onOpen={onOpen} />
    )
  }

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-4 sm:px-5">
      <BracketHeading
        title={bracket.name}
        note={
          waiting
            ? detail.can_manage
              ? `${bracket.size} slots. You place the ${words} who move on from the elimination stage here once it’s under way.`
              : `${bracket.size} slots for the ${words} who move on from the elimination stage.`
            : drawing
              ? detail.can_manage
                ? `${bracket.size} slots, ${placed} placed. Players can see it; change it any time before you start.`
                : `${bracket.size} slots. Drawn by the organizer; it can still change before the start.`
              : detail.can_manage && detail.status === 'in_progress' && !champion
                ? 'Click a player in a match to enter the result. Winners move on automatically.'
                : undefined
        }
      >
        {champion && detail.brackets.length > 1 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-[12px] font-semibold text-amber-800">
            <Crown className="size-3.5" /> {champion.name}
          </span>
        ) : null}
        {detail.can_manage && drawing && !waiting ? (
          <button type="button" onClick={() => onEditing(true)} className={primaryButton}>
            <Move className="size-4" /> Place {words}
          </button>
        ) : null}
        {detail.can_manage ? (
          <button
            type="button"
            aria-label={`Edit ${bracket.name}`}
            onClick={() => onBracketForm(bracket)}
            className={outlineButton}
          >
            <Pencil className="size-4" /> Edit
          </button>
        ) : null}
        {detail.can_manage ? <DeleteBracketButton detail={detail} bracket={bracket} /> : null}
      </BracketHeading>
      <BracketBoard>{board}</BracketBoard>
    </section>
  )
}

function BracketPanel({
  detail,
  arranging,
  onArrange,
  onOpen,
  onBracketForm,
}: {
  detail: TournamentDetail
  /** The bracket the organizer is placing players in. */
  arranging: number | null
  onArrange: (bracketId: number | null) => void
  onOpen: (match: TournamentMatch) => void
  onBracketForm: (bracket?: Bracket) => void
}) {
  const roundRobin = detail.bracket === 'round_robin'
  const words = detail.format === 'team' ? 'teams' : 'players'

  if (detail.status === 'registration' && roundRobin) {
    return (
      <section className="rounded-xl border border-border bg-white px-5 py-10 text-center sm:px-6">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-400/15 text-amber-700">
          <GitFork className="size-6 rotate-90" />
        </span>
        <p className="mt-3 text-[15px] font-semibold text-ink">The matches aren’t made yet</p>
        <p className="mx-auto mt-1 max-w-[420px] text-[13px] text-muted-foreground">
          {detail.can_manage
            ? 'When everyone’s in, use Start tournament and every match is created for you.'
            : 'Everyone plays everyone. The matches are created when the organizer starts it.'}
        </p>
      </section>
    )
  }

  const drawing = isDrawing(detail)
  const grouped = detail.group_stage !== null

  if (drawing && detail.brackets.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-white px-5 py-10 text-center sm:px-6">
        <span className="brand-gradient mx-auto grid size-14 place-items-center rounded-2xl text-white shadow-[0_6px_16px_rgba(42,107,214,0.3)]">
          <GitFork className="size-7 rotate-90" />
        </span>
        <p className="mt-3 text-[17px] font-black tracking-tight text-brand-navy uppercase">No bracket yet</p>
        <p className="mx-auto mt-1 max-w-[460px] text-[13px] text-muted-foreground">
          {grouped
            ? detail.can_manage
              ? `Create a bracket for the ${words} who move on from the elimination stage: give it a name and a size, then place them. Skip it and one bracket is drawn at random from those moving on when you start the bracket.`
              : `The bracket comes after the elimination stage. The ${words} who move on from their groups play in it.`
            : detail.can_manage
              ? `Create a bracket: give it a name and a size, then put the ${words} in their slots. Make more than one for divisions (e.g. Men’s and Women’s). Skip it and one bracket is drawn at random when you start.`
              : 'The organizer hasn’t made the bracket yet. If they don’t, it’s drawn at random when the tournament starts.'}
        </p>
        {detail.can_manage ? (
          <button type="button" onClick={() => onBracketForm()} className={cn(primaryButton, 'mt-4 h-10 px-5')}>
            <GitFork className="size-4 rotate-90" /> Create bracket
          </button>
        ) : null}
      </section>
    )
  }

  if (roundRobin) {
    return (
      <section className="rounded-xl border border-border bg-white px-4 py-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold text-ink">Standings</h2>
          {detail.can_manage && detail.status === 'in_progress' ? (
            <p className="text-xs text-muted-foreground">Click a match to enter the result.</p>
          ) : null}
        </div>
        <RoundRobinBoard detail={detail} onOpen={onOpen} />
      </section>
    )
  }

  const placing = drawing && (!grouped || inGroupStage(detail))
  const issue = placing && detail.can_manage && bracketEntries(detail).length >= 2 ? startIssue(detail) : null
  const total = detail.brackets.reduce((sum, b) => sum + b.size, 0)

  return (
    <div className="space-y-2">
      {drawing && detail.can_manage ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 sm:px-5">
          <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
            <strong className="font-semibold text-ink">
              {detail.brackets.length} {detail.brackets.length === 1 ? 'bracket' : 'brackets'}
            </strong>{' '}
            ·{' '}
            {grouped ? `${total} slots for the ${words} who move on.` : `${total} slots, so Max ${words} is ${total}.`}
          </p>
          <button type="button" onClick={() => onBracketForm()} className={outlineButton}>
            <Plus className="size-4" /> Create bracket
          </button>
        </div>
      ) : null}
      {issue ? (
        <p className="flex items-start gap-2 rounded-xl bg-amber-400/10 px-4 py-2.5 text-xs text-ink/80">
          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
          {issue}
        </p>
      ) : null}
      {detail.brackets.map((bracket) => (
        <BracketSection
          key={bracket.id}
          detail={detail}
          bracket={bracket}
          editing={arranging === bracket.id}
          onEditing={(on) => onArrange(on ? bracket.id : null)}
          onOpen={onOpen}
          onBracketForm={onBracketForm}
        />
      ))}
    </div>
  )
}

export default function TournamentPage() {
  const user = useCurrentUser()
  const params = useParams({ strict: false })
  const key = params.slug ?? ''
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab | null>(null)
  const [arranging, setArranging] = useState<number | null>(null)
  /** The Create / Edit bracket dialog: open with no bracket to create one. */
  const [bracketForm, setBracketForm] = useState<{ bracket?: Bracket } | null>(null)
  const [editing, setEditing] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [openMatch, setOpenMatch] = useState<TournamentMatch | null>(null)
  const large = useLarge()

  const query = useQuery({
    queryKey: tournamentKey(key),
    queryFn: () => tournamentService.get(key),
    enabled: key !== '',
    retry: false,
    // Live tournaments refresh on their own so everyone sees new results and standings.
    refetchInterval: (q) => (q.state.data?.status === 'in_progress' ? 15_000 : false),
  })

  // Old id / uuid links and renamed tournaments land on their current /tournaments/<slug> address.
  const canonical = query.data?.slug
  useEffect(() => {
    if (!query.data || !canonical || canonical === key) return
    qc.setQueryData(tournamentKey(canonical), query.data)
    void navigate({ ...tournamentLink(query.data), replace: true }).then(() =>
      qc.removeQueries({ queryKey: tournamentKey(key), exact: true }),
    )
  }, [canonical, key, query.data, qc, navigate])

  if (!user) return null

  const detail = query.data
  const chosenTab =
    tab ?? (detail?.status === 'registration' ? 'entries' : detail?.stage === 'groups' ? 'elimination' : 'bracket')
  const activeTab = chosenTab === 'elimination' && detail && !hasEliminationTab(detail) ? 'bracket' : chosenTab
  const forbidden = isAxiosError(query.error) && query.error.response?.status === 403
  /** On big screens knockout brackets need the room, so they span the page under the header and sidebar. */
  const wideBracket = large && activeTab === 'bracket' && detail !== undefined && detail.bracket !== 'round_robin'
  /** In the sidebar on big screens; on phones it goes straight under the header, before the long tab content. */
  const organizer = detail?.can_manage ? (
    <OrganizerCard
      detail={detail}
      onEdit={() => setEditing(true)}
      onInvite={() => setInviting(true)}
      onCreateBracket={() => setBracketForm({})}
      onTab={(next) => {
        setTab(next)
        setArranging(null)
      }}
    />
  ) : null

  return (
    <div className="app-page min-h-dvh">
      <FeedNavbar user={user} active="tournaments" />

      <div className="mx-auto max-w-[1128px] px-3 pt-3 pb-24 sm:px-4 sm:pt-4 sm:pb-16">
        <Link
          to="/tournaments"
          className="on-backdrop mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink/70 hover:text-ink"
        >
          <ArrowLeft className="size-4" /> All tournaments
        </Link>

        {query.isLoading ? <div className="h-72 animate-pulse rounded-xl border border-border bg-white" /> : null}

        {query.isError ? (
          <div className="rounded-xl border border-border bg-white px-6 py-12 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-ink/5 text-ink/60">
              {forbidden ? <Lock className="size-6" /> : <Trophy className="size-6" />}
            </span>
            <p className="mt-3 text-[15px] font-semibold text-ink">
              {forbidden ? 'This tournament is invite only' : 'This tournament doesn’t exist anymore'}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {forbidden ? 'Ask the organizer to invite you from their society.' : 'It may have been deleted.'}
            </p>
          </div>
        ) : null}

        {detail ? (
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
            <main className="min-w-0 space-y-2">
              <section className="overflow-hidden rounded-xl border border-border bg-white">
                <Cover detail={detail} />
                <div className="px-4 pb-4 sm:px-6">
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h1 className="text-xl leading-tight font-semibold break-words text-ink sm:text-2xl">
                      {detail.name}
                    </h1>
                    <StatusPill status={detail.status} />
                  </div>
                  <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                    {detail.game ? <span className="font-semibold text-ink/80">{detail.game} · </span> : null}
                    {formatLabel(detail)} · {BRACKET_INFO[detail.bracket].label} · {activityWhen(detail.starts_at)}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
                    {detail.club ? (
                      <Link
                        {...clubLink(detail.club)}
                        className="flex items-center gap-1.5 font-semibold text-ink/80 hover:text-brand-blue hover:underline"
                      >
                        <ClubIcon
                          color={detail.club.color}
                          type={detail.club.type}
                          src={detail.club.avatar_url}
                          className="size-5 rounded"
                          iconClassName="size-3"
                        />
                        {detail.club.name}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        {detail.visibility === 'public' ? (
                          <Globe className="size-3.5" />
                        ) : (
                          <Lock className="size-3.5" />
                        )}
                        {detail.visibility === 'public' ? 'Public' : 'Invite only'} · hosted by {detail.created_by.name}
                      </span>
                    )}
                    {detail.club && detail.visibility === 'public' ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Globe className="size-3.5" /> Public
                      </span>
                    ) : null}
                    {detail.can_manage ? (
                      <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[11px] font-semibold text-brand-blue">
                        You organize this
                      </span>
                    ) : null}
                  </p>

                  {!detail.winner && detail.champions.length > 1 ? (
                    <div className="mt-4 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100 px-4 py-3">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-amber-800 uppercase">
                        <Crown className="size-4" /> Champions
                      </p>
                      <ul className="mt-1.5 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                        {detail.champions.map((c) => (
                          <li key={c.bracket} className="min-w-0">
                            <span className="block truncate text-[11px] font-semibold text-amber-800/80">
                              {c.bracket}
                            </span>
                            <span className="block truncate text-[15px] font-semibold text-ink">{c.entry.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {detail.winner ? (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100 px-4 py-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-500 text-white shadow">
                        <Crown className="size-6" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold tracking-wide text-amber-800 uppercase">Champion</p>
                        <p className="truncate text-[17px] font-semibold text-ink">{detail.winner.name}</p>
                        {detail.winner.team_name ? (
                          <p className="truncate text-xs text-ink/70">
                            {detail.winner.members.map((m) => m.name).join(', ')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <ViewerActions detail={detail} viewerId={user.id} onCreateTeam={() => setCreatingTeam(true)} />
                    </div>
                    <ShareTournamentButton tournament={detail} className="h-10 sm:h-9" />
                  </div>
                </div>
                <Tabs detail={detail} active={activeTab} onChange={setTab} />
              </section>

              {large ? null : organizer}

              {!wideBracket ? (
                <div role="tabpanel">
                  {activeTab === 'elimination' ? <GroupStagePanel detail={detail} onOpen={setOpenMatch} /> : null}
                  {activeTab === 'bracket' ? (
                    <BracketPanel
                      detail={detail}
                      arranging={arranging}
                      onArrange={setArranging}
                      onOpen={setOpenMatch}
                      onBracketForm={(bracket) => setBracketForm({ bracket })}
                    />
                  ) : null}
                  {activeTab === 'schedule' ? <GameSetupPanel detail={detail} onOpen={setOpenMatch} /> : null}
                  {activeTab === 'standings' ? <StandingsPanel detail={detail} onOpen={setOpenMatch} /> : null}
                  {activeTab === 'entries' ? (
                    <EntriesPanel detail={detail} onCreateTeam={() => setCreatingTeam(true)} />
                  ) : null}
                </div>
              ) : null}
            </main>

            <aside className="space-y-2">
              {large ? organizer : null}
              <InvitedCard detail={detail} />
              <DetailsCard detail={detail} />
            </aside>
          </div>
        ) : null}

        {detail && wideBracket ? (
          <div role="tabpanel" className="mx-[calc(50%-50vw+1rem)] mt-2 flex justify-center">
            {/* As wide as the widest board, from the page width up to the window's. */}
            <div className="w-max max-w-full min-w-[min(1096px,100%)]">
              <BracketPanel
                detail={detail}
                arranging={arranging}
                onArrange={setArranging}
                onOpen={setOpenMatch}
                onBracketForm={(bracket) => setBracketForm({ bracket })}
              />
            </div>
          </div>
        ) : null}
      </div>

      <MessagingDock user={user} />
      {detail && editing ? <TournamentFormDialog tournament={detail} onClose={() => setEditing(false)} /> : null}
      {detail && inviting ? <InviteDialog detail={detail} onClose={() => setInviting(false)} /> : null}
      {detail && creatingTeam ? <CreateTeamDialog detail={detail} onClose={() => setCreatingTeam(false)} /> : null}
      {detail && bracketForm ? (
        <BracketFormDialog
          detail={detail}
          bracket={bracketForm.bracket}
          onClose={() => setBracketForm(null)}
          onCreated={(created) => {
            setTab('bracket')
            setArranging(created.id)
          }}
        />
      ) : null}
      {detail && openMatch
        ? (() => {
            const match = detail.matches.find((m) => m.id === openMatch.id) ?? openMatch
            const bracket = detail.brackets.find((b) => b.id === match.bracket_id)
            return (
              <MatchResultDialog
                detail={bracket ? scopeBracket(detail, bracket) : detail}
                match={match}
                bracketName={detail.brackets.length > 1 ? bracket?.name : undefined}
                onClose={() => setOpenMatch(null)}
              />
            )
          })()
        : null}
      <Toaster />
    </div>
  )
}
