import type { ClubSummary } from '@/types/club'
import type { FeedAuthor, Reaction, ReactionCount } from '@/types/feed'

/** Who can see a short: everyone, the author's society (accepted friends), or one club's members. */
export type ShortAudience = 'everyone' | 'society' | 'club'

/** `all` is everything you may see; `society` is your friends' shorts; `clubs` is shorts in your clubs. */
export type ShortFeed = 'all' | 'society' | 'clubs' | 'mine'

export type ShortKind = 'video' | 'image'

export type Short = {
  id: number
  kind: ShortKind
  caption: string | null
  /** Video shorts only. */
  video_url: string | null
  poster_url: string | null
  /** Photo shorts only. */
  image_url: string | null
  /** Seconds; `null` for photos. */
  duration: number | null
  width: number | null
  height: number | null
  audience: ShortAudience
  /** Set when the audience is a club or community. */
  club: ClubSummary | null
  author: FeedAuthor
  is_mine: boolean
  created_at: string | null
  /** People other than the author who watched it, each counted once. */
  views_count: number
  /** All reactions; `reactions` breaks them down, most used first. */
  likes_count: number
  comments_count: number
  my_reaction: Reaction | null
  reactions: Array<ReactionCount>
}

export type ShortsPage = {
  data: Array<Short>
  next_cursor: string | null
}

export type ShortFilters = {
  feed: ShortFeed
  user?: number
  club?: number
  limit?: number
}

export type ShortComment = {
  id: number
  short_id: number
  body: string
  created_at: string | null
  author: FeedAuthor
  can_delete: boolean
  likes_count: number
  my_reaction: Reaction | null
  reactions: Array<ReactionCount>
}

export type ShortCommentLikeResult = {
  comment_id: number
  my_reaction: Reaction | null
  likes_count: number
  reactions: Array<ReactionCount>
}

export type ShortLikeResult = {
  short_id: number
  my_reaction: Reaction | null
  likes_count: number
  reactions: Array<ReactionCount>
}

export type CreateShortInput = {
  caption: string
  audience: ShortAudience
  clubId: number | null
  width: number | null
  height: number | null
} & ({ kind: 'video'; video: File; poster: Blob | null; duration: number } | { kind: 'image'; image: File })

export const SHORT_MAX_SECONDS = 60
export const SHORT_MAX_BYTES = 40 * 1024 * 1024
export const SHORT_MAX_IMAGE_BYTES = 10 * 1024 * 1024
