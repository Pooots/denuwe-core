import { useDeferredValue, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronLeft, ChevronRight, Flame, LoaderCircle, PenLine, Search, Users, X } from 'lucide-react'
import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import type { DiaryEntry } from '@/types/diary'
import { BrandMark } from '@/components/brand/Brand'
import { plural } from '@/components/clubs/clubUi'
import { monthLabel, moodOf, parseDay, streak, today, useDiary } from '@/components/profile/diaryUi'
import { cn } from '@/lib/utils'
import { authService } from '@/services/authService'

/** Whose diary is shown; omit for your own. Someone else's diary is read-only. */
export type DiaryOwner = { id: number; firstName: string }

export function audienceNote(owner?: DiaryOwner): string {
  return owner ? `Shared with ${owner.firstName}’s society` : 'Visible to you and your society'
}

const WIDE = '(min-width: 768px)'

function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia(WIDE).matches,
  )
}

type BookPage = { kind: 'title' } | { kind: 'entry'; entry: DiaryEntry; number: number } | { kind: 'blank' }

type Side = 'left' | 'right' | 'single'

/** A page turn in progress, from the position the book was at. */
type Flip = { direction: 'next' | 'prev'; from: number }

/**
 * A page held by the pointer: `progress` runs 0–1 as it's dragged toward `target`. On release it settles —
 * finishing the turn or falling back — before the position changes.
 */
type Drag = { direction: 'next' | 'prev'; target: number; progress: number; settle: 'complete' | 'cancel' | null }

type Gesture = {
  id: number
  x: number
  y: number
  width: number
  lastX: number
  lastT: number
  /** Horizontal speed in px/ms, for flicks. */
  vx: number
  direction: 'next' | 'prev' | null
}

const FLIP_MS = 700
const SETTLE_MS = 320
const DRAG_START_PX = 8

/** The held leaf's pose: a spread swings around the spine; a single page lifts away like the flip animation. */
function dragPose(wide: boolean, forward: boolean, progress: number): CSSProperties {
  if (wide) {
    return {
      transformOrigin: forward ? 'left center' : 'right center',
      transform: `rotateY(${forward ? -180 * progress : 180 * progress}deg)`,
    }
  }
  const lifted = forward ? progress : 1 - progress
  return {
    transformOrigin: 'left center',
    transform: `rotateY(${-100 * lifted}deg)`,
    opacity: lifted > 0.75 ? 1 - (lifted - 0.75) / 0.25 : 1,
  }
}
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function longDate(day: string): string {
  return parseDay(day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function Sheet({
  side,
  number,
  className,
  children,
}: {
  side: Side
  number?: number
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'diary-paper diary-margin relative flex h-full min-h-0 flex-col overflow-hidden',
        side === 'left' ? 'rounded-l-md' : side === 'right' ? 'rounded-r-md' : 'rounded-md',
        className,
      )}
    >
      {children}
      {number !== undefined ? (
        <span
          className={cn(
            'pointer-events-none absolute bottom-3 font-brand text-[12px] text-ink/40 italic',
            side === 'left' ? 'left-6' : 'right-6',
          )}
        >
          {number}
        </span>
      ) : null}
      {side === 'single' ? null : (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 w-12 from-black/[0.08] to-transparent',
            side === 'left' ? 'right-0 bg-gradient-to-l' : 'left-0 bg-gradient-to-r',
          )}
        />
      )}
    </div>
  )
}

function EntryPage({ entry, onEdit }: { entry: DiaryEntry; onEdit?: () => void }) {
  const mood = moodOf(entry.mood)
  return (
    <>
      <header className="flex items-start gap-3 pt-6 pr-6 pb-2 pl-12">
        <div className="min-w-0 flex-1">
          <p className="font-hand text-[26px] leading-none font-bold text-brand-navy">{longDate(entry.entry_date)}</p>
          {entry.title ? (
            <h3 className="mt-2 font-brand text-[19px] leading-snug font-bold break-words text-ink">{entry.title}</h3>
          ) : null}
        </div>
        {mood ? (
          <span title={`Feeling ${mood.label.toLowerCase()}`} className="flex shrink-0 flex-col items-center">
            <span className="text-[26px] leading-none">{mood.emoji}</span>
            <span className="mt-0.5 font-hand text-[15px] leading-none text-ink/60">{mood.label}</span>
          </span>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            aria-label="Edit this page"
            title="Edit this page"
            onClick={onEdit}
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink/50 transition hover:bg-brand-navy/10 hover:text-brand-navy"
          >
            <PenLine className="size-4" />
          </button>
        ) : null}
      </header>
      <div className="diary-scroll diary-lines min-h-0 flex-1 overflow-y-auto pr-7 pb-12 pl-12">
        <p className="font-brand text-[15.5px] leading-7 break-words whitespace-pre-line text-ink/90">{entry.body}</p>
      </div>
    </>
  )
}

