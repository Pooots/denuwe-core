import { useMemo, useState } from 'react'
import { Image, LoaderCircle, Lock } from 'lucide-react'
import type { AuthUser } from '@/types/auth'
import type { Club } from '@/types/club'
import type { ComposerRequest } from '@/components/feed/ComposerModal'
import type { FeedPost } from '@/types/feed'
import { CLUB_TYPE_LABEL } from '@/components/clubs/clubUi'
import { Avatar } from '@/components/feed/Avatar'
import { ComposerModal } from '@/components/feed/ComposerModal'
import { PostCard } from '@/components/feed/PostCard'
import { useClubWall } from '@/components/feed/feedCache'

export function ClubWall({ club, user }: { club: Club; user: AuthUser }) {
  const [composer, setComposer] = useState<ComposerRequest | null>(null)
  const wall = useClubWall(club.id, club.is_member)
  const typeLabel = CLUB_TYPE_LABEL[club.type].toLowerCase()

  const posts = useMemo(() => {
    const seen = new Set<number>()
    return (wall.data?.pages.flatMap((page) => page.data) ?? []).filter((post) => {
      if (seen.has(post.id)) return false
      seen.add(post.id)
      return true
    })
  }, [wall.data])

  if (!club.is_member) {
    return (
      <section className="rounded-xl border border-border bg-white px-6 py-10 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-ink/60">
          <Lock className="size-5" />
        </span>
        <p className="mt-3 text-[15px] font-semibold text-ink">The wall is for members</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Join the {typeLabel} to see posts and share with other members.
        </p>
      </section>
    )
  }

  const write = (mode: ComposerRequest['mode']) => setComposer({ mode, club })
  const quote = (post: FeedPost) => setComposer({ mode: 'post', quote: post, club })

  return (
    <div className="space-y-2">
      <section className="rounded-xl border border-border bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar name={user.name} src={user.avatar_url} className="size-10 text-[13px]" />
          <button
            type="button"
            onClick={() => write('post')}
            className="h-10 flex-1 rounded-full border border-[#c4c9d4] px-4 text-left text-[14px] font-semibold text-muted-foreground transition hover:bg-muted"
          >
            Write something to the {typeLabel}…
          </button>
          <button
            type="button"
            onClick={() => write('photo')}
            aria-label="Post a photo"
            className="grid size-10 place-items-center rounded-full text-sky-500 transition hover:bg-muted"
          >
            <Image className="size-5" />
          </button>
        </div>
      </section>

      {wall.isLoading ? <div className="h-32 animate-pulse rounded-xl border border-border bg-white" /> : null}

      {wall.isError ? (
        <div className="rounded-xl border border-border bg-white px-4 py-6 text-center text-[13px] text-muted-foreground">
          We couldn’t load the wall.{' '}
          <button
            type="button"
            onClick={() => void wall.refetch()}
            className="font-semibold text-brand-blue hover:underline"
          >
            Try again
          </button>
        </div>
      ) : null}

      {wall.isSuccess && posts.length === 0 ? (
        <div className="rounded-xl border border-border bg-white px-6 py-10 text-center">
          <p className="text-[15px] font-semibold text-ink">No posts yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Be the first to share an update, a photo or a question with the {typeLabel}.
          </p>
        </div>
      ) : null}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} user={user} onQuote={quote} />
      ))}

      {wall.hasNextPage ? (
        <button
          type="button"
          disabled={wall.isFetchingNextPage}
          onClick={() => void wall.fetchNextPage()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white py-2.5 text-[13px] font-semibold text-ink/70 transition hover:bg-muted disabled:opacity-70"
        >
          {wall.isFetchingNextPage ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Show more posts
        </button>
      ) : null}

      {composer ? <ComposerModal user={user} request={composer} onClose={() => setComposer(null)} /> : null}
    </div>
  )
}
