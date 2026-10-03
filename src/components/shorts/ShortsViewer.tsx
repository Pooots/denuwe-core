import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronUp,
  Eye,
  LoaderCircle,
  MessageCircle,
  MoreHorizontal,
  Play,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { Short } from '@/types/short'
import { Avatar } from '@/components/feed/Avatar'
import { ReactButton } from '@/components/feed/Reactions'
import { useDismiss } from '@/components/feed/useDismiss'
import { useRecordView, useShortActions } from '@/components/shorts/shortsCache'
import { AudienceChip, formatCount } from '@/components/shorts/shortsUi'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'

function RailButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex flex-col items-center gap-1 text-xs font-semibold text-white md:text-ink"
    >
      <span className="grid size-11 place-items-center rounded-full bg-black/30 backdrop-blur-sm transition hover:bg-black/45 active:scale-90 md:size-12 md:bg-muted md:backdrop-blur-none md:hover:bg-[#e4e7ee] max-md:[&_svg]:size-[22px]">
        {children}
      </span>
    </button>
  )
}

function MoreMenu({ onDelete }: { onDelete: () => Promise<boolean> }) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const close = useCallback(() => {
    setOpen(false)
    setConfirming(false)
  }, [])
  useDismiss(ref, open, close)

  return (
    <div ref={ref} className="relative">
      <RailButton label="More options" onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="size-6" />
      </RailButton>
      {open ? (
        <div className="absolute right-0 bottom-full z-30 mb-2 w-56 overflow-hidden rounded-xl bg-white py-1 text-[13px] shadow-xl">
          {confirming ? (
            <div className="px-3 py-2">
              <p className="font-semibold text-ink">Delete this short?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Its reactions and comments go with it.</p>
              <div className="mt-2 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={close}
                  className="h-8 rounded-full px-3 text-xs font-semibold text-ink/70 hover:bg-muted"
                >
                  Keep
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    const done = await onDelete()
                    setBusy(false)
                    if (done) close()
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-danger px-3 text-xs font-semibold text-white disabled:opacity-70"
                >
                  {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold text-danger hover:bg-muted"
            >
              <Trash2 className="size-4" /> Delete short
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}

function Rail({
  short,
  onComments,
  onDeleted,
  className,
}: {
  short: Short
  onComments: () => void
  onDeleted: () => void
  className?: string
}) {
  const { react, remove } = useShortActions()
  const views = short.views_count
  return (
    <div className={cn('flex flex-col items-center gap-3 md:gap-4', className)}>
      <div
        role="img"
        aria-label={`${views.toLocaleString()} ${views === 1 ? 'view' : 'views'}`}
        title={`${views.toLocaleString()} ${views === 1 ? 'view' : 'views'}`}
        className="flex flex-col items-center gap-1 text-xs font-semibold text-white md:text-ink"
      >
        <span className="grid size-11 place-items-center rounded-full bg-black/30 backdrop-blur-sm md:size-12 md:bg-muted md:backdrop-blur-none">
          <Eye className="size-[22px] md:size-6" />
        </span>
        <span className="drop-shadow md:drop-shadow-none">{views > 0 ? formatCount(views) : 'Views'}</span>
      </div>
      <ReactButton
        variant="rail"
        mine={short.my_reaction}
        count={short.likes_count}
        onReact={(reaction) => void react(short, reaction)}
      />
      <div className="flex flex-col items-center gap-1 text-xs font-semibold text-white md:text-ink">
        <RailButton label={`Comments, ${short.comments_count}`} onClick={onComments}>
          <MessageCircle className="size-6" />
        </RailButton>
        <span className="drop-shadow md:drop-shadow-none">
          {short.comments_count > 0 ? short.comments_count : 'Comment'}
        </span>
      </div>
      {short.is_mine ? (
        <MoreMenu
          onDelete={async () => {
            const done = await remove(short)
            if (done) onDeleted()
            return done
          }}
        />
      ) : null}
    </div>
  )
}

function ShortSlide({
  short,
  index,
  active,
  near,
  paused,
  muted,
  onTogglePause,
  onToggleMute,
  onAutoplayBlocked,
  onComments,
  onDeleted,
}: {
  short: Short
  index: number
  active: boolean
  near: boolean
  paused: boolean
  muted: boolean
  onTogglePause: () => void
  onToggleMute: () => void
  onAutoplayBlocked: () => void
  onComments: () => void
  onDeleted: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [progress, setProgress] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [buffering, setBuffering] = useState(false)
  useRecordView(short, active)
  const photo = short.kind === 'image'
  const landscape = Boolean(short.width && short.height && short.width > short.height)
  // Photos close to the 9:16 frame fill it; anything wider is shown whole on a blurred copy.
  const tall = Boolean(short.width && short.height && short.height / short.width >= 1.6)

  useEffect(() => {
    const video = videoRef.current
    if (video) video.muted = muted
  }, [muted, near])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!active) {
      video.pause()
      video.currentTime = 0
      return
    }
    if (paused) {
      video.pause()
      return
    }
    video.play().catch(() => {
      // Browsers block sound until you've interacted with the page; start muted instead.
      if (!video.muted) {
        video.muted = true
        onAutoplayBlocked()
        video.play().catch(() => undefined)
      }
    })
  }, [active, paused, near, onAutoplayBlocked])

  const profileLink = short.is_mine
    ? ({ to: '/profile' } as const)
    : ({ to: '/people/$userId', params: { userId: String(short.author.id) } } as const)

  return (
    <section
      data-index={index}
      aria-label={`Short by ${short.author.name}`}
      className="relative flex h-full snap-start snap-always items-center justify-center md:py-4"
    >
      <div className="relative h-full w-full overflow-hidden bg-black md:aspect-[9/16] md:w-auto md:max-w-full md:rounded-2xl md:shadow-xl md:ring-1 md:ring-black/5">
        {photo && short.image_url ? (
          <>
            <img
              src={short.image_url}
              alt=""
              aria-hidden
              className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
            />
            <img
              src={short.image_url}
              alt={short.caption ?? `Photo by ${short.author.name}`}
              loading={near ? 'eager' : 'lazy'}
              className={cn('absolute inset-0 size-full', tall ? 'object-cover' : 'object-contain')}
            />
          </>
        ) : null}
        {!photo && landscape && short.poster_url ? (
          <img
            src={short.poster_url}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl"
          />
        ) : null}
        {photo ? null : near && short.video_url ? (
          <video
            ref={videoRef}
            src={short.video_url}
            poster={short.poster_url ?? undefined}
            loop
            playsInline
            muted={muted}
            preload={active ? 'auto' : 'metadata'}
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (v.duration) setProgress(v.currentTime / v.duration)
            }}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            className={cn('absolute inset-0 size-full', landscape ? 'object-contain' : 'object-cover')}
          />
        ) : short.poster_url ? (
          <img
            src={short.poster_url}
            alt=""
            className={cn('absolute inset-0 size-full', landscape ? 'object-contain' : 'object-cover')}
          />
        ) : null}

        {photo ? null : (
          <>
            <button
              type="button"
              onClick={onTogglePause}
              aria-label={paused ? 'Play' : 'Pause'}
              className="absolute inset-0 z-[1] cursor-pointer focus-visible:outline-none"
            >
              {active && paused ? (
                <span className="absolute top-1/2 left-1/2 grid size-16 -translate-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
                  <Play className="size-7 translate-x-0.5 fill-white" />
                </span>
              ) : null}
              {active && buffering && !paused ? (
                <LoaderCircle className="absolute top-1/2 left-1/2 size-10 -translate-1/2 animate-spin text-white/80" />
              ) : null}
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="absolute top-14 right-3 z-[2] grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 lg:top-3"
            >
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
          </>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/85 via-black/35 to-transparent px-3 pt-20 pb-5 pr-20 text-white md:pr-4">
          <div className="pointer-events-auto flex min-w-0 items-center gap-2">
            <Link {...profileLink} className="shrink-0 rounded-full ring-2 ring-white/80">
              <Avatar name={short.author.name} src={short.author.avatar_url} className="size-9 text-xs" />
            </Link>
            <div className="min-w-0">
              <Link {...profileLink} className="block truncate text-[14px] font-semibold hover:underline">
                {short.author.name}
              </Link>
              <span className="block text-[11px] text-white/70">{timeAgo(short.created_at)}</span>
            </div>
          </div>
          <AudienceChip short={short} className="pointer-events-auto mt-2" />
          {short.caption ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                'pointer-events-auto mt-2 block w-full text-left text-[13px] leading-snug break-words whitespace-pre-line drop-shadow',
                expanded ? 'max-h-40 overflow-y-auto' : 'line-clamp-2',
              )}
            >
              {short.caption}
            </button>
          ) : null}
        </div>

        {photo ? null : (
          <div className="absolute inset-x-0 bottom-0 z-[3] h-[3px] bg-white/20">
            <div className="h-full bg-white" style={{ width: `${(active ? progress : 0) * 100}%` }} />
          </div>
        )}

        <Rail
          short={short}
          onComments={onComments}
          onDeleted={onDeleted}
          className="absolute right-2 bottom-24 z-[4] md:hidden"
        />
      </div>

      <Rail short={short} onComments={onComments} onDeleted={onDeleted} className="ml-4 hidden self-end pb-6 md:flex" />
    </section>
  )
}

