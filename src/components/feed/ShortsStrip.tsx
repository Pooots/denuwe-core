import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Flag,
  Gamepad2,
  ImageIcon,
  Medal,
  Play,
  Plus,
  Trophy,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AuthUser } from '@/types/auth'
import type { Short } from '@/types/short'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/feed/Avatar'
import { CreateShortDialog } from '@/components/shorts/CreateShortDialog'
import { useShorts } from '@/components/shorts/shortsCache'
import { AudienceChip, formatDuration } from '@/components/shorts/shortsUi'

const card =
  'group relative h-[184px] w-[112px] shrink-0 snap-start overflow-hidden rounded-2xl text-left transition active:scale-[0.97] sm:h-[204px] sm:w-[118px]'

const COVERS = [
  'from-brand-navy via-brand-blue to-brand-sky',
  'from-violet-600 via-fuchsia-500 to-pink-400',
  'from-emerald-600 via-teal-500 to-sky-400',
  'from-orange-500 via-rose-500 to-pink-500',
  'from-indigo-700 via-blue-600 to-cyan-400',
]

const IDEAS: Array<{ title: string; hint: string; prompt: string; icon: LucideIcon; cover: string }> = [
  { title: 'Race day', hint: 'Your best finish', prompt: 'How did race day go?', icon: Flag, cover: COVERS[3] },
  { title: 'Club wins', hint: 'Celebrate the team', prompt: 'What did the team win?', icon: Trophy, cover: COVERS[0] },
  { title: 'Game night', hint: 'Highlights', prompt: 'Best moment of game night?', icon: Gamepad2, cover: COVERS[1] },
  {
    title: 'Behind the scenes',
    hint: 'How it’s done',
    prompt: 'Show how it’s done…',
    icon: Clapperboard,
    cover: COVERS[2],
  },
  {
    title: 'Personal best',
    hint: 'Show the work',
    prompt: 'What’s your new personal best?',
    icon: Medal,
    cover: COVERS[4],
  },
]

const MIN_CARDS = 5

const SHORTS_FILTERS = { feed: 'all', limit: 12 } as const

function Shade() {
  return <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
}

function PlayHint() {
  return (
    <span className="absolute top-1/2 left-1/2 grid size-10 -translate-1/2 place-items-center rounded-full bg-white/25 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
      <Play className="size-5 fill-white" />
    </span>
  )
}

