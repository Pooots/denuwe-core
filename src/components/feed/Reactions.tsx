import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Heart, LoaderCircle, ThumbsUp } from 'lucide-react'
import type { ReactNode } from 'react'
import type { FeedComment, FeedPost, PostReactions, Reaction } from '@/types/feed'
import { REACTIONS } from '@/types/feed'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/feed/Avatar'
import { Modal } from '@/components/feed/Modal'
import { useDismiss } from '@/components/feed/useDismiss'
import { feedService } from '@/services/feedService'

export const REACTION_META: Record<Reaction, { label: string; text: string; underline: string }> = {
  like: { label: 'Like', text: 'text-brand-blue', underline: 'bg-brand-blue' },
  love: { label: 'Love', text: 'text-rose-500', underline: 'bg-rose-500' },
  care: { label: 'Care', text: 'text-amber-500', underline: 'bg-amber-500' },
  haha: { label: 'Haha', text: 'text-amber-500', underline: 'bg-amber-500' },
  wow: { label: 'Wow', text: 'text-amber-500', underline: 'bg-amber-500' },
  sad: { label: 'Sad', text: 'text-amber-500', underline: 'bg-amber-500' },
  angry: { label: 'Angry', text: 'text-orange-600', underline: 'bg-orange-600' },
}

const EMOJI: Record<Exclude<Reaction, 'like' | 'love'>, string> = {
  care: '🥰',
  haha: '😆',
  wow: '😮',
  sad: '😢',
  angry: '😡',
}

/**
 * Like and Love are drawn as badges in the brand style; the rest use the system emoji. `badge` adds a white
 * ring (and backing for the emoji) so it can sit on top of an avatar or another icon.
 */
