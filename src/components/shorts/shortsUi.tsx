import { Earth, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Short, ShortAudience } from '@/types/short'
import { ClubIcon } from '@/components/clubs/clubUi'
import { cn } from '@/lib/utils'

export const AUDIENCE_META: Record<
  Exclude<ShortAudience, 'club'>,
  { label: string; hint: string; icon: LucideIcon }
> = {
  everyone: { label: 'Everyone', hint: 'Anyone on denuwe', icon: Earth },
  society: { label: 'My society', hint: 'Only your friends', icon: Users },
}

/** 0:07, 1:00 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/** 7, 1.2K, 3.4M */
export function formatCount(count: number): string {
  return compact.format(count)
}

/** Who can see a short, as a small chip on top of the video. */
export function AudienceChip({ short, className }: { short: Short; className?: string }) {
  const chip = cn(
    'inline-flex max-w-full items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm',
    className,
  )
  if (short.audience === 'club' && short.club) {
    return (
      <span className={chip}>
        <ClubIcon
          color={short.club.color}
          type={short.club.type}
          src={short.club.avatar_url}
          className="size-3.5 rounded-sm"
          iconClassName="size-2.5"
        />
        <span className="truncate">{short.club.name}</span>
      </span>
    )
  }
  const meta = AUDIENCE_META[short.audience === 'society' ? 'society' : 'everyone']
  const Icon = meta.icon
  return (
    <span className={chip}>
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{short.audience === 'society' ? 'Society' : 'Everyone'}</span>
    </span>
  )
}
