import type { FeedAuthor } from '@/types/feed'
import type { TournamentSummary } from '@/types/tournament'

export type ClubColor = 'emerald' | 'blue' | 'pink' | 'ink' | 'amber' | 'purple'

export type ClubType = 'club' | 'community'

export type FeeCurrency = 'PHP' | 'USD'

export type FeePeriod = 'one_time' | 'monthly' | 'yearly'

export type FeeStatus = 'paid' | 'unpaid'

/** Public: anyone sees everything and joins directly. Private: members only; others request to join. */
export type ClubVisibility = 'public' | 'private'

export type Club = {
  id: number
  /** Permanent public identifier, given when the club is created. */
  uuid: string
  type: ClubType
  name: string
  /** URL name, e.g. "jci-makati"; changes when the club is renamed. */
  slug: string
  description: string | null
  color: ClubColor
  avatar_url: string | null
  banner_url: string | null
  is_free: boolean
  fee_amount: number | null
  fee_currency: FeeCurrency
  fee_period: FeePeriod | null
  members_count: number
  upcoming_count: number
  visibility: ClubVisibility
  is_member: boolean
  /** You asked to join this private club and the owner hasn't answered yet. */
  has_requested: boolean
  is_owner: boolean
  /** Pending join requests; only counted for the owner. */
  requests_count: number
  my_fee_status: FeeStatus | null
  /** Your officer position here, e.g. "President". */
  my_position: string | null
  created_at: string | null
}

export type ClubSummary = Pick<Club, 'id' | 'uuid' | 'type' | 'name' | 'slug' | 'color' | 'avatar_url'>

export type ClubPosition = {
  id: number
  name: string
  /** Holders can create activities and tournaments. */
  can_organize: boolean
  /** The President always organizes; the owner can't turn it off. */
  organize_locked: boolean
  holders_count: number
}

export type ClubMember = FeedAuthor & {
  role: 'owner' | 'member'
  position: Pick<ClubPosition, 'id' | 'name'> | null
  fee_status: FeeStatus | null
}

export type ActivityResponse = 'going' | 'not_going'

export type ClubActivity = {
  kind: 'club'
  id: number
  title: string
  description: string | null
  location: string | null
  starts_at: string
  has_started: boolean
  going_count: number
  not_going_count: number
  /** Members who are going, earliest answer first. */
  going: Array<FeedAuthor>
  not_going: Array<FeedAuthor>
  my_response: ActivityResponse | null
  club: ClubSummary
  created_by: FeedAuthor
  can_delete: boolean
}

/** Something on your own schedule; only you can see it. You're always going, no reply needed. */
export type PersonalActivity = {
  kind: 'personal'
  id: number
  title: string
  description: string | null
  location: string | null
  is_meeting: boolean
  /** Only for meetings, e.g. a Zoom or Google Meet link. */
  meeting_url: string | null
  /** The club or community it's for; null = personal. */
  club: ClubSummary | null
  starts_at: string
  /** Always null for all-day activities. */
  ends_at: string | null
  all_day: boolean
  has_started: boolean
}

export type BoardActivity = ClubActivity | PersonalActivity

export type PersonalActivityPayload = {
  title: string
  club_id: number | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
  location: string
  is_meeting: boolean
  meeting_url: string
  description: string
}

export type ActivityBoard = {
  /** Club and personal activities from 24 hours ago onward, soonest first. */
  upcoming: Array<BoardActivity>
  /** Older ones, newest first. */
  past: Array<BoardActivity>
  /** Clubs where you can add activities. */
  organize_clubs: Array<ClubSummary>
  /** Every club and community you're in, for tagging your own schedule. */
  my_clubs: Array<ClubSummary>
  clubs_count: number
}

export type ClubDetail = {
  club: Club
  members: Array<ClubMember>
  positions: Array<ClubPosition>
  activities: Array<ClubActivity>
  /** Live and open ones first, then the 10 most recently finished. */
  tournaments: Array<TournamentSummary>
  /** The viewer is the owner or holds a position that can create activities and tournaments. */
  can_organize: boolean
  /** False for non-members of a private club; members, positions, activities and tournaments are then empty. */
  can_view: boolean
  /** People asking to join; only filled in for the owner. */
  join_requests: Array<JoinRequest>
}

export type JoinRequest = FeedAuthor & { requested_at: string | null }

export type CreateClubPayload = {
  type: ClubType
  name: string
  description: string
  color: ClubColor
  visibility: ClubVisibility
  membership: 'free' | 'paid'
  fee_amount?: number
  fee_currency?: FeeCurrency
  fee_period?: FeePeriod
}

export type CreateActivityPayload = {
  title: string
  starts_at: string
  location: string
  description: string
}