function BlankPage({ wroteToday, onWrite }: { wroteToday: boolean; onWrite: () => void }) {
  return (
    <div className="diary-lines grid flex-1 place-items-center px-10 pl-12 text-center">
      <div>
        <p className="font-hand text-[30px] leading-tight text-brand-navy/80">
          {wroteToday ? 'Another thought for today?' : 'A fresh page for today…'}
        </p>
        <p className="mt-1 font-hand text-[19px] text-ink/50">{longDate(today())}</p>
        <button
          type="button"
          onClick={onWrite}
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-full bg-brand-navy px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-navy/90"
        >
          <PenLine className="size-4" />
          {wroteToday ? 'Write another page' : 'Write today’s page'}
        </button>
      </div>
    </div>
  )
}

function TitlePage({
  owner,
  query,
  total,
  since,
  days,
}: {
  owner?: DiaryOwner
  query: string
  total: number
  since: string | null
  days: number
}) {
  const name = owner ? owner.firstName : (authService.getUser()?.name ?? 'You')
  const empty = total === 0
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-10 pl-12 text-center">
      <BrandMark className="size-10 opacity-80" />
      <p className="mt-5 font-hand text-[24px] leading-none text-ink/60">
        {query ? 'Pages mentioning' : 'The diary of'}
      </p>
      <h2 className="mt-2 max-w-full font-brand text-[32px] leading-tight font-bold break-words text-brand-navy">
        {query ? `“${query}”` : name}
      </h2>
      <div aria-hidden className="my-5 flex items-center gap-3 text-brand-navy/35">
        <span className="h-px w-12 bg-current" />
        <span className="text-sm">✦</span>
        <span className="h-px w-12 bg-current" />
      </div>
      <p className="font-brand text-[15px] text-ink/70 italic">
        {empty
          ? query
            ? 'No pages found.'
            : owner
              ? 'No pages written yet.'
              : 'Your story starts on the next page.'
          : `${plural(total, 'page')}${since && !query ? ` · since ${since}` : ''}`}
      </p>
      {days > 0 && !query ? (
        <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
          <Flame className="size-3.5" /> {plural(days, 'day')} in a row
        </p>
      ) : null}
      <p className="mt-6 flex items-center gap-1 text-xs text-ink/45">
        <Users className="size-3" /> {audienceNote(owner)}
      </p>
    </div>
  )
}

/**
 * The diary as an open book: oldest page first, opening on the newest. `pos` counts pages back from the end
 * so the current spread stays put while older pages load in front of it.
 */
