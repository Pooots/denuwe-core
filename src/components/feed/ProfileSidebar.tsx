import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { AuthUser } from '@/types/auth'
import { MyPositions } from '@/components/clubs/MyPositions'
import { Avatar } from '@/components/feed/Avatar'
import { GroupSocietyCard } from '@/components/society/GroupSocietyCard'

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-xl border border-border bg-white ${className}`}>{children}</section>
  )
}

function memberSince(user: AuthUser): string {
  if (!user.created_at) return 'denuwe member'
  const date = new Date(user.created_at)
  return `Member since ${date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
}

export function ProfileSidebar({ user }: { user: AuthUser }) {
  return (
    <aside className="space-y-2">
      <Card>
        <Link to="/profile" className="group block">
          <div className="brand-gradient relative h-14">
            {user.banner_url ? (
              <img src={user.banner_url} alt="" className="absolute inset-0 size-full object-cover" />
            ) : null}
            <span className="absolute top-2 right-2 rounded-md bg-black/25 px-1.5 py-0.5 text-xs font-semibold text-white">
              Member
            </span>
          </div>
          <div className="px-4 pb-4">
            <Avatar
              name={user.name}
              src={user.avatar_url}
              className="-mt-9 size-[72px] rounded-full border-2 border-white bg-white text-xl"
            />
            <p className="mt-2 truncate text-[17px] font-semibold text-ink group-hover:underline">{user.name}</p>
            <p className="line-clamp-2 text-xs text-ink/80">{user.headline || 'Building good vibes on denuwe'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{user.location || memberSince(user)}</p>
          </div>
        </Link>
        <MyPositions className="-mt-1 px-4 pb-4" />
      </Card>

      <GroupSocietyCard />
    </aside>
  )
}