/**
 * Full-height shorts, one per screen, snapping as you scroll or swipe. The short in view plays; the ones next to it
 * load ahead. ↑/↓ move between shorts and M toggles the sound.
 */
export function ShortsViewer({
  shorts,
  hasMore,
  loadingMore,
  onLoadMore,
  onComments,
  onDeleted,
  onActiveChange,
}: {
  shorts: Array<Short>
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onComments: (short: Short) => void
  onDeleted: (short: Short) => void
  onActiveChange?: (short: Short | null) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [pausedId, setPausedId] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const count = shorts.length
  const active = Math.min(activeIndex, Math.max(0, count - 1))

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio < 0.6) continue
          const index = Number((entry.target as HTMLElement).dataset.index)
          setActiveIndex(index)
          setPausedId(null)
        }
      },
      { root: scroller, threshold: 0.6 },
    )
    scroller.querySelectorAll('[data-index]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [count])

  const activeShort = shorts[active] ?? null
  useEffect(() => {
    onActiveChange?.(activeShort)
  }, [activeShort, onActiveChange])

  useEffect(() => {
    if (hasMore && !loadingMore && active >= count - 3) onLoadMore()
  }, [active, count, hasMore, loadingMore, onLoadMore])

  const go = useCallback((direction: 1 | -1) => {
    const scroller = scrollerRef.current
    if (scroller) scroller.scrollBy({ top: direction * scroller.clientHeight, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'm' || e.key === 'M') {
        setMuted((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const onAutoplayBlocked = useCallback(() => setMuted(true), [])

  return (
    <div className="relative h-full">
      <div ref={scrollerRef} className="scrollbar-none h-full snap-y snap-mandatory overflow-y-auto overscroll-contain">
        {shorts.map((short, index) => (
          <ShortSlide
            key={short.id}
            short={short}
            index={index}
            active={index === active}
            near={Math.abs(index - active) <= 1}
            paused={pausedId === short.id}
            muted={muted}
            onTogglePause={() => setPausedId((id) => (id === short.id ? null : short.id))}
            onToggleMute={() => setMuted((v) => !v)}
            onAutoplayBlocked={onAutoplayBlocked}
            onComments={() => onComments(short)}
            onDeleted={() => onDeleted(short)}
          />
        ))}
        {loadingMore ? (
          <div className="flex h-24 items-center justify-center text-white/70 md:text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin" />
          </div>
        ) : null}
      </div>

      <div className="absolute top-1/2 right-4 z-10 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={active === 0}
          aria-label="Previous short"
          className="grid size-11 place-items-center rounded-full bg-muted text-ink transition hover:bg-[#e4e7ee] disabled:opacity-30"
        >
          <ChevronUp className="size-6" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={active >= count - 1 && !hasMore}
          aria-label="Next short"
          className="grid size-11 place-items-center rounded-full bg-muted text-ink transition hover:bg-[#e4e7ee] disabled:opacity-30"
        >
          <ChevronDown className="size-6" />
        </button>
      </div>
    </div>
  )
}
