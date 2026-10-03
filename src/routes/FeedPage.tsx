import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import type { ComposerRequest } from '@/components/feed/ComposerModal'
import type { FeedPost } from '@/types/feed'
import { ComposerModal } from '@/components/feed/ComposerModal'
import { FeedNavbar } from '@/components/feed/FeedNavbar'
import { MessagingDock } from '@/components/feed/MessagingDock'
import { PostCard } from '@/components/feed/PostCard'
import { PostComposer } from '@/components/feed/PostComposer'
import { ProfileSidebar } from '@/components/feed/ProfileSidebar'
import { RightSidebar } from '@/components/feed/RightSidebar'
import { Toaster } from '@/components/feed/Toaster'
import { useFeed } from '@/components/feed/feedCache'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { feedService } from '@/services/feedService'

function PostSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-white p-4">
      <div className="flex gap-2">
        <div className="size-12 rounded-full bg-muted" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 w-1/3 rounded bg-muted" />
          <div className="h-2.5 w-1/4 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2.5 rounded bg-muted" />
        <div className="h-2.5 w-4/5 rounded bg-muted" />
      </div>
    </div>
  )
}

export default function FeedPage() {
  const user = useCurrentUser()
  const [composer, setComposer] = useState<ComposerRequest | null>(null)
  const [hidden, setHidden] = useState<Set<number>>(() => new Set())
  const sentinelRef = useRef<HTMLDivElement>(null)

  const feed = useFeed()
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed

  const searchStr = useLocation({ select: (location) => location.searchStr })
  const sharedId = useMemo(() => Number(new URLSearchParams(searchStr).get('post')) || null, [searchStr])
  const shared = useQuery({
    queryKey: ['post', sharedId],
    queryFn: () => feedService.get(sharedId as number),
    enabled: sharedId !== null,
  })
  useEffect(() => {
    if (sharedId) window.scrollTo({ top: 0 })
  }, [sharedId])

  const hasUser = user !== null
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: '600px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasUser, hasNextPage, isFetchingNextPage, fetchNextPage])

  const entries = useMemo(() => {
    const seen = new Set<number>()
    return (feed.data?.pages.flatMap((page) => page.data) ?? []).filter((post) => {
      if (seen.has(post.id)) return false
      seen.add(post.id)
      return true
    })
  }, [feed.data])

  if (!user) return null

  const hide = (id: number) => setHidden((prev) => new Set(prev).add(id))
  const unhide = (id: number) =>
    setHidden((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  const quote = (post: FeedPost) => setComposer({ mode: 'post', quote: post })

  const renderEntry = (entry: FeedPost, opts: { hideable: boolean }) => {
    if (hidden.has(entry.id)) {
      return (
        <div
          key={entry.id}
          className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-[13px] text-muted-foreground"
        >
          Post hidden from your feed.
          <button
            type="button"
            onClick={() => unhide(entry.id)}
            className="font-semibold text-brand-blue hover:underline"
          >
            Undo
          </button>
        </div>
      )
    }
    const plain = entry.is_plain_repost && entry.repost_of ? entry.repost_of : null
    return (
      <PostCard
        key={entry.id}
        post={plain ?? entry}
        repostedBy={plain ? entry : undefined}
        user={user}
        onHide={opts.hideable ? () => hide(entry.id) : undefined}
        onQuote={quote}
      />
    )
  }

  return (
    <div className="app-page min-h-dvh">
      <FeedNavbar user={user} />

      <div className="grid grid-cols-1 gap-6 pt-2 sm:px-4 sm:pt-4 md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[minmax(260px,1fr)_minmax(0,680px)_minmax(260px,1fr)] xl:gap-8">
        <div className="hidden md:block">
          <div className="scrollbar-none sticky top-[72px] max-h-[calc(100dvh-72px)] w-full overflow-y-auto pb-4 xl:max-w-[300px]">
            <ProfileSidebar user={user} />
          </div>
        </div>

        <main className="w-full max-w-[680px] space-y-2 justify-self-center pb-16 max-sm:*:rounded-none max-sm:*:border-x-0 sm:space-y-4">
          <PostComposer user={user} onOpen={(mode) => setComposer({ mode })} />
          {shared.data ? (
            <div className="space-y-2 max-sm:*:rounded-none max-sm:*:border-x-0">
              <p className="px-4 text-xs font-semibold text-muted-foreground sm:px-1">
                <span className="on-backdrop">{shared.data.author.id === user.id ? 'Your post' : 'Shared with you'}</span>
              </p>
              {renderEntry(shared.data, { hideable: false })}
            </div>
          ) : null}

          <div className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground sm:px-0">
            <span className="h-px flex-1 bg-[#c4c9d4]" />
            <span className="on-backdrop">
              Sort by: <span className="font-semibold text-ink">Recent</span>
            </span>
          </div>

          {feed.isLoading ? (
            <>
              <PostSkeleton />
              <PostSkeleton />
            </>
          ) : null}

          {feed.isError ? (
            <div className="rounded-xl border border-border bg-white px-4 py-6 text-center text-[13px] text-muted-foreground">
              We couldn’t load your feed.{' '}
              <button
                type="button"
                onClick={() => void feed.refetch()}
                className="font-semibold text-brand-blue hover:underline"
              >
                Try again
              </button>
            </div>
          ) : null}

          {feed.isSuccess && entries.length === 0 ? (
            <div className="rounded-xl border border-border bg-white px-6 py-10 text-center">
              <img src="/denuwe-mark.png" alt="" className="mx-auto size-12" />
              <p className="mt-3 text-[15px] font-semibold text-ink">Your feed is quiet for now</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Share something with your clubs and get the conversation going.
              </p>
              <button
                type="button"
                onClick={() => setComposer({ mode: 'post' })}
                className="mt-4 h-9 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
              >
                Start a post
              </button>
            </div>
          ) : null}

          {entries.map((entry) => renderEntry(entry, { hideable: true }))}

          <div ref={sentinelRef} />
          {isFetchingNextPage ? (
            <p className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Loading more posts…
            </p>
          ) : null}
          {feed.isSuccess && entries.length > 0 && !hasNextPage ? (
            <p className="py-2 text-center text-xs text-muted-foreground">You’re all caught up.</p>
          ) : null}
        </main>

        <div className="hidden w-full max-w-[320px] justify-self-end xl:block">
          <div className="scrollbar-none sticky top-[72px] max-h-[calc(100dvh-72px)] overflow-y-auto pb-14">
            <RightSidebar />
          </div>
        </div>
      </div>

      <MessagingDock user={user} />
      {composer ? <ComposerModal user={user} request={composer} onClose={() => setComposer(null)} /> : null}
      <Toaster />
    </div>
  )
}
