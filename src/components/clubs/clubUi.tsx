import { Globe, HeartHandshake, Lock, Users } from 'lucide-react'
import type { QueryClient } from '@tanstack/react-query'
import type { Club, ClubColor, ClubDetail, ClubType, ClubVisibility, FeeCurrency, FeePeriod } from '@/types/club'
import { cn } from '@/lib/utils'

export const CLUB_COLORS: Array<{ value: ClubColor; label: string }> = [
  { value: 'emerald', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'pink', label: 'Pink' },
  { value: 'ink', label: 'Night' },
  { value: 'amber', label: 'Sun' },
  { value: 'purple', label: 'Purple' },
]

export const CLUB_BG: Record<ClubColor, string> = {
  emerald: 'bg-emerald-500',
  blue: 'bg-brand-blue',
  pink: 'bg-pink-500',
  ink: 'bg-ink',
  amber: 'bg-amber-400',
  purple: 'bg-violet-500',
}

export const CLUB_GRADIENT: Record<ClubColor, string> = {
  emerald: 'from-emerald-400 to-brand-blue',
  blue: 'from-brand-navy to-brand-sky',
  pink: 'from-pink-500 to-violet-500',
  ink: 'from-ink to-brand-navy',
  amber: 'from-amber-400 to-pink-500',
  purple: 'from-violet-500 to-pink-500',
}

export const CLUB_TYPE_LABEL: Record<ClubType, string> = {
  club: 'Club',
  community: 'Community',
}

export const FEE_PERIOD_LABEL: Record<FeePeriod, string> = {
  one_time: 'One-time',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

const FEE_PERIOD_SUFFIX: Record<FeePeriod, string> = {
  one_time: ' one-time',
  monthly: ' / month',
  yearly: ' / year',
}

export function formatMoney(amount: number, currency: FeeCurrency): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** "Free" or e.g. "₱499.50 / month". */
export function feeLabel(club: Pick<Club, 'is_free' | 'fee_amount' | 'fee_currency' | 'fee_period'>): string {
  if (club.is_free || club.fee_amount === null) return 'Free'
  return formatMoney(club.fee_amount, club.fee_currency) + (club.fee_period ? FEE_PERIOD_SUFFIX[club.fee_period] : '')
}

export function FeeChip({
  club,
  className,
}: {
  club: Pick<Club, 'is_free' | 'fee_amount' | 'fee_currency' | 'fee_period'>
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        club.is_free ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-400/15 text-amber-700',
        className,
      )}
    >
      {feeLabel(club)}
    </span>
  )
}

export function TypeChip({ type, className }: { type: ClubType; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-ink/70',
        className,
      )}
    >
      {CLUB_TYPE_LABEL[type]}
    </span>
  )
}

export function VisibilityChip({ visibility, className }: { visibility: ClubVisibility; className?: string }) {
  const isPrivate = visibility === 'private'
  return (
    <span
      title={isPrivate ? 'Hidden from Explore; only members can open it' : 'Anyone can see what’s inside'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        isPrivate ? 'bg-ink/80 text-white' : 'bg-brand-blue/10 text-brand-blue',
        className,
      )}
    >
      {isPrivate ? <Lock className="size-3" /> : <Globe className="size-3" />}
      {isPrivate ? 'Private' : 'Public'}
    </span>
  )
}

export function ClubIcon({
  color,
  type = 'club',
  src,
  className,
  iconClassName,
}: {
  color: ClubColor
  type?: ClubType
  /** Uploaded profile picture; falls back to the coloured type icon. */
  src?: string | null
  className?: string
  iconClassName?: string
}) {
  const Icon = type === 'community' ? HeartHandshake : Users
  return (
    <span
      className={cn(
        'grid size-8 shrink-0 place-items-center overflow-hidden rounded-md text-white',
        CLUB_BG[color],
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Icon className={cn('size-4', iconClassName)} />
      )}
    </span>
  )
}

export const CLUBS_KEY = ['clubs'] as const
export const UPCOMING_KEY = ['activities', 'upcoming'] as const
export const ACTIVITY_BOARD_KEY = ['activities', 'board'] as const

/** Link props for a club's page: /clubs/<slug> or /communities/<slug>. */
export function clubLink(club: Pick<Club, 'type' | 'slug'>) {
  return club.type === 'community'
    ? ({ to: '/communities/$slug', params: { slug: club.slug } } as const)
    : ({ to: '/clubs/$slug', params: { slug: club.slug } } as const)
}

/** Updates a cached club page wherever it's cached, whatever URL it was opened with. */
export function updateClubDetail(qc: QueryClient, clubId: number, update: (detail: ClubDetail) => ClubDetail): void {
  qc.setQueriesData<ClubDetail>({ queryKey: ['club'] }, (detail) =>
    detail && detail.club.id === clubId ? update(detail) : detail,
  )
}

/** Club membership and activities appear in the sidebar, the explore page and club pages. */
export function refreshClubs(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: CLUBS_KEY })
  void qc.invalidateQueries({ queryKey: ['club'] })
  void qc.invalidateQueries({ queryKey: ['activities'] })
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function activityWhen(iso: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

export function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count === 1 ? word : pluralWord}`
}
