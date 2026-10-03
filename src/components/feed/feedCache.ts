import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { FeedPage, FeedPost, Reaction } from '@/types/feed'
import { REACTIONS } from '@/types/feed'
import { toast } from '@/components/feed/Toaster'
import { apiErrorMessage } from '@/services/authService'
import { feedService } from '@/services/feedService'

export const FEED_KEY = ['feed'] as const
export const CLUB_WALL_KEY = ['club-wall'] as const
export const USER_POSTS_KEY = ['user-posts'] as const

type FeedData = InfiniteData<FeedPage, string | null>

export function useFeed() {
  return useInfiniteQuery({
    queryKey: FEED_KEY,
    queryFn: ({ pageParam }) => feedService.list(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  })
}

export function useClubWall(clubId: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...CLUB_WALL_KEY, clubId],
    queryFn: ({ pageParam }) => feedService.wall(clubId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled,
    retry: false,
  })
}

export function useUserPosts(userId: number) {
  return useInfiniteQuery({
    queryKey: [...USER_POSTS_KEY, userId],
    queryFn: ({ pageParam }) => feedService.byUser(userId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  })
}

/** Every paged post list: the home feed, each club wall and each profile's posts. */
function mapFeed(qc: QueryClient, fn: (posts: Array<FeedPost>) => Array<FeedPost>): void {
  for (const queryKey of [FEED_KEY, CLUB_WALL_KEY, USER_POSTS_KEY]) {
    qc.setQueriesData<FeedData>({ queryKey }, (data) =>
      data ? { ...data, pages: data.pages.map((page) => ({ ...page, data: fn(page.data) })) } : data,
    )
  }
}

function prependTo(qc: QueryClient, queryKey: ReadonlyArray<unknown>, post: FeedPost): void {
  qc.setQueryData<FeedData>(queryKey, (data) => {
    if (!data || data.pages.some((page) => page.data.some((p) => p.id === post.id))) return data
    const [first, ...rest] = data.pages
    return { ...data, pages: [{ ...first, data: [post, ...first.data] }, ...rest] }
  })
}

function patchOne(post: FeedPost, id: number, patch: (p: FeedPost) => FeedPost): FeedPost {
  let next = post.id === id ? patch(post) : post
  if (next.repost_of?.id === id) next = { ...next, repost_of: patch(next.repost_of) }
  return next
}

/** Apply a change to a post wherever it appears: as a feed item, inside a repost, or as a shared post. */
export function patchPost(qc: QueryClient, id: number, patch: (p: FeedPost) => FeedPost): void {
  mapFeed(qc, (posts) => posts.map((p) => patchOne(p, id, patch)))
  qc.setQueriesData<FeedPost>({ queryKey: ['post'] }, (p) => (p ? patchOne(p, id, patch) : p))
}

export function prependPost(qc: QueryClient, post: FeedPost): void {
  prependTo(qc, FEED_KEY, post)
  prependTo(qc, [...USER_POSTS_KEY, post.author.id], post)
  if (post.club) prependTo(qc, [...CLUB_WALL_KEY, post.club.id], post)
}

function removePosts(qc: QueryClient, predicate: (p: FeedPost) => boolean): void {
  mapFeed(qc, (posts) => posts.filter((p) => !predicate(p)))
}

export function usePostActions() {
  const qc = useQueryClient()

  /** Set your reaction (`null` takes it back); the card updates right away and settles on the server's counts. */
  const react = async (post: FeedPost, reaction: Reaction | null) => {
    const before = pick(post)
    patchPost(qc, post.id, (p) => ({ ...p, ...withReaction(p, reaction) }))
    try {
      const result = reaction ? await feedService.react(post.id, reaction) : await feedService.unlike(post.id)
      patchPost(qc, post.id, (p) => ({
        ...p,
        liked: result.liked,
        my_reaction: result.my_reaction,
        likes_count: result.likes_count,
        reactions: result.reactions,
      }))
    } catch (error) {
      patchPost(qc, post.id, (p) => ({ ...p, ...before }))
      toast(apiErrorMessage(error), 'error')
    }
  }

  const repost = async (post: FeedPost) => {
    try {
      const result = await feedService.repost(post.id)
      if (result.post) prependPost(qc, result.post)
      patchPost(qc, result.post_id, (p) => ({ ...p, reposted: true, reposts_count: result.reposts_count }))
      toast('Reposted to your feed.')
    } catch (error) {
      toast(apiErrorMessage(error), 'error')
    }
  }

  const undoRepost = async (post: FeedPost) => {
    try {
      const result = await feedService.undoRepost(post.id)
      removePosts(qc, (p) => p.is_mine && p.is_plain_repost && p.repost_of?.id === result.post_id)
      patchPost(qc, result.post_id, (p) => ({ ...p, reposted: false, reposts_count: result.reposts_count }))
      toast('Repost removed.')
    } catch (error) {
      toast(apiErrorMessage(error), 'error')
    }
  }

  const remove = async (post: FeedPost) => {
    try {
      await feedService.remove(post.id)
      removePosts(qc, (p) => p.id === post.id || (p.is_plain_repost && p.repost_of?.id === post.id))
      mapFeed(qc, (posts) => posts.map((p) => (p.repost_of?.id === post.id ? { ...p, repost_of: null } : p)))
      if (post.repost_of) {
        patchPost(qc, post.repost_of.id, (p) => ({ ...p, reposts_count: Math.max(0, p.reposts_count - 1) }))
      }
      toast('Post deleted.')
    } catch (error) {
      toast(apiErrorMessage(error), 'error')
    }
  }

  return { react, repost, undoRepost, remove }
}

type ReactionState = Pick<FeedPost, 'liked' | 'my_reaction' | 'likes_count' | 'reactions'>
/** What a post or a comment shows about its reactions. */
type Reactable = Pick<FeedPost, 'my_reaction' | 'likes_count' | 'reactions'>

function pick(post: FeedPost): ReactionState {
  return { liked: post.liked, my_reaction: post.my_reaction, likes_count: post.likes_count, reactions: post.reactions }
}

/** The counts after switching your reaction to `reaction` (`null` takes it back), before the server answers. */
export function applyReaction(item: Reactable, reaction: Reaction | null): Reactable {
  const counts = new Map(item.reactions.map((r) => [r.type, r.count]))
  if (item.my_reaction) counts.set(item.my_reaction, (counts.get(item.my_reaction) ?? 1) - 1)
  if (reaction) counts.set(reaction, (counts.get(reaction) ?? 0) + 1)
  const reactions = [...counts]
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || REACTIONS.indexOf(a.type) - REACTIONS.indexOf(b.type))

  return {
    my_reaction: reaction,
    likes_count: Math.max(0, item.likes_count + (item.my_reaction ? -1 : 0) + (reaction ? 1 : 0)),
    reactions,
  }
}

function withReaction(post: FeedPost, reaction: Reaction | null): ReactionState {
  return { ...applyReaction(post, reaction), liked: reaction !== null }
}