export function ReactionIcon({
  type,
  size = 18,
  badge = false,
  className,
}: {
  type: Reaction
  size?: number
  badge?: boolean
  className?: string
}) {
  if (type === 'like' || type === 'love') {
    const Icon = type === 'like' ? ThumbsUp : Heart
    return (
      <span
        aria-hidden
        className={cn(
          'inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br',
          type === 'like' ? 'from-brand-sky to-brand-blue' : 'from-rose-400 to-rose-600',
          badge && 'ring-2 ring-white',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Icon className="fill-white text-white" style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={1.5} />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full leading-none select-none',
        badge && 'bg-white ring-2 ring-white',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.9 }}
    >
      {EMOJI[type]}
    </span>
  )
}

function ReactionTray({
  current,
  focusFirst,
  alignEnd,
  onPick,
}: {
  current: Reaction | null
  focusFirst: boolean
  alignEnd: boolean
  onPick: (reaction: Reaction) => void
}) {
  const firstRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (focusFirst) firstRef.current?.focus()
  }, [focusFirst])

  return (
    <div
      role="toolbar"
      aria-label="Reactions"
      className={cn('absolute bottom-full z-30 pb-2', alignEnd ? 'right-0' : 'left-0')}
    >
      <div className="reaction-tray flex items-center gap-0.5 rounded-full border border-border bg-white px-1.5 py-1 shadow-[0_10px_30px_rgb(15_23_42/0.18)]">
        {REACTIONS.map((reaction, i) => (
          <button
            key={reaction}
            ref={i === 0 ? firstRef : undefined}
            type="button"
            aria-label={REACTION_META[reaction].label}
            aria-pressed={current === reaction}
            onClick={() => onPick(reaction)}
            className="group/reaction relative grid size-11 place-items-center rounded-full transition-transform duration-150 ease-out hover:z-10 hover:-translate-y-2 hover:scale-[1.3] focus-visible:z-10 focus-visible:-translate-y-2 focus-visible:scale-[1.3] focus-visible:outline-none max-sm:size-10"
          >
            <span className="reaction-pop" style={{ animationDelay: `${i * 35}ms` }}>
              <ReactionIcon type={reaction} size={36} />
            </span>
            <span className="pointer-events-none absolute -top-6 rounded-full bg-ink/85 px-1.5 py-0.5 text-[10px] leading-none font-semibold whitespace-nowrap text-white opacity-0 transition group-hover/reaction:opacity-100 group-focus-visible/reaction:opacity-100">
              {REACTION_META[reaction].label}
            </span>
            {current === reaction ? (
              <span className="absolute -bottom-0.5 size-1 rounded-full bg-brand-blue" aria-hidden />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The Like action under a post. */
export function LikeButton({ post, onReact }: { post: FeedPost; onReact: (reaction: Reaction | null) => void }) {
  return <ReactButton mine={post.my_reaction} onReact={onReact} />
}

/**
 * Click to like (or take back your reaction); hover, long-press on touch, or press ↑ to pick Love, Care, Haha, Wow,
 * Sad or Angry instead. `small` is the text-only button under a comment; `rail` is the round button with a count
 * beside a short.
 */
export function ReactButton({
  mine,
  onReact,
  variant = 'bar',
  count = 0,
}: {
  mine: Reaction | null
  onReact: (reaction: Reaction | null) => void
  variant?: 'bar' | 'small' | 'rail'
  count?: number
}) {
  const small = variant === 'small'
  const rail = variant === 'rail'
  const [open, setOpen] = useState(false)
  const [byKeyboard, setByKeyboard] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const longPressed = useRef(false)

  const close = useCallback(() => {
    window.clearTimeout(timer.current)
    setOpen(false)
    setByKeyboard(false)
  }, [])
  useDismiss(ref, open, close)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const later = (fn: () => void, delay: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(fn, delay)
  }

  const meta = mine ? REACTION_META[mine] : null

  const pick = (reaction: Reaction) => {
    close()
    if (reaction !== mine) onReact(reaction)
  }

  return (
    <div
      ref={ref}
      className={cn('relative flex', variant === 'bar' && 'flex-1')}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') later(() => setOpen(true), open ? 0 : 450)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') later(close, 350)
      }}
    >
      {open ? <ReactionTray current={mine} focusFirst={byKeyboard} alignEnd={rail} onPick={pick} /> : null}
      <button
        type="button"
        aria-pressed={mine !== null}
        aria-haspopup="true"
        aria-expanded={open}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return
          longPressed.current = false
          later(() => {
            longPressed.current = true
            setOpen(true)
            if ('vibrate' in navigator) navigator.vibrate(10)
          }, 400)
        }}
        onPointerUp={(e) => {
          if (e.pointerType !== 'mouse' && !longPressed.current) window.clearTimeout(timer.current)
        }}
        onPointerCancel={() => {
          if (!longPressed.current) window.clearTimeout(timer.current)
        }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setByKeyboard(true)
            setOpen(true)
          }
        }}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false
            return
          }
          close()
          onReact(mine ? null : 'like')
        }}
        aria-label={rail ? `${meta?.label ?? 'Like'}${count ? `, ${count} reactions` : ''}` : undefined}
        className={cn(
          'touch-manipulation font-semibold transition select-none [-webkit-touch-callout:none]',
          small && 'rounded px-1 py-0.5 text-xs text-muted-foreground hover:underline',
          variant === 'bar' &&
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs text-ink/70 hover:bg-muted active:scale-95 sm:py-3 sm:text-[13px] max-sm:[&_svg]:size-[18px]',
          !rail && meta?.text,
        )}
      >
        {rail ? (
          <span className="flex flex-col items-center gap-1 text-white md:text-ink">
            <span className="grid size-11 place-items-center rounded-full bg-black/30 backdrop-blur-sm transition hover:bg-black/45 active:scale-90 md:size-12 md:bg-muted md:backdrop-blur-none md:hover:bg-[#e4e7ee] max-md:[&>svg]:size-[22px]">
              {mine ? (
                <ReactionIcon key={mine} type={mine} size={28} className="reaction-chosen" />
              ) : (
                <ThumbsUp className="size-6" />
              )}
            </span>
            <span className="text-xs drop-shadow md:drop-shadow-none">{count > 0 ? count : 'Like'}</span>
          </span>
        ) : small ? null : mine ? (
          <ReactionIcon key={mine} type={mine} size={20} className="reaction-chosen" />
        ) : (
          <ThumbsUp className="size-5" />
        )}
        {rail ? null : <span>{meta?.label ?? 'Like'}</span>}
      </button>
    </div>
  )
}

/** The stacked top reactions and count under a post; opens the list of who reacted. */
export function ReactionSummary({ post, onOpen }: { post: FeedPost; onOpen: () => void }) {
  const others = post.likes_count - 1
  const label = post.my_reaction
    ? others > 0
      ? `You and ${others} ${others === 1 ? 'other' : 'others'}`
      : 'You'
    : String(post.likes_count)

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`See who reacted (${post.likes_count})`}
      className="flex min-w-0 items-center gap-1.5 hover:text-brand-blue hover:underline"
    >
      <span className="flex -space-x-1">
        {post.reactions.slice(0, 3).map((r) => (
          <ReactionIcon key={r.type} type={r.type} size={18} badge />
        ))}
      </span>
      <span className="truncate">{label}</span>
    </button>
  )
}

function PersonLink({
  userId,
  isMe,
  onClick,
  children,
}: {
  userId: number
  isMe: boolean
  onClick: () => void
  children: ReactNode
}) {
  const className = 'flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-muted'
  return isMe ? (
    <Link to="/profile" onClick={onClick} className={className}>
      {children}
    </Link>
  ) : (
    <Link to="/people/$userId" params={{ userId: String(userId) }} onClick={onClick} className={className}>
      {children}
    </Link>
  )
}