function ShortCard({ short }: { short: Short }) {
  return (
    <Link
      to="/shorts"
      search={{ short: short.id }}
      aria-label={`Watch ${short.author.name}’s short${short.caption ? `: ${short.caption}` : ''}`}
      className={cn(card, 'bg-gradient-to-br text-white', COVERS[short.author.id % COVERS.length])}
    >
      {short.image_url || short.poster_url ? (
        <img
          src={short.image_url ?? short.poster_url ?? undefined}
          alt=""
          className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : short.video_url ? (
        <video
          src={`${short.video_url}#t=0.5`}
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      <Shade />
      <span className="absolute top-2 left-2 rounded-full p-[2px] ring-[3px] ring-brand-blue">
        <Avatar name={short.author.name} src={short.author.avatar_url} className="size-9 text-[11px]" />
      </span>
      <span className="absolute top-2 right-2 flex items-center gap-0.5 rounded-full bg-black/50 px-1.5 py-px text-[10px] font-semibold">
        {short.duration !== null ? (
          formatDuration(short.duration)
        ) : (
          <>
            <ImageIcon className="size-2.5" /> Photo
          </>
        )}
      </span>
      {short.kind === 'video' ? <PlayHint /> : null}
      <span className="absolute inset-x-2 bottom-2">
        {short.audience === 'everyone' ? null : <AudienceChip short={short} className="mb-1 px-1.5 text-[9px]" />}
        <span className="line-clamp-2 block text-[13px] leading-tight font-semibold drop-shadow">
          {short.author.name}
        </span>
      </span>
    </Link>
  )
}

function IdeaShort({ idea, onClick }: { idea: (typeof IDEAS)[number]; onClick: () => void }) {
  const Icon = idea.icon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Create a short: ${idea.title}`}
      className={cn(card, 'bg-gradient-to-br text-white', idea.cover)}
    >
      <div className="vibe-gradient absolute inset-0 opacity-30" />
      <Icon
        className="absolute -right-4 -bottom-3 size-24 rotate-[-12deg] text-white/15 transition duration-300 group-hover:rotate-0"
        strokeWidth={1.5}
      />
      <Shade />
      <span className="absolute top-2 left-2 grid size-9 place-items-center rounded-full bg-white/20 ring-[3px] ring-white/60 backdrop-blur-sm">
        <Icon className="size-4" />
      </span>
      <span className="absolute top-1/2 left-1/2 grid size-10 -translate-1/2 place-items-center rounded-full bg-white/25 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
        <Plus className="size-5" />
      </span>
      <span className="absolute inset-x-2 bottom-2">
        <span className="block text-[9px] font-bold tracking-wider text-white/70 uppercase">Short idea</span>
        <span className="block text-[13px] leading-tight font-semibold">{idea.title}</span>
        <span className="block truncate text-[10px] text-white/75">{idea.hint}</span>
      </span>
    </button>
  )
}

/** Story-style row of the latest shorts shared with you, at the top of the feed. */
export function ShortsStrip({ user }: { user: AuthUser }) {
  const shortsQuery = useShorts(SHORTS_FILTERS)
  const shorts = shortsQuery.data?.pages[0]?.data ?? []
  const ideas = shortsQuery.isLoading ? [] : IDEAS.slice(0, Math.max(0, MIN_CARDS - shorts.length))
  const [creating, setCreating] = useState<{ prompt?: string } | null>(null)

  const rowRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: true })

  const measure = useCallback(() => {
    const row = rowRef.current
    if (!row) return
    setEdges({ start: row.scrollLeft <= 4, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure, shorts.length, ideas.length])

  const scroll = (direction: 1 | -1) =>
    rowRef.current?.scrollBy({ left: direction * rowRef.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <section aria-label="Shorts" className="relative rounded-xl border border-border bg-white py-3">
      <div className="flex items-center gap-2 px-3 sm:px-4">
        <h2 className="text-[15px] font-semibold text-ink">Shorts</h2>
        <Link
          to="/shorts"
          className="ml-auto rounded-full px-2 py-1 text-[13px] font-semibold text-brand-blue transition hover:bg-brand-blue/5"
        >
          See all
        </Link>
      </div>

      <div
        ref={rowRef}
        onScroll={measure}
        className="scrollbar-none mt-2.5 flex snap-x snap-mandatory scroll-px-3 gap-2 overflow-x-auto px-3 sm:scroll-px-4 sm:px-4"
      >
        <button
          type="button"
          onClick={() => setCreating({})}
          className={cn(card, 'border border-border bg-white hover:shadow-md')}
        >
          <div className="h-[124px] overflow-hidden bg-muted sm:h-[140px]">
            <Avatar
              name={user.name}
              src={user.avatar_url}
              className="size-full text-3xl group-hover:[&>img]:scale-105 [&>img]:rounded-none [&>img]:transition [&>img]:duration-300 [&>span]:rounded-none"
            />
          </div>
          <span className="absolute top-[108px] left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full bg-brand-blue text-white ring-4 ring-white transition group-hover:scale-110 sm:top-[122px] sm:size-9">
            <Plus className="size-4 sm:size-5" />
          </span>
          <span className="block px-2 pt-6 text-center text-xs leading-tight font-semibold text-ink sm:pt-7">
            Create short
          </span>
        </button>

        {shortsQuery.isLoading
          ? Array.from({ length: 4 }, (_, i) => <div key={i} className={cn(card, 'animate-pulse bg-muted')} />)
          : null}
        {shorts.map((short) => (
          <ShortCard key={short.id} short={short} />
        ))}
        {ideas.map((idea) => (
          <IdeaShort key={idea.title} idea={idea} onClick={() => setCreating({ prompt: idea.prompt })} />
        ))}
      </div>

      {!edges.start ? (
        <button
          type="button"
          aria-label="Previous shorts"
          onClick={() => scroll(-1)}
          className="absolute top-1/2 left-2 hidden size-10 translate-y-2 place-items-center rounded-full border border-border bg-white text-ink shadow-lg transition hover:bg-muted sm:grid"
        >
          <ChevronLeft className="size-5" />
        </button>
      ) : null}
      {!edges.end ? (
        <button
          type="button"
          aria-label="More shorts"
          onClick={() => scroll(1)}
          className="absolute top-1/2 right-2 hidden size-10 translate-y-2 place-items-center rounded-full border border-border bg-white text-ink shadow-lg transition hover:bg-muted sm:grid"
        >
          <ChevronRight className="size-5" />
        </button>
      ) : null}

      {creating ? (
        <CreateShortDialog user={user} placeholder={creating.prompt} onClose={() => setCreating(null)} />
      ) : null}
    </section>
  )
}
