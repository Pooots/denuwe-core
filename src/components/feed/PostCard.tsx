import { useCallback, useRef, useState } from 'react'
import {
  Earth,
  Link2,
  MessageSquare,
  MoreHorizontal,
  PenLine,
  Plus,
  Repeat2,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { AuthUser } from '@/types/auth'
import type { FeedPost } from '@/types/feed'
import { ClubIcon, clubLink } from '@/components/clubs/clubUi'
import { Avatar } from '@/components/feed/Avatar'
import { PostComments } from '@/components/feed/PostComments'
import { QuotedPost } from '@/components/feed/QuotedPost'
import { LikeButton, ReactionSummary, ReactionsDialog } from '@/components/feed/Reactions'
import { SendDialog, copyPostLink } from '@/components/feed/SendDialog'
import { usePostActions } from '@/components/feed/feedCache'
import { useDismiss } from '@/components/feed/useDismiss'
import { HiddenTournament, SharedTournament } from '@/components/tournaments/ShareTournament'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function AuthorLink({
  authorId,
  isMine,
  className,
  children,
}: {
  authorId: number
  isMine: boolean
  className?: string
  children: ReactNode
}) {
  return isMine ? (
    <Link to="/profile" className={className}>
      {children}
    </Link>
  ) : (
    <Link to="/people/$userId" params={{ userId: String(authorId) }} className={className}>
      {children}
    </Link>
  )
}

function MenuItem({
  icon,
  title,
  description,
  onClick,
  danger,
}: {
  icon: ReactNode
  title: string
  description?: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-muted',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{title}</span>
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </button>
  )
}

function Popover({
  open,
  onClose,
  trigger,
  children,
  className,
  wrapperClassName,
}: {
  open: boolean
  onClose: () => void
  trigger: ReactNode
  children: ReactNode
  className?: string
  wrapperClassName?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, onClose)

  return (
    <div ref={ref} className={cn('relative flex', wrapperClassName)}>
      {trigger}
      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute z-30 min-w-[260px] overflow-hidden rounded-lg border border-border bg-white py-1 shadow-xl',
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function PostCard({
  post,
  repostedBy,
  user,
  onHide,
  onQuote,
}: {
  post: FeedPost
  repostedBy?: FeedPost
  user: AuthUser
  onHide?: () => void
  onQuote: (post: FeedPost) => void
}) {
  const actions = usePostActions()
  const [expanded, setExpanded] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [repostOpen, setRepostOpen] = useState(false)
  const [reactionsOpen, setReactionsOpen] = useState(false)
  const closeMore = useCallback(() => setMoreOpen(false), [])
  const closeRepost = useCallback(() => setRepostOpen(false), [])

  const body = post.body ?? ''
  const isLong = body.length > 220 || body.split('\n').length > 3
  const quoted = post.is_plain_repost ? null : post.repost_of
  const hasStats = post.likes_count > 0 || post.comments_count > 0 || post.reposts_count > 0

  const remove = () => {
    setMoreOpen(false)
    if (window.confirm('Delete this post? This can’t be undone.')) void actions.remove(post)
  }

  return (
    <article id={`post-${post.id}`} className="rounded-xl border border-border bg-white">
      {repostedBy ? (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
          <Avatar name={repostedBy.author.name} src={repostedBy.author.avatar_url} className="size-6 text-[9px]" />
          <p className="min-w-0 flex-1 truncate">
            <span className="font-semibold text-ink">{repostedBy.is_mine ? 'You' : repostedBy.author.name}</span>{' '}
            reposted this · {timeAgo(repostedBy.created_at)}
          </p>
          {repostedBy.is_mine ? (
            <button
              type="button"
              onClick={() => void actions.undoRepost(post)}
              className="shrink-0 font-semibold text-ink/70 hover:text-ink hover:underline"
            >
              Undo
            </button>
          ) : null}
        </div>
      ) : null}

      <header className="flex items-start gap-2 px-3 pt-3 sm:px-4">
        <AuthorLink authorId={post.author.id} isMine={post.is_mine} className="shrink-0">
          <Avatar
            name={post.author.name}
            src={post.author.avatar_url}
            className="size-10 text-[13px] sm:size-12 sm:text-[15px]"
          />
        </AuthorLink>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[14px] font-semibold text-ink sm:text-[13px]">
            <AuthorLink authorId={post.author.id} isMine={post.is_mine} className="truncate hover:underline">
              {post.author.name}
            </AuthorLink>
            {post.is_mine ? <span className="font-normal text-muted-foreground">· You</span> : null}
          </p>
          <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="shrink-0">{timeAgo(post.created_at)} ·</span>
            {post.club ? (
              <Link
                {...clubLink(post.club)}
                title={`Only members of ${post.club.name} can see this`}
                className="flex min-w-0 items-center gap-1 font-semibold text-ink/70 hover:text-brand-blue hover:underline"
              >
                <ClubIcon
                  color={post.club.color}
                  type={post.club.type}
                  src={post.club.avatar_url}
                  className="size-3.5 rounded-sm"
                  iconClassName="size-2.5"
                />
                <span className="truncate">{post.club.name}</span>
              </Link>
            ) : (
              <Earth className="size-3" aria-label="Public" />
            )}
          </p>
        </div>
        {!post.is_mine ? (
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-semibold text-brand-blue hover:bg-brand-blue/5"
          >
            <Plus className="size-4" /> Follow
          </button>
        ) : null}
        <Popover
          open={moreOpen}
          onClose={closeMore}
          className="top-full right-0 mt-1"
          trigger={
            <button
              type="button"
              aria-label="More"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className="grid size-8 place-items-center rounded-full text-ink/70 hover:bg-muted"
            >
              <MoreHorizontal className="size-5" />
            </button>
          }
        >
          <MenuItem
            icon={<Link2 className="size-5" />}
            title="Copy link to post"
            onClick={() => {
              setMoreOpen(false)
              void copyPostLink(post.id)
            }}
          />
          {post.is_mine ? (
            <MenuItem icon={<Trash2 className="size-5" />} title="Delete post" onClick={remove} danger />
          ) : null}
        </Popover>
        {onHide ? (
          <button
            type="button"
            aria-label="Hide post"
            onClick={onHide}
            className="grid size-8 place-items-center rounded-full text-ink/70 hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        ) : null}
      </header>

      {body ? (
        <div className="px-3 pt-2 pb-3 text-[14px] leading-relaxed text-ink sm:px-4 sm:text-[13px]">
          <p className={cn('break-words whitespace-pre-line', !expanded && 'line-clamp-3')}>{body}</p>
          {!expanded && isLong ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-muted-foreground hover:text-brand-blue hover:underline"
            >
              …more
            </button>
          ) : null}
        </div>
      ) : (
        <div className="h-3" />
      )}

      {post.image_url ? (
        <img
          src={post.image_url}
          alt=""
          loading="lazy"
          className="block max-h-[680px] w-full bg-muted object-contain"
        />
      ) : null}

      {post.tournament || post.tournament_hidden ? (
        <div className="px-3 pb-3 sm:px-4">
          {post.tournament ? <SharedTournament tournament={post.tournament} /> : <HiddenTournament />}
        </div>
      ) : null}

      {quoted ? (
        <div className="px-3 pb-3 sm:px-4">
          <QuotedPost post={quoted} />
        </div>
      ) : null}

      {hasStats ? (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground sm:px-4">
          <span className="flex min-w-0 items-center gap-1">
            {post.likes_count > 0 ? <ReactionSummary post={post} onOpen={() => setReactionsOpen(true)} /> : null}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {post.comments_count > 0 ? (
              <button
                type="button"
                onClick={() => setCommentsOpen(true)}
                className="hover:text-brand-blue hover:underline"
              >
                {plural(post.comments_count, 'comment')}
              </button>
            ) : null}
            {post.comments_count > 0 && post.reposts_count > 0 ? <span>·</span> : null}
            {post.reposts_count > 0 ? <span>{plural(post.reposts_count, 'repost')}</span> : null}
          </span>
        </div>
      ) : null}

      <div className="mx-2 flex justify-between border-t border-border py-0.5 sm:mx-4 sm:py-1">
        <LikeButton post={post} onReact={(reaction) => void actions.react(post, reaction)} />
        <ActionButton
          icon={<MessageSquare className="size-5" />}
          label="Comment"
          onClick={() => setCommentsOpen((v) => !v)}
        />
        {post.club ? null : (
          <Popover
            open={repostOpen}
            onClose={closeRepost}
            wrapperClassName="flex-1"
            className="bottom-full left-1/2 mb-1 -translate-x-1/2"
            trigger={
              <ActionButton
                icon={<Repeat2 className="size-5" />}
                label={post.reposted ? 'Reposted' : 'Repost'}
                active={post.reposted}
                activeClass="text-brand-green"
                onClick={() => setRepostOpen((v) => !v)}
              />
            }
          >
            {post.reposted ? (
              <MenuItem
                icon={<Undo2 className="size-5" />}
                title="Undo repost"
                description="Remove this post from your profile and followers’ feeds"
                onClick={() => {
                  setRepostOpen(false)
                  void actions.undoRepost(post)
                }}
              />
            ) : (
              <MenuItem
                icon={<Repeat2 className="size-5" />}
                title="Repost"
                description="Instantly share this post with your network"
                onClick={() => {
                  setRepostOpen(false)
                  void actions.repost(post)
                }}
              />
            )}
            <MenuItem
              icon={<PenLine className="size-5" />}
              title="Repost with your thoughts"
              description="Create a new post with this post attached"
              onClick={() => {
                setRepostOpen(false)
                onQuote(post)
              }}
            />
          </Popover>
        )}
        <ActionButton icon={<Send className="size-5" />} label="Send" onClick={() => setSendOpen(true)} />
      </div>

      {commentsOpen ? <PostComments post={post} user={user} /> : null}
      {sendOpen ? <SendDialog post={post} onClose={() => setSendOpen(false)} /> : null}
      {reactionsOpen ? <ReactionsDialog post={post} onClose={() => setReactionsOpen(false)} /> : null}
    </article>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  active,
  activeClass,
  pressed,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  active?: boolean
  activeClass?: string
  pressed?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold text-ink/70 transition hover:bg-muted active:scale-95 sm:py-3 sm:text-[13px] max-sm:[&_svg]:size-[18px]',
        active && activeClass,
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