export function DiaryBook({
  owner,
  search,
  onSearch,
  pos,
  onPos,
  onEdit,
  onWrite,
  onClose,
}: {
  owner?: DiaryOwner
  search: string
  onSearch: (value: string) => void
  pos: number
  onPos: (pos: number) => void
  onEdit: (entry: DiaryEntry) => void
  onWrite: () => void
  onClose: () => void
}) {
  const wide = useWide()
  const query = useDeferredValue(search.trim())
  const diary = useDiary(query, owner?.id)
  const [flip, setFlip] = useState<Flip | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const gesture = useRef<Gesture | null>(null)

  const first = diary.data?.pages[0]
  const loaded = diary.data?.pages.flatMap((p) => p.data) ?? []
  const total = first?.total ?? 0
  const chronological = [...loaded].reverse()
  const olderNotLoaded = total - loaded.length
  const dates = first?.dates ?? []

  const pages: Array<BookPage> = [
    ...(diary.hasNextPage ? [] : [{ kind: 'title' } as const]),
    ...chronological.map((entry, i) => ({ kind: 'entry' as const, entry, number: olderNotLoaded + i + 1 })),
    ...(owner || query ? [] : [{ kind: 'blank' } as const]),
  ]

  const pageAt = (index: number): BookPage | undefined => (index >= 0 ? pages[index] : undefined)

  const step = wide ? 2 : 1
  const last = Math.max(pages.length - 1, 0)
  const maxPos = wide ? last - (last % 2) : last
  const at = Math.min(wide ? pos - (pos % 2) : pos, maxPos)
  /** Page indexes shown at a position: [left, right] on wide screens, [page] on phones. */
  const spreadAt = (position: number): Array<number> => {
    const right = pages.length - 1 - position
    return wide ? [right - 1, right] : [right]
  }
  const visible = spreadAt(at)
  const rightIndex = visible[visible.length - 1]
  const firstVisible = visible[0]
  const canNext = at > 0
  const canPrev = firstVisible > 0 || diary.hasNextPage

  /** Turns the page forward (newer) or back (older), animating the leaf unless motion is reduced. */
  const go = (direction: 'next' | 'prev') => {
    if (flip || drag || (direction === 'next' ? !canNext : !canPrev)) return
    const animate = !window.matchMedia(REDUCED_MOTION).matches && (direction === 'next' || firstVisible > 0)
    if (animate) setFlip({ direction, from: at })
    onPos(direction === 'next' ? at - step : Math.min(at + step, maxPos + step))
  }

  useEffect(() => {
    if (!flip) return
    const timer = window.setTimeout(() => setFlip(null), FLIP_MS + 300)
    return () => window.clearTimeout(timer)
  }, [flip])

  /** Press and hold anywhere on a page (not on its buttons), then drag left for newer pages or right for older. */
  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (flip || drag || diary.isLoading || (e.pointerType === 'mouse' && e.button !== 0)) return
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      width: e.currentTarget.getBoundingClientRect().width,
      lastX: e.clientX,
      lastT: e.timeStamp,
      vx: 0,
      direction: null,
    }
  }

  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (g?.id !== e.pointerId) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y

    if (!g.direction) {
      if (Math.abs(dx) < DRAG_START_PX) {
        if (Math.abs(dy) > DRAG_START_PX * 1.5) gesture.current = null
        return
      }
      const direction = dx < 0 ? 'next' : 'prev'
      // Older pages that haven't loaded yet can't be held; the corner and arrows still turn to them.
      const allowed = direction === 'next' ? canNext : firstVisible > 0
      if (Math.abs(dx) < Math.abs(dy) || !allowed) {
        gesture.current = null
        return
      }
      g.direction = direction
      e.currentTarget.setPointerCapture(e.pointerId)
      window.getSelection()?.removeAllRanges()
    }

    const dt = e.timeStamp - g.lastT
    if (dt > 0) g.vx = (e.clientX - g.lastX) / dt
    g.lastX = e.clientX
    g.lastT = e.timeStamp

    const forward = g.direction === 'next'
    const span = g.width * (wide ? 0.55 : 0.75)
    const progress = Math.min(1, Math.max(0, (forward ? -dx : dx) / span))
    setDrag({
      direction: g.direction,
      target: forward ? at - step : Math.min(at + step, maxPos + step),
      progress,
      settle: null,
    })
  }

  const onDragEnd = (e: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const g = gesture.current
    if (g?.id !== e.pointerId) return
    gesture.current = null
    if (!g.direction) return
    const flick = (g.direction === 'next' ? -g.vx : g.vx) > 0.45
    setDrag((current) => {
      if (!current) return null
      const complete = !cancelled && (current.progress > 0.35 || (flick && current.progress > 0.04))
      return { ...current, progress: complete ? 1 : 0, settle: complete ? 'complete' : 'cancel' }
    })
  }

  useEffect(() => {
    if (!drag?.settle) return
    const { settle, target } = drag
    const timer = window.setTimeout(() => {
      if (settle === 'complete') onPos(target)
      setDrag(null)
    }, SETTLE_MS + 20)
    return () => window.clearTimeout(timer)
  }, [drag, onPos])

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = diary
  useEffect(() => {
    if (firstVisible <= 4 && hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [firstVisible, hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') go('prev')
      if (e.key === 'ArrowRight') go('next')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const renderPage = (index: number, side: Side) => {
    const page = pageAt(index)
    if (!page) {
      return (
        <div className="diary-endpaper grid h-full place-items-center rounded-l-md">
          {diary.isFetchingNextPage ? (
            <LoaderCircle className="size-6 animate-spin text-brand-navy/40" />
          ) : (
            <BrandMark className="size-16 opacity-20" />
          )}
        </div>
      )
    }
    if (page.kind === 'title') {
      return (
        <Sheet side={side}>
          <TitlePage
            owner={owner}
            query={query}
            total={total}
            since={chronological[0] ? monthLabel(chronological[0].entry_date) : null}
            days={streak(dates)}
          />
        </Sheet>
      )
    }
    if (page.kind === 'blank') {
      return (
        <Sheet side={side}>
          <BlankPage wroteToday={dates.includes(today())} onWrite={onWrite} />
        </Sheet>
      )
    }
    return (
      <Sheet side={side} number={page.number}>
        <EntryPage entry={page.entry} onEdit={owner ? undefined : () => onEdit(page.entry)} />
      </Sheet>
    )
  }

  const sides: Array<Side> = wide ? ['left', 'right'] : ['single']
  /** The spread a turning leaf leaves and the one it lands on: animated after a click, or held while dragging. */
  const turn = flip
    ? { forward: flip.direction === 'next', from: spreadAt(flip.from), to: visible }
    : drag
      ? { forward: drag.direction === 'next', from: visible, to: spreadAt(drag.target) }
      : null
  const forward = turn?.forward ?? false
  const from = turn?.from ?? visible
  const to = turn?.to ?? visible
  /** What lies flat while a leaf turns: the side it uncovers already shows where you're going. */
  const flatPages = !turn ? visible : wide ? (forward ? [from[0], to[1]] : [to[0], from[1]]) : forward ? to : from
  const leaf: {
    front: number
    frontSide: Side
    back?: number
    backSide: Side
    position: string
    animation: string
    shadeClass: string
  } | null = !turn
    ? null
    : wide
      ? forward
        ? {
            front: from[1],
            frontSide: 'right',
            back: to[0],
            backSide: 'left',
            position: 'right-0 w-1/2',
            animation: 'diary-leaf-next',
            shadeClass: 'right-0 w-1/2 bg-gradient-to-r from-black/25 to-transparent',
          }
        : {
            front: from[0],
            frontSide: 'left',
            back: to[1],
            backSide: 'right',
            position: 'left-0 w-1/2',
            animation: 'diary-leaf-prev',
            shadeClass: 'left-0 w-1/2 bg-gradient-to-l from-black/25 to-transparent',
          }
      : forward
        ? {
            front: from[0],
            frontSide: 'single',
            backSide: 'single',
            position: 'inset-x-0',
            animation: 'diary-leaf-away',
            shadeClass: 'inset-x-0 bg-gradient-to-r from-black/20 to-transparent',
          }
        : {
            front: to[0],
            frontSide: 'single',
            backSide: 'single',
            position: 'inset-x-0',
            animation: 'diary-leaf-in',
            shadeClass: 'inset-x-0 bg-black/10',
          }
  const settleTransition = drag?.settle
    ? `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.3, 1), opacity ${SETTLE_MS}ms ease-out`
    : undefined

  const numbers = visible.flatMap((i) => {
    const page = pageAt(i)
    return page?.kind === 'entry' ? [page.number] : []
  })
  const where =
    numbers.length > 0
      ? `Page ${numbers.join('–')} of ${total}`
      : pageAt(rightIndex)?.kind === 'blank'
        ? 'A fresh page'
        : 'Title page'

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-ink/75 px-3 py-5 backdrop-blur-[2px] sm:px-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={owner ? `${owner.firstName}’s diary` : 'My diary'}
        className="mx-auto w-full max-w-[1040px]"
      >
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 text-white">
          <div className="min-w-0">
            <h2 className="font-brand text-[22px] leading-tight font-bold">
              {owner ? `${owner.firstName}’s diary` : 'My diary'}
            </h2>
            <p className="flex items-center gap-1 text-xs text-white/70">
              <Users className="size-3" /> {audienceNote(owner)}
            </p>
          </div>
          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <label className="relative block min-w-0 flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">Search diary</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/60" />
              <input
                type="search"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={owner ? `Search ${owner.firstName}’s diary` : 'Search your diary'}
                className="h-9 w-full rounded-full bg-white/10 pr-3 pl-9 text-[14px] text-white ring-1 ring-white/15 placeholder:text-white/55 focus:bg-white/15 focus:ring-white/40 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
            {owner ? null : (
              <button
                type="button"
                onClick={onWrite}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-brand-navy transition hover:bg-white/90"
              >
                <PenLine className="size-4" /> New page
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close diary"
              className="grid size-9 shrink-0 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="diary-cover relative rounded-[18px] p-2.5 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.65)] sm:p-3">
          <span
            aria-hidden
            className="absolute -top-2 right-[22%] z-10 h-8 w-4 bg-brand-sky shadow-md [clip-path:polygon(0_0,100%_0,100%_100%,50%_80%,0_100%)]"
          />
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={(e) => onDragEnd(e)}
            onPointerCancel={(e) => onDragEnd(e, true)}
            className={cn(
              'diary-reveal relative grid h-[min(72vh,640px)] touch-pan-y rounded-md bg-[#ece4cf] select-none [perspective:2400px] [&_*]:touch-pan-y',
              drag ? 'cursor-grabbing' : 'cursor-grab',
              'shadow-[0_1px_0_#e6dec8,0_2px_0_#d8cfb6,0_3px_0_#e6dec8,0_4px_0_#cfc5aa]',
              wide ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            {diary.isLoading ? (
              <div className={cn('diary-paper grid place-items-center rounded-md', wide && 'col-span-2')}>
                <LoaderCircle className="size-7 animate-spin text-brand-navy/40" />
              </div>
            ) : (
              <>
                {flatPages.map((index, i) => (
                  <div key={sides[i]} className="min-h-0">
                    {renderPage(index, sides[i])}
                  </div>
                ))}

                {turn && leaf ? (
                  <>
                    <span
                      aria-hidden
                      style={
                        drag ? { opacity: Math.sin(drag.progress * Math.PI), transition: settleTransition } : undefined
                      }
                      className={cn(
                        'pointer-events-none absolute inset-y-0 z-10',
                        !drag && 'diary-shade',
                        leaf.shadeClass,
                      )}
                    />
                    <div
                      aria-hidden
                      onAnimationEnd={(e) => {
                        if (e.target === e.currentTarget) setFlip(null)
                      }}
                      style={
                        drag ? { ...dragPose(wide, forward, drag.progress), transition: settleTransition } : undefined
                      }
                      className={cn(
                        'diary-leaf pointer-events-none absolute inset-y-0 z-20',
                        !drag && leaf.animation,
                        leaf.position,
                      )}
                    >
                      <div className="diary-face">{renderPage(leaf.front, leaf.frontSide)}</div>
                      {leaf.back !== undefined ? (
                        <div className="diary-face diary-face-back">{renderPage(leaf.back, leaf.backSide)}</div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    {canPrev ? (
                      <button
                        type="button"
                        aria-label="Turn back a page"
                        title="Turn back a page"
                        onClick={() => go('prev')}
                        className="diary-corner diary-corner-prev absolute bottom-0 left-0 z-10 size-12 rounded-bl-md"
                      />
                    ) : null}
                    {canNext ? (
                      <button
                        type="button"
                        aria-label="Turn the page"
                        title="Turn the page"
                        onClick={() => go('next')}
                        className="diary-corner diary-corner-next absolute right-0 bottom-0 z-10 size-12 rounded-br-md"
                      />
                    ) : null}
                  </>
                )}
              </>
            )}
            {wide ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-black/15"
              />
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 text-white">
          <button
            type="button"
            aria-label="Previous page"
            disabled={!canPrev}
            onClick={() => go('prev')}
            className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="min-w-[150px] text-center font-brand text-[14px] text-white/85 italic">{where}</span>
          <button
            type="button"
            aria-label="Next page"
            disabled={!canNext}
            onClick={() => go('next')}
            className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-white/45">
          <span className="md:hidden">Hold and drag a page, or tap a corner, to turn pages</span>
          <span className="hidden md:inline">
            Click and drag a page left or right, click a corner, or use the ← and → keys to turn pages
          </span>
        </p>
      </div>
    </div>
  )
}