/** Who reacted to a post. */
export function ReactionsDialog({ post, onClose }: { post: FeedPost; onClose: () => void }) {
  return (
    <WhoReactedDialog
      queryKey={['post-reactions', post.id, post.likes_count, post.my_reaction]}
      load={() => feedService.reactions(post.id)}
      item={post}
      onClose={onClose}
    />
  )
}

/** Who reacted to a comment. */
export function CommentReactionsDialog({ comment, onClose }: { comment: FeedComment; onClose: () => void }) {
  return (
    <WhoReactedDialog
      queryKey={['comment-reactions', comment.id, comment.likes_count, comment.my_reaction]}
      load={() => feedService.commentReactions(comment.id)}
      item={comment}
      onClose={onClose}
    />
  )
}

/** The top reactions and count on a comment bubble; opens the list of who reacted. */
export function CommentReactionSummary({
  comment,
  onOpen,
}: {
  comment: Pick<FeedComment, 'likes_count' | 'reactions'>
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`See who reacted (${comment.likes_count})`}
      className="flex h-6 items-center gap-1 rounded-full bg-white py-0.5 pr-1.5 pl-0.5 text-[11px] font-semibold text-ink/70 shadow-[0_1px_3px_rgb(15_23_42/0.2)] transition hover:text-brand-blue"
    >
      <span className="flex -space-x-0.5">
        {comment.reactions.slice(0, 3).map((r) => (
          <ReactionIcon key={r.type} type={r.type} size={18} badge />
        ))}
      </span>
      {comment.likes_count > 1 ? <span>{comment.likes_count}</span> : null}
    </button>
  )
}

/** Who reacted, with a tab per reaction. */
export function WhoReactedDialog({
  queryKey,
  load,
  item,
  onClose,
}: {
  queryKey: ReadonlyArray<unknown>
  load: () => Promise<PostReactions>
  item: Pick<FeedPost, 'likes_count' | 'reactions'>
  onClose: () => void
}) {
  const [tab, setTab] = useState<Reaction | 'all'>('all')
  const query = useQuery({ queryKey, queryFn: load })
  const counts = query.data?.reactions ?? item.reactions
  const total = query.data?.total ?? item.likes_count
  const people = (query.data?.data ?? []).filter((row) => tab === 'all' || row.reaction === tab)

  const tabs: Array<{ id: Reaction | 'all'; count: number }> = [
    { id: 'all', count: total },
    ...counts.map((r) => ({ id: r.type, count: r.count })),
  ]

  return (
    <Modal
      onClose={onClose}
      className="max-w-[440px]"
      title={
        <div role="tablist" aria-label="Reactions" className="scrollbar-none -mb-2 flex gap-1 overflow-x-auto">
          {tabs.map(({ id, count }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={id === 'all' ? `All, ${count}` : `${REACTION_META[id].label}, ${count}`}
                onClick={() => setTab(id)}
                className={cn(
                  'relative flex h-11 shrink-0 items-center gap-1.5 rounded-t-lg px-3 text-[14px] font-semibold transition hover:bg-muted',
                  active ? (id === 'all' ? 'text-brand-blue' : REACTION_META[id].text) : 'text-muted-foreground',
                )}
              >
                {id === 'all' ? 'All' : <ReactionIcon type={id} size={20} />}
                <span>{count}</span>
                {active ? (
                  <span
                    className={cn(
                      'absolute inset-x-2 bottom-0 h-[3px] rounded-t-full',
                      id === 'all' ? 'bg-brand-blue' : REACTION_META[id].underline,
                    )}
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      }
    >
      <div className="max-h-[min(460px,65vh)] overflow-y-auto border-t border-border px-3 py-2">
        {query.isPending ? (
          <p className="flex items-center justify-center gap-2 py-8 text-[13px] text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading reactions…
          </p>
        ) : query.isError ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">We couldn’t load the reactions.</p>
        ) : people.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">No reactions yet.</p>
        ) : (
          <ul aria-label="People who reacted">
            {people.map(({ user, reaction, is_me }) => (
              <li key={user.id}>
                <PersonLink userId={user.id} isMe={is_me} onClick={onClose}>
                  <span className="relative shrink-0">
                    <Avatar name={user.name} src={user.avatar_url} className="size-10 text-[13px]" />
                    <ReactionIcon type={reaction} size={18} badge className="absolute -right-1 -bottom-1" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                    {user.name}
                    {is_me ? <span className="font-normal text-muted-foreground"> · You</span> : null}
                  </span>
                  <span className={cn('text-[12px] font-semibold', REACTION_META[reaction].text)}>
                    {REACTION_META[reaction].label}
                  </span>
                </PersonLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
