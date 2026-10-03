import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, ChevronRight, Clock, Crown, Globe, LoaderCircle, Lock, MapPin, Trophy, Users } from 'lucide-react'
import type { TournamentSummary } from '@/types/tournament'
import { ClubIcon, activityWhen } from '@/components/clubs/clubUi'
import { toast } from '@/components/feed/Toaster'
import { ShareTournamentButton } from '@/components/tournaments/ShareTournament'
import {
  BRACKET_INFO,
  StatusPill,
  TournamentBadge,
  entriesLabel,
  formatLabel,
  refreshTournamentLists,
  storeTournament,
  tournamentLink,
} from '@/components/tournaments/tournamentUi'
import { apiErrorMessage } from '@/services/authService'
import { tournamentService } from '@/services/tournamentService'
import { cn } from '@/lib/utils'

/** Quick join / decline for a pending invite to an individual tournament. */
function InviteActions({ tournament, viewerId }: { tournament: TournamentSummary; viewerId: number }) {
  const qc = useQueryClient()
  const join = useMutation({
    mutationFn: () => tournamentService.join(tournament.id),
    onSuccess: ({ message, tournament: next }) => {
      storeTournament(qc, next)
      toast(message)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })
  const decline = useMutation({
    mutationFn: () => tournamentService.uninvite(tournament.id, viewerId),
    onSuccess: ({ message }) => {
      refreshTournamentLists(qc)
      toast(message)
    },
    onError: (err) => toast(apiErrorMessage(err), 'error'),
  })
  const busy = join.isPending || decline.isPending

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <span className="mr-auto text-xs font-semibold text-amber-700">{tournament.created_by.name} invited you</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => decline.mutate()}
        className="h-8 rounded-full px-3 text-[13px] font-semibold text-ink/60 transition hover:bg-muted hover:text-ink disabled:opacity-50"
      >
        Decline
      </button>
      {tournament.format === 'team' ? (
        <Link
          {...tournamentLink(tournament)}
          className="inline-flex h-8 items-center rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
        >
          Pick a team
        </Link>
      ) : (
        <button
          type="button"
          disabled={busy || tournament.is_full}
          onClick={() => join.mutate()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-60"
        >
          {join.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Trophy className="size-4" />}
          {tournament.is_full ? 'Full' : 'Join'}
        </button>
      )}
    </div>
  )
}

export function TournamentCard({
  tournament,
  viewerId,
  showClub = true,
}: {
  tournament: TournamentSummary
  viewerId: number
  showClub?: boolean
}) {
  const t = tournament
  const link = tournamentLink(t)

  return (
    <article
      className={cn(
        'rounded-xl border border-border bg-white px-3.5 py-3 transition hover:border-ink/20 hover:shadow-sm sm:px-4 sm:py-3.5',
        t.invite_pending && 'border-amber-400/60',
      )}
    >
      <div className="flex items-start gap-1">
        <Link {...link} className="group flex min-w-0 flex-1 gap-3 sm:gap-3.5">
          <TournamentBadge tournament={t} className="size-11 sm:size-12" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="line-clamp-2 min-w-0 text-[15px] leading-snug font-semibold text-ink group-hover:text-brand-blue sm:truncate sm:text-[16px]">
                {t.name}
              </h3>
              <StatusPill status={t.status} />
            </div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              {t.game ? <span className="font-semibold text-ink/70">{t.game} · </span> : null}
              {formatLabel(t)} · {BRACKET_INFO[t.bracket].label}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" /> {activityWhen(t.starts_at)}
              </span>
              {t.location ? (
                <span className="flex min-w-0 items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{t.location}</span>
                </span>
              ) : null}
              <span className="flex items-center gap-1">
                <Users className="size-3.5" /> {entriesLabel(t)}
              </span>
              {t.prize ? (
                <span className="flex items-center gap-1 font-semibold text-amber-700">
                  <Trophy className="size-3.5" /> {t.prize}
                </span>
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {showClub && t.club ? (
                <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink/70">
                  <ClubIcon
                    color={t.club.color}
                    type={t.club.type}
                    src={t.club.avatar_url}
                    className="size-4 rounded"
                    iconClassName="size-2.5"
                  />
                  <span className="truncate">{t.club.name}</span>
                </span>
              ) : !t.club ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  {t.visibility === 'public' ? <Globe className="size-3" /> : <Lock className="size-3" />}
                  {t.visibility === 'public' ? 'Public' : 'Invite only'} · by {t.created_by.name}
                </span>
              ) : null}
              {t.club && t.visibility === 'public' ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Globe className="size-3" /> Public
                </span>
              ) : null}
              {t.my_entry_id ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 font-semibold text-emerald-700">
                  <Check className="size-3" /> You’re in
                </span>
              ) : null}
              {t.can_manage ? (
                <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 font-semibold text-brand-blue">
                  Organizer
                </span>
              ) : null}
            </div>
            {t.winner ? (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-amber-700">
                <Crown className="size-4" /> Champion: {t.winner.name}
              </p>
            ) : t.champions.length > 1 ? (
              <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-amber-700">
                <Crown className="size-4 shrink-0" />
                <span className="truncate">
                  Champions: {t.champions.map((c) => `${c.entry.name} (${c.bracket})`).join(', ')}
                </span>
              </p>
            ) : null}
          </div>
          <ChevronRight className="mt-3 hidden size-5 shrink-0 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-ink/60 sm:block" />
        </Link>
        <ShareTournamentButton tournament={t} iconOnly className="-mt-1 -mr-1.5 sm:mt-1.5 sm:mr-0" />
      </div>
      {t.invite_pending && t.status === 'registration' ? <InviteActions tournament={t} viewerId={viewerId} /> : null}
    </article>
  )
}
