import type { FeedAuthor, Reaction } from '@/types/feed'

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'post_like'
  | 'post_comment'
  | 'repost'
  | 'join_request'
  | 'club_activity'
  | 'tournament_invite'

export interface AppNotification {
  id: string
  type: NotificationType
  actor: FeedAuthor | null
  /** For grouped likes: how many people besides `actor`. */
  others_count: number
  /** Post or comment snippet, club name, or activity title, depending on the type. */
  subject: string | null
  /** The club an activity belongs to. */
  context: string | null
  /** For `post_like`: the latest person's reaction, and every reaction used on the post, most used first. */
  reaction?: Reaction
  reactions?: Array<Reaction>
  /** In-app path to open, e.g. `/feed?post=12`. */
  url: string
  created_at: string
  unread: boolean
}

export interface NotificationList {
  data: Array<AppNotification>
  unread_count: number
}
