import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import {
  ArrowLeft,
  Bell,
  CalendarPlus,
  DoorOpen,
  MessageSquare,
  Repeat2,
  ThumbsUp,
  Trophy,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { AppNotification, NotificationList, NotificationType } from '@/types/notification'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/time'
import { Avatar } from '@/components/feed/Avatar'
import { ReactionIcon } from '@/components/feed/Reactions'
import { notificationService } from '@/services/notificationService'

export const NOTIFICATIONS_KEY = ['notifications'] as const

const TYPE_BADGE: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  friend_request: { icon: UserPlus, tone: 'bg-brand-blue' },
  friend_accepted: { icon: UserCheck, tone: 'bg-sky-500' },
  post_like: { icon: ThumbsUp, tone: 'brand-gradient' },
  post_comment: { icon: MessageSquare, tone: 'bg-emerald-500' },
  repost: { icon: Repeat2, tone: 'bg-violet-500' },
  join_request: { icon: DoorOpen, tone: 'bg-amber-500' },
  club_activity: { icon: CalendarPlus, tone: 'bg-orange-500' },
  tournament_invite: { icon: Trophy, tone: 'bg-amber-500' },
}

function quoted(text: string | null): ReactNode {
  return text ? <span className="text-muted-foreground">: “{text}”</span> : '.'
}

function message(n: AppNotification): ReactNode {
  const who = <strong className="font-semibold">{n.actor?.name ?? 'Someone'}</strong>
  switch (n.type) {
    case 'friend_request':
      return <>{who} sent you a friend request.</>
    case 'friend_accepted':
      return <>{who} accepted your friend request. Say hi!</>
    case 'post_like': {
      const others = n.others_count > 0 ? ` and ${n.others_count} ${n.others_count === 1 ? 'other' : 'others'}` : ''
      const onlyLikes = (n.reactions ?? ['like']).every((r) => r === 'like')
      return (
        <>
          {who}
          {others} {onlyLikes ? 'liked' : 'reacted to'} your post{quoted(n.subject)}
        </>
      )
    }
    case 'post_comment':
      return (
        <>
          {who} commented on your post{quoted(n.subject)}
        </>
      )
    case 'repost':
      return (
        <>
          {who} reposted your post{quoted(n.subject)}
        </>
      )
    case 'join_request':
      return (
        <>
          {who} asked to join <strong className="font-semibold">{n.subject}</strong>.
        </>
      )
    case 'club_activity':
      return (
        <>
          {who} planned <strong className="font-semibold">{n.subject}</strong> in {n.context}.
        </>
      )
    case 'tournament_invite':
      return (
        <>
          {who} invited you to the <strong className="font-semibold">{n.subject}</strong> tournament.
        </>
      )
  }
}

function NotificationRow({ notification: n, onOpen }: { notification: AppNotification; onOpen: () => void }) {
  const badge = TYPE_BADGE[n.type]
  const Icon = badge.icon
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-muted active:scale-[0.99]',
          n.unread && 'bg-brand-blue/[0.06] hover:bg-brand-blue/10',
        )}
      >
        <span className="relative shrink-0">
          <Avatar name={n.actor?.name ?? 'Someone'} src={n.actor?.avatar_url} className="size-14 text-base" />
          {n.type === 'post_like' && n.reaction ? (
            <ReactionIcon type={n.reaction} size={24} badge className="absolute -right-1 -bottom-1" />
          ) : (
            <span
              className={cn(
                'absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full text-white ring-2 ring-white',
                badge.tone,
              )}
            >
              <Icon className="size-3.5" strokeWidth={2.5} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="line-clamp-3 text-[14px] leading-snug text-ink">{message(n)}</span>
          <span
            className={cn(
              'mt-0.5 block text-[12px]',
              n.unread ? 'font-semibold text-brand-blue' : 'text-muted-foreground',
            )}
          >
            {timeAgo(n.created_at)}
          </span>
        </span>
        {n.unread ? <span className="mt-6 size-3 shrink-0 rounded-full bg-brand-blue" aria-label="Unread" /> : null}
      </button>
    </li>
  )
}

