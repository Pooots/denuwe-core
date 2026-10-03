import { useMemo, useState } from 'react'
import { Image, LoaderCircle } from 'lucide-react'
import type { AuthUser } from '@/types/auth'
import type { ComposerRequest } from '@/components/feed/ComposerModal'
import type { FeedPost } from '@/types/feed'
import { Avatar } from '@/components/feed/Avatar'
import { ComposerModal } from '@/components/feed/ComposerModal'
import { PostCard } from '@/components/feed/PostCard'
import { useUserPosts } from '@/components/feed/feedCache'

/** Posts someone created, on their profile. Leave out `firstName` for your own profile, which adds a composer. */
export function ProfilePosts({ authorId, user, firstName }: { authorId: number; user: AuthUser; firstName?: string }) {
  const [composer, setComposer] = useState<ComposerRequest | null>(null)
  const list = useUserPosts(authorId)
  const isMine = firstName === undefined

  const posts = useMemo(() => {
    const seen = new Set<number>()
    return (list.data?.pages.flatMap((page) => page.data) ?? []).filter((post) => {
      if (seen.has(post.id)) return false
      seen.add(post.id)
      return true
    })
  }, [list.data])

  const quote = (post: FeedPost) => setComposer({ mode: 'post', quote: post })

  return (
    <div className="space-y-2">
      <section className="rounded-xl border border-border bg-white px-4 py-3 sm:px-6">
        <h2 className="text-[19px] font-semibold text-ink">Posts</h2>
        {isMine ? (
          <div className="mt-3 flex items-center gap-2">
            <Avatar name={user.name} src={user.avatar_url} className="size-10 text-[13px]" />
            <button
              type="button"
              onClick={() => setComposer({ mode: 'post' })}
              className="h-10 flex-1 rounded-full border border-[#c4c9d4] px-4 text-left text-[14px] font-semibold text-muted-foreground transition hover:bg-muted"
            >
              Start a post
            </button>
            <button
              type="button"
              onClick={() => setComposer({ mode: 'photo' })}
              aria-label="Post a photo"
              className="grid size-10 place-items-center rounded-full text-sky-500 transition hover:bg-muted"
            >
              <Image className="size-5" />
            </button>
          </div>
        ) : null}
      </section>

      {list.isLoading ? <div className="h-32 animate-pulse rounded-xl border border-border bg-white" /> : null}

      {list.isError ? (
        <div className="rounded-xl border border-border bg-white px-4 py-6 text-center text-[13px] text-muted-foreground">
          We couldn’t load the posts.{' '}
          <button
            type="button"
            onClick={() => void list.refetch()}
            className="font-semibold text-brand-blue hover:underline"
          >
            Try again
          </button>
        </div>
      ) : null}

      {list.isSuccess && posts.length === 0 ? (
        <div className="rounded-xl border border-border bg-white px-6 py-10 text-center">
          <p className="text-[15px] font-semibold text-ink">No posts yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {isMine ? 'Your posts and reposts will show up here.' : `${firstName} hasn’t posted anything you can see.`}
          </p>
        </div>
      ) : null}

      {posts.map((entry) => {
        const plain = entry.is_plain_repost && entry.repost_of ? entry.repost_of : null
        return (
          <PostCard
            key={entry.id}
            post={plain ?? entry}
            repostedBy={plain ? entry : undefined}
            user={user}
            onQuote={quote}
          />
        )
      })}

      {list.hasNextPage ? (
        <button
          type="button"
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white py-2.5 text-[13px] font-semibold text-ink/70 transition hover:bg-muted disabled:opacity-70"
        >
          {list.isFetchingNextPage ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Show more posts
        </button>
      ) : null}

      {composer ? <ComposerModal user={user} request={composer} onClose={() => setComposer(null)} /> : null}
    </div>
  )
}
