import type { ClubSummary } from '@/types/club'
import type { FeedAuthor } from '@/types/feed'

/** How the signed-in user relates to someone. `outgoing` = you sent the request, `incoming` = they did. */
export type Relationship = 'none' | 'friends' | 'incoming' | 'outgoing'

export type SocietyPerson = FeedAuthor & {
  banner_url: string | null
  headline: string | null
  location: string | null
  relationship: Relationship
  mutual_count: number
  since: string | null
  last_message: DirectMessage | null
  unread_count: number
  /** Your 1-to-1 conversation with them, once one exists. */
  conversation_id?: number | null
}

export type SocietyOverview = {
  friends: Array<SocietyPerson>
  incoming: Array<SocietyPerson>
  outgoing: Array<SocietyPerson>
  unread_count: number
}

export type DirectMessage = {
  id: number
  body: string
  mine: boolean
  created_at: string | null
  read_at: string | null
}

export type GroupMember = FeedAuthor & { is_owner: boolean }

/** `system` messages are joins, leaves and renames, already worded as a sentence ("You added Ana Cruz"). */
export type GroupMessage = {
  id: number
  kind: 'text' | 'system'
  body: string
  author: FeedAuthor | null
  mine: boolean
  created_at: string | null
}

/** A Group Society: a group chat between friends. `members` lists the owner first. */
export type SocietyGroup = {
  id: number
  name: string
  is_owner: boolean
  member_count: number
  members: Array<GroupMember>
  last_message: GroupMessage | null
  unread_count: number
  created_at: string | null
}

export type GroupsOverview = {
  data: Array<SocietyGroup>
  unread_count: number
}

/** Someone's profile page. The fields after `can_view` only come back for yourself and your friends. */
export type UserProfile = Omit<SocietyPerson, 'relationship' | 'last_message' | 'unread_count'> & {
  first_name: string
  relationship: Relationship | 'self'
  can_view: boolean
  pronouns?: string | null
  bio?: string | null
  website?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  created_at?: string | null
  friends_count?: number
  diary_count?: number
  positions?: Array<{ club: ClubSummary; position: string }>
}

export type RelationshipResult = {
  message: string
  user_id: number
  relationship: Relationship
}