function NotificationFeed({
  list,
  loading,
  onOpen,
}: {
  list: NotificationList | undefined
  loading: boolean
  onOpen: (n: AppNotification) => void
}) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const items = (list?.data ?? []).filter((n) => filter === 'all' || n.unread)
  const fresh = items.filter((n) => n.unread)
  const earlier = items.filter((n) => !n.unread)

  const section = (title: string, rows: Array<AppNotification>) =>
    rows.length ? (
      <section aria-label={title} className="pt-2">
        <h3 className="px-2 pb-1 text-[15px] font-semibold text-ink">{title}</h3>
        <ul className="space-y-0.5">
          {rows.map((n) => (
            <NotificationRow key={n.id} notification={n} onOpen={() => onOpen(n)} />
          ))}
        </ul>
      </section>
    ) : null

  return (
    <div className="px-2 pb-2">
      <div className="flex gap-2 px-2 pt-1 pb-1" role="tablist" aria-label="Filter notifications">
        {(['all', 'unread'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              'h-8 rounded-full px-3 text-[13px] font-semibold capitalize transition',
              filter === value ? 'bg-brand-blue/10 text-brand-blue' : 'text-ink hover:bg-muted',
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {loading ? (
        <ul className="space-y-1 pt-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex animate-pulse items-center gap-3 px-2 py-2">
              <span className="size-14 rounded-full bg-muted" />
              <span className="flex-1 space-y-2">
                <span className="block h-3 w-4/5 rounded bg-muted" />
                <span className="block h-2.5 w-1/4 rounded bg-muted" />
              </span>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="grid place-items-center px-6 py-10 text-center">
          <span className="brand-gradient grid size-14 place-items-center rounded-full text-white shadow-md">
            <Bell className="size-6" />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-ink">
            {filter === 'unread' ? 'No unread notifications' : 'You’re all caught up'}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            When people like or comment on your posts, add you, or plan something in your clubs, it shows up here.
          </p>
        </div>
      ) : (
        <>
          {section('New', fresh)}
          {section('Earlier', earlier)}
        </>
      )}
    </div>
  )
}

/**
 * The bell and its panel: a dropdown on desktop, a full-screen sheet on phones. Opening it marks everything as
 * seen; rows stay highlighted until the panel closes.
 */
export function NotificationBell({
  mobile = false,
  children,
}: {
  mobile?: boolean
  children: (state: { open: boolean; unread: number; toggle: () => void }) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const router = useRouter()

  const query = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => notificationService.list(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const markRead = useMutation({
    mutationFn: () => notificationService.markRead(),
    onSuccess: () =>
      queryClient.setQueryData<NotificationList>(NOTIFICATIONS_KEY, (prev) => prev && { ...prev, unread_count: 0 }),
  })
  const unread = query.data?.unread_count ?? 0

  const close = useCallback(() => {
    setOpen(false)
    queryClient.setQueryData<NotificationList>(
      NOTIFICATIONS_KEY,
      (prev) => prev && { ...prev, data: prev.data.map((n) => ({ ...n, unread: false })) },
    )
  }, [queryClient])

  const toggle = () => {
    if (open) {
      close()
      return
    }
    setOpen(true)
    void query.refetch().then((result) => {
      if (result.data?.unread_count) markRead.mutate()
    })
  }

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !sheetRef.current?.contains(target)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  useEffect(() => {
    if (!open || !mobile) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open, mobile])

  const openItem = (n: AppNotification) => {
    close()
    router.history.push(n.url)
  }

  const feed = <NotificationFeed list={query.data} loading={query.isPending} onOpen={openItem} />

  return (
    <div ref={ref} className="relative h-full">
      {children({ open, unread, toggle })}

      {open && !mobile ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute top-full right-0 z-50 mt-1 w-[380px] overflow-hidden rounded-xl border border-border bg-white shadow-xl"
        >
          <h2 className="px-4 pt-3 pb-1 text-xl font-bold text-ink">Notifications</h2>
          <div className="max-h-[min(600px,calc(100vh-120px))] overflow-y-auto">{feed}</div>
        </div>
      ) : null}

      {open && mobile
        ? createPortal(
            <div
              ref={sheetRef}
              role="dialog"
              aria-label="Notifications"
              className="fixed inset-0 z-[60] flex flex-col bg-white"
            >
              <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-1">
                <button
                  type="button"
                  aria-label="Close notifications"
                  onClick={close}
                  className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-muted active:scale-95"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <h2 className="text-[18px] font-bold text-ink">Notifications</h2>
              </div>
              <div className="flex-1 overflow-y-auto pt-1">{feed}</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
