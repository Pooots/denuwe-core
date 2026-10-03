import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { CLUBS_KEY, ClubIcon, clubLink } from '@/components/clubs/clubUi'
import { cn } from '@/lib/utils'
import { clubService } from '@/services/clubService'

/**
 * The officer positions you hold, e.g. "President · JCI Makati". Says so when you belong to no club or
 * community; renders nothing when you're only a member.
 */
export function MyPositions({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'md' }) {
  const clubs = useQuery({ queryKey: [...CLUBS_KEY, 'mine'], queryFn: () => clubService.mine() })
  const held = (clubs.data ?? []).filter((club) => club.my_position)

  if (clubs.isSuccess && clubs.data.length === 0) {
    return (
      <p
        className={cn(
          'flex items-start gap-2 text-muted-foreground',
          size === 'md' ? 'text-[13px]' : 'text-xs',
          className,
        )}
      >
        <Building2 className={cn('mt-px shrink-0', size === 'md' ? 'size-4' : 'size-3.5')} />
        <span>
          No club or community affiliations yet ·{' '}
          <Link to="/clubs" className="font-semibold text-brand-blue hover:underline">
            Explore
          </Link>
        </span>
      </p>
    )
  }
  if (held.length === 0) return null

  return (
    <ul className={cn('space-y-1.5', className)}>
      {held.map((club) => (
        <li key={club.id}>
          <Link
            {...clubLink(club)}
            className={cn(
              'flex min-w-0 items-center gap-2 text-ink hover:underline',
              size === 'md' ? 'text-[13px]' : 'text-xs',
            )}
          >
            <ClubIcon
              color={club.color}
              type={club.type}
              src={club.avatar_url}
              className={size === 'md' ? 'size-5 rounded' : 'size-4 rounded'}
              iconClassName="size-3"
            />
            <span className="truncate">
              <span className="font-semibold">{club.my_position}</span>
              <span className="text-muted-foreground"> · {club.name}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
