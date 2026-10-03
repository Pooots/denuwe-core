import type { ClubSummary } from '@/types/club'
import type { TournamentSummary } from '@/types/tournament'

export type FeedAuthor = {
  id: number
  name: string
  avatar_url: string | null
}

export const REACTIONS = ['like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'] as const
export type Reaction = (typeof REACTIONS)[number]

/** How many people used one reaction on a post. */
export type ReactionCount = { type: Reaction; count: number }

export type FeedPost = {
  id: number
  body: string | null
  image_url: string | null
  created_at: string | null
  author: FeedAuthor
  /** Set when the post was shared in a club or community; only its members can see it. */
  club: ClubSummary | null
  /** A shared tournament, shown as a card under the text. */
  tournament: TournamentSummary | null
  /** A tournament was shared but the viewer can't see it (anymore). */
  tournament_hidden: boolean
  is_mine: boolean
  is_plain_repost: boolean
  likes_count: number
  comments_count: number
  reposts_count: number
  liked: boolean
  my_reaction: Reaction | null
  /** Most used first; `likes_count` is the total. */
  reactions: Array<ReactionCount>
  reposted: boolean
  repost_of: FeedPost | null
}

export type FeedPage = {
  data: Array<FeedPost>
  next_cursor: string | null
}

export type FeedComment = {
  id: number
  post_id: number
  body: string
  created_at: string | null
  author: FeedAuthor
  can_delete: boolean
  /** All reactions on the comment; `reactions` breaks them down, most used first. */
  likes_count: number
  my_reaction: Reaction | null
  reactions: Array<ReactionCount>
}

export type CommentLikeResult = {
  comment_id: number
  my_reaction: Reaction | null
  likes_count: number
  reactions: Array<ReactionCount>
}

export type LikeResult = {
  post_id: number
  liked: boolean
  my_reaction: Reaction | null
  likes_count: number
  reactions: Array<ReactionCount>
}

export type PostReactions = {
  data: Array<{ user: FeedAuthor; reaction: Reaction; is_me: boolean }>
  reactions: Array<ReactionCount>
  total: number
}

export type RepostResult = {
  post_id: number
  reposted: boolean
  reposts_count: number
  post?: FeedPost
}

export type CreatePostInput = {
  body?: string
  image?: File | null
  repostOfId?: number | null
  clubId?: number | null
  tournamentId?: number | null
}
