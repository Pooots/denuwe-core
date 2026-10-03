import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Clock, Crown, Earth, LoaderCircle, Lock, MapPin, Share2, Trophy, Users } from 'lucide-react'
import type { TournamentSummary } from '@/types/tournament'
import { ClubIcon, activityWhen } from '@/components/clubs/clubUi'
import { Avatar } from '@/components/feed/Avatar'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { prependPost } from '@/components/feed/feedCache'
import { TournamentBanner } from '@/components/tournaments/TournamentMedia'
import {
  BRACKET_INFO,
  StatusPill,
  TournamentBadge,
  entriesLabel,
  formatLabel,
  tournamentLink,
} from '@/components/tournaments/tournamentUi'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/services/authService'
import { feedService } from '@/services/feedService'

const MAX_BODY = 3000

/** A tournament shared in a post: banner, name and the key facts, linking to its page. */
export function SharedTournament({ tournament: t, link = true }: { tournament: TournamentSummary; link?: boolean }) {
  const champion = t.winner?.name ?? (t.champions.length === 1 ? t.champions[0].entry.name : null)
  const action =
    t.status === 'registration'
      ? t.my_entry_id
        ? 'You’re in'
        : t.can_enter && !t.is_full
          ? 'Join'
          : 'View'
      : t.status === 'in_progress'
        ? 'Follow live'
        : 'See results'

  const body = (
    <>
      <TournamentBanner src={t.banner_url} color={t.club?.color ?? null} className="h-20 sm:h-24" />
      <div className="px-3 pb-3 sm:px-4">
        <div className="relative -mt-6 flex items-end gap-3">
          <TournamentBadge tournament={t} className="size-14 rounded-xl border-[3px] border-white shadow-sm" />
          <span className="mb-0.5 ml-auto inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-brand-blue px-3.5 text-[13px] font-semibold text-white transition group-hover:bg-brand-blue/90">
            {action} <ChevronRight className="-mr-1 size-4" />
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="line-clamp-2 min-w-0 text-[15px] leading-snug font-semibold text-ink group-hover:text-brand-blue">
            {t.name}
          </h3>
          <StatusPill status={t.status} />
        </div>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
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
        {champion ? (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-amber-700">
            <Crown className="size-4" /> Champion: {champion}
          </p>
        ) : null}
      </div>
    </>
  )

  const className = 'group block overflow-hidden rounded-lg border border-border bg-white'
  return link ? (
    <Link {...tournamentLink(t)} className={cn(className, 'transition hover:border-ink/20 hover:shadow-sm')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** In place of a shared tournament the viewer can't see. */
export function HiddenTournament() {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-[13px] text-muted-foreground">
      <Lock className="size-4 shrink-0" /> This tournament is private, so only its players and club can see it.
    </p>
  )
}

function ShareTournamentDialog({ tournament, onClose }: { tournament: TournamentSummary; onClose: () => void }) {
  const qc = useQueryClient()
  const user = useCurrentUser()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const onClub = tournament.share_to === 'club' && tournament.club !== null

  const share = useMutation({
    mutationFn: () => feedService.create({ body, tournamentId: tournament.id }),
    onSuccess: (post) => {
      prependPost(qc, post)
      toast(post.club ? `Shared to ${post.club.name}.` : 'Shared to your feed.')
      onClose()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <Modal
      onClose={onClose}
      className="max-w-[520px]"
      title={
        <div>
          <h2 className="text-[17px] font-semibold text-ink">{onClub ? 'Share to your club' : 'Share to your feed'}</h2>
          <p className="text-xs text-muted-foreground">
            {onClub
              ? `It’s private, so only members of ${tournament.club?.name} will see it.`
              : 'Everyone who sees your posts can open it and join.'}
          </p>
        </div>
      }
    >
      <div className="px-5 pb-4">
        <div className="flex items-center gap-2.5">
          <Avatar name={user?.name ?? ''} src={user?.avatar_url ?? null} className="size-10 text-[13px]" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">{user?.name}</p>
            <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              {onClub && tournament.club ? (
                <>
                  <ClubIcon
                    color={tournament.club.color}
                    type={tournament.club.type}
                    src={tournament.club.avatar_url}
                    className="size-3.5 rounded-sm"
                    iconClassName="size-2.5"
                  />
                  <span className="truncate">{tournament.club.name}</span>
                </>
              ) : (
                <>
                  <Earth className="size-3" /> Public
                </>
              )}
            </p>
          </div>
        </div>
        <textarea
          autoFocus
          value={body}
          maxLength={MAX_BODY}
          onChange={(e) => {
            setBody(e.target.value)
            setError(null)
          }}
          rows={3}
          aria-label="Say something about this tournament"
          placeholder={
            tournament.status === 'registration'
              ? `Who’s in? Say something about ${tournament.name}…`
              : `Say something about ${tournament.name}…`
          }
          className="mt-3 block w-full resize-none rounded-lg border-0 bg-transparent px-0 text-[15px] leading-relaxed text-ink placeholder:text-muted-foreground focus:ring-0 focus:outline-none"
        />
        <SharedTournament tournament={tournament} link={false} />
      </div>
      <div className="flex items-center gap-3 border-t border-border px-5 py-3">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-danger">{error}</p>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-full px-3 text-[13px] font-semibold text-ink/60 transition hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={share.isPending}
          onClick={() => share.mutate()}
          className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-60"
        >
          {share.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Share2 className="size-4" />}
          Share
        </button>
      </div>
    </Modal>
  )
}

/** Opens the share dialog; renders nothing when the viewer can't share the tournament anywhere. */
export function ShareTournamentButton({
  tournament,
  iconOnly = false,
  className,
}: {
  tournament: TournamentSummary
  iconOnly?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  if (!tournament.share_to) return null
  const label = tournament.share_to === 'club' ? 'Share to club' : 'Share to feed'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={iconOnly ? label : undefined}
        title={label}
        className={cn(
          iconOnly
            ? 'grid size-9 shrink-0 place-items-center rounded-full text-ink/50 transition hover:bg-muted hover:text-brand-blue'
            : 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#c4c9d4] px-4 text-[13px] font-semibold text-ink/80 transition hover:bg-muted',
          className,
        )}
      >
        <Share2 className="size-4" />
        {iconOnly ? null : 'Share'}
      </button>
      {open ? <ShareTournamentDialog tournament={tournament} onClose={close} /> : null}
    </>
  )
}
