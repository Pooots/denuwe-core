import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Bell, ChevronDown, LogOut, MessageCircle, Search, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AuthUser } from '@/types/auth'
import { cn } from '@/lib/utils'
import { BrandMark, Wordmark } from '@/components/brand/Brand'
import { Avatar } from '@/components/feed/Avatar'
import {
  ActivitiesIcon,
  ExploreIcon,
  HomeIcon,
  ShortsIcon,
  SocietyIcon,
  TournamentIcon,
} from '@/components/feed/NavIcons'
import { useConversations } from '@/components/chat/chatCache'
import { useSocietyOverview } from '@/components/society/societyUi'
import { ACTIVITY_BOARD_KEY } from '@/components/clubs/clubUi'
import { stageActivities } from '@/components/activities/activityStages'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { TOURNAMENTS_KEY } from '@/components/tournaments/tournamentUi'
import { authService } from '@/services/authService'
import { clubService } from '@/services/clubService'
import { tournamentService } from '@/services/tournamentService'

function NavItem({
  icon,
  label,
  active,
  badge,
  className,
  ariaLabel,
  expanded,
  onClick,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  badge?: number
  className?: string
  ariaLabel?: string
  expanded?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-expanded={expanded}
      onClick={onClick}
      className={cn(
        'group relative flex h-full min-w-[52px] flex-col items-center justify-center px-2 text-muted-foreground transition hover:text-ink lg:min-w-[88px]',
        active && 'text-ink',
        className,
      )}
    >
      <span className="relative transition-transform duration-200 ease-out group-hover:-translate-y-0.5">
        {icon}
        {badge ? (
          <span className="absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] leading-none font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="mt-0.5 hidden items-center text-xs lg:flex">{label}</span>
      {active ? <span className="brand-gradient absolute inset-x-3 bottom-0 h-[3px] rounded-t-full" /> : null}
    </button>
  )
}

function MobileTab({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  badge?: number
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'relative grid h-12 place-items-center text-muted-foreground transition active:scale-95',
        active ? 'text-brand-blue' : 'hover:text-ink',
      )}
    >
      <span className="relative">
        {icon}
        {badge ? (
          <span className="absolute -top-1.5 -right-2.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      {active ? <span className="brand-gradient absolute inset-x-2 bottom-0 h-[3px] rounded-t-full" /> : null}
    </button>
  )
}

function RoundIconButton({
  label,
  badge,
  onClick,
  children,
}: {
  label: string
  badge?: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative grid size-9 place-items-center rounded-full bg-muted text-ink transition hover:bg-[#e4e7ee] active:scale-95"
    >
      {children}
      {badge ? (
        <span className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  )
}

/** On phones the brand bar slides away while scrolling down and comes back on the way up; the tabs stay. */
function useCollapsedOnScroll(): boolean {
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (Math.abs(y - last) < 8) return
      setCollapsed(y > last && y > 64)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return collapsed
}

function MeMenu({ user, active, compact = false }: { user: AuthUser; active: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const logout = async () => {
    await authService.logout()
    void navigate({ to: '/' })
  }

  return (
    <div ref={ref} className="relative h-full">
      {compact ? (
        <button
          type="button"
          aria-label="Your account"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'grid size-9 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-white transition active:scale-95',
            active ? 'ring-brand-blue' : 'ring-transparent',
          )}
        >
          <Avatar name={user.name} src={user.avatar_url} className="size-9 text-xs" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'relative flex h-full min-w-[52px] flex-col items-center justify-center px-2 text-muted-foreground transition hover:text-ink lg:min-w-[88px]',
            active && 'text-ink',
          )}
        >
          <Avatar name={user.name} src={user.avatar_url} className="size-6 text-[10px]" />
          <span className="mt-0.5 hidden items-center text-xs lg:flex">
            Me <ChevronDown className="size-3.5" />
          </span>
          {active ? <span className="brand-gradient absolute inset-x-3 bottom-0 h-[3px] rounded-t-full" /> : null}
        </button>
      )}

      {open ? (
        <div className="absolute top-full right-0 z-50 mt-1 w-72 overflow-hidden rounded-xl border border-border bg-white shadow-xl">
          <div className="flex gap-3 p-4">
            <Avatar name={user.name} src={user.avatar_url} className="size-14 text-lg" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink">{user.name}</p>
              <p className="line-clamp-2 text-[13px] text-muted-foreground">{user.headline || 'denuwe member'}</p>
            </div>
          </div>
          <div className="px-4 pb-3">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="grid h-8 w-full place-items-center rounded-full border border-brand-blue text-[13px] font-semibold text-brand-blue transition hover:bg-brand-blue/5"
            >
              View profile
            </Link>
          </div>
          <div className="border-t border-border py-1 text-[13px] text-ink">
            <button type="button" className="flex w-full items-center gap-2 px-4 py-2 hover:bg-muted">
              <Settings className="size-4 text-muted-foreground" /> Settings &amp; Privacy
            </button>
            <button type="button" onClick={logout} className="flex w-full items-center gap-2 px-4 py-2 hover:bg-muted">
              <LogOut className="size-4 text-muted-foreground" /> Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function FeedNavbar({
  user,
  active = 'home',
  hideMobileTabs = false,
}: {
  user: AuthUser
  active?: 'home' | 'clubs' | 'society' | 'messages' | 'shorts' | 'activities' | 'tournaments' | 'me'
  /** Drops the phone tab row, e.g. so an open conversation gets the full screen. */
  hideMobileTabs?: boolean
}) {
  const navigate = useNavigate()
  const society = useSocietyOverview()
  const needsReply = useQuery({
    queryKey: ACTIVITY_BOARD_KEY,
    queryFn: () => clubService.activityBoard(),
    select: (board) => stageActivities(board).reply.length,
  })
  const invites = useQuery({
    queryKey: TOURNAMENTS_KEY,
    queryFn: () => tournamentService.list(),
    select: (list) => list.data.filter((t) => t.invite_pending && t.status === 'registration').length,
  })

  const collapsed = useCollapsedOnScroll()
  const [searchOpen, setSearchOpen] = useState(false)
  const chats = useConversations()
  const unread = chats.data?.unread_count ?? society.data?.unread_count ?? 0
  const incoming = society.data?.incoming.length ?? 0

  const tabs: Array<{ label: string; icon: ReactNode; active?: boolean; badge?: number; onClick?: () => void }> = [
    {
      label: 'Home',
      icon: <HomeIcon active={active === 'home'} />,
      active: active === 'home',
      onClick: () => void navigate({ to: '/feed' }),
    },
    {
      label: 'Explore',
      icon: <ExploreIcon active={active === 'clubs'} />,
      active: active === 'clubs',
      onClick: () => void navigate({ to: '/clubs' }),
    },
    {
      label: 'My Society',
      icon: <SocietyIcon active={active === 'society'} />,
      active: active === 'society',
      badge: incoming || undefined,
      onClick: () => void navigate({ to: '/society' }),
    },
    {
      label: 'Shorts',
      icon: <ShortsIcon active={active === 'shorts'} />,
      active: active === 'shorts',
      onClick: () => void navigate({ to: '/shorts' }),
    },
    {
      label: 'Activities',
      icon: <ActivitiesIcon active={active === 'activities'} />,
      active: active === 'activities',
      badge: needsReply.data || undefined,
      onClick: () => void navigate({ to: '/activities', search: needsReply.data ? { stage: 'reply' } : {} }),
    },
    {
      label: 'Tournaments',
      icon: <TournamentIcon active={active === 'tournaments'} />,
      active: active === 'tournaments',
      badge: invites.data || undefined,
      onClick: () => void navigate({ to: '/tournaments' }),
    },
  ]

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur transition-transform duration-300 ease-out md:bg-white md:backdrop-blur-none',
        collapsed && !searchOpen && !hideMobileTabs && 'max-md:-translate-y-12',
      )}
    >
      <div className="md:hidden">
        <div className="flex h-12 items-center gap-2 px-3">
          <Link to="/feed" className="flex min-w-0 items-center gap-1.5" aria-label="denuwe home">
            <BrandMark className="size-8" />
            <Wordmark className="text-[24px]" />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <RoundIconButton label="Search" onClick={() => setSearchOpen((v) => !v)}>
              <Search className="size-[18px]" />
            </RoundIconButton>
            <RoundIconButton
              label={unread ? `Messages, ${unread} unread` : 'Messages'}
              badge={unread || undefined}
              onClick={() => void navigate({ to: '/messages' })}
            >
              <MessageCircle className="size-[18px]" />
            </RoundIconButton>
            <NotificationBell mobile>
              {({ unread: count, toggle }) => (
                <RoundIconButton
                  label={count ? `Notifications, ${count} new` : 'Notifications'}
                  badge={count || undefined}
                  onClick={toggle}
                >
                  <Bell className="size-[18px]" />
                </RoundIconButton>
              )}
            </NotificationBell>
            <MeMenu user={user} active={active === 'me'} compact />
          </div>
        </div>
        {searchOpen ? (
          <div className="px-3 pb-2">
            <label className="relative block">
              <span className="sr-only">Search</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                autoFocus
                placeholder="Search denuwe"
                className="h-10 w-full rounded-full bg-muted pr-4 pl-9 text-[14px] text-ink placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-blue/30 focus:outline-none"
              />
            </label>
          </div>
        ) : null}
        {hideMobileTabs ? null : (
          <nav aria-label="Main" className="grid grid-cols-6 border-t border-border/70">
            {tabs.map((tab) => (
              <MobileTab key={tab.label} {...tab} />
            ))}
          </nav>
        )}
      </div>

      <div className="hidden h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 md:grid">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/feed" className="shrink-0">
            <BrandMark alt="denuwe" className="size-[34px]" />
          </Link>
          <label className="relative hidden w-[240px] md:block">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink" />
            <input
              type="search"
              placeholder="Search"
              className="h-[34px] w-full rounded-full border border-[#d5d9e2] bg-white pr-4 pl-9 text-[13px] text-ink placeholder:text-muted-foreground focus:border-brand-blue focus:outline-none"
            />
          </label>
        </div>

        <nav className="flex h-full items-stretch">
          {tabs.map((tab) => (
            <NavItem key={tab.label} {...tab} />
          ))}
        </nav>

        <nav className="flex h-full items-stretch justify-self-end">
          <NotificationBell>
            {({ open, unread: count, toggle }) => (
              <NavItem
                icon={<Bell className="size-6" />}
                label="Notifications"
                ariaLabel={count ? `Notifications, ${count} new` : 'Notifications'}
                expanded={open}
                active={open}
                badge={count || undefined}
                onClick={toggle}
              />
            )}
          </NotificationBell>
          <MeMenu user={user} active={active === 'me'} />
        </nav>
      </div>
    </header>
  )
}
