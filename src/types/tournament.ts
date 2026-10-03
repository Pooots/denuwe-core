import type { ClubSummary } from '@/types/club'
import type { FeedAuthor } from '@/types/feed'

export type TournamentFormat = 'individual' | 'team'

/** Public: listed for everyone and anyone can join. Private: people the organizer invites (and club members). */
export type TournamentVisibility = 'public' | 'private'

export type TournamentBracket = 'single_elimination' | 'double_elimination' | 'round_robin'

/**
 * Double elimination has a winners bracket, a losers bracket and the grand final; other brackets are all `winners`.
 * Elimination-stage (group) matches are `group`.
 */
export type MatchSide = 'winners' | 'losers' | 'final' | 'group'

/** Registration until the organizer starts it; completed once the champion is decided. */
export type TournamentStatus = 'registration' | 'in_progress' | 'completed'

/** An optional round-robin elimination stage before the bracket: everyone plays their group once or twice. */
export type GroupStage = 'single' | 'double'

/** While in progress after an elimination stage: still in the groups, or on to the bracket. */
export type TournamentStage = 'groups' | 'knockout'

/** A player (individual) or a team. */
export type TournamentEntry = {
  id: number
  /** Team name, or the player's name. */
  name: string
  team_name: string | null
  /** Set when the bracket is generated. */
  seed: number | null
  /** Elimination stage: their group (1 = Group A). */
  group_number: number | null
  /** Before the elimination stage starts: the match-map slot the organizer put them in (null = drawn at random). */
  group_slot: number | null
  /** Elimination stage: the organizer picked them to move on to the bracket. */
  advanced: boolean
  captain_id: number | null
  members: Array<FeedAuthor>
}

export type TournamentSummary = {
  id: number
  uuid: string
  /** URL name from the tournament name, e.g. "pickle-ball"; changes when it's renamed. */
  slug: string
  name: string
  game: string | null
  format: TournamentFormat
  team_size: number | null
  visibility: TournamentVisibility
  bracket: TournamentBracket
  /** Elimination brackets only: a round-robin elimination stage first, or null for none. */
  group_stage: GroupStage | null
  /** How many groups the elimination stage splits everyone into. */
  group_count: number
  status: TournamentStatus
  /** Set while in progress when there's an elimination stage. */
  stage: TournamentStage | null
  starts_at: string
  location: string | null
  prize: string | null
  description: string | null
  avatar_url: string | null
  banner_url: string | null
  max_entries: number | null
  entries_count: number
  players_count: number
  is_full: boolean
  /** Null for personal (invite-only) tournaments. */
  club: ClubSummary | null
  created_by: FeedAuthor
  /** The tournament champion; null when there are several brackets (see `champions`). */
  winner: TournamentEntry | null
  /** Each bracket's champion, in bracket order. */
  champions: Array<{ bracket: string; entry: TournamentEntry }>
  started_at: string | null
  completed_at: string | null
  /** The viewer's player or team, if they entered. */
  my_entry_id: number | null
  invite_pending: boolean
  /** Organizer, or the host club's owner. */
  can_manage: boolean
  /** Registration is open and the viewer may enter (invited, club member or organizer). */
  can_enter: boolean
  /** Where the viewer can share it as a post: the feed (public), its club's wall (private) or nowhere. */
  share_to: 'feed' | 'club' | null
}

export type TournamentMatch = {
  id: number
  /** Null for round-robin and elimination-stage matches. */
  bracket_id: number | null
  /** Elimination-stage matches: the group it's played in. */
  group_number: number | null
  side: MatchSide
  round: number
  position: number
  entry1_id: number | null
  entry2_id: number | null
  score1: number | null
  score2: number | null
  /** Null with `completed` means a round-robin draw. */
  winner_id: number | null
  completed: boolean
  is_bye: boolean
}

export type StandingRow = {
  entry_id: number
  played: number
  won: number
  drawn: number
  lost: number
  score_for: number
  score_against: number
  points: number
}

export type TournamentInvite = {
  user: FeedAuthor
  invited_by: FeedAuthor
  created_at: string | null
}

/** One elimination-stage group and its table. */
export type TournamentGroup = {
  number: number
  /** "Group A", "Group B" … */
  name: string
  entry_ids: Array<number>
  rounds: number
  /** Leader first. */
  standings: Array<StandingRow>
}

/**
 * The elimination stage's match map by slot, before anyone is drawn. Slots fill the groups in order and round 1 is
 * slot 1 vs slot 2, slot 3 vs slot 4 …; the start draws players into slots at random and plays this map.
 */
export type GroupMap = {
  /** Max players, or the entries so far when there's no limit. */
  slots: number
  from_max_entries: boolean
  /** Empty when the slots can't make 2 a group. */
  groups: Array<{
    number: number
    name: string
    slots: Array<number>
    rounds: number
    matches: Array<{ round: number; slot1: number; slot2: number }>
  }>
}

/** A playing day in the game setup: its date, the first game's time and how many games are played. */
export type GameDay = {
  /** "2026-10-10" */
  date: string
  /** "09:00" */
  start: string
  games: number
}

/**
 * One game in the schedule, from the elimination stage through the bracket. Before the start it comes from the slot
 * maps (`slot1` vs `slot2`, `match_id` null); afterwards it's the real match.
 */
export type ScheduledGame = {
  /** Names the game the same before and after the start. */
  key: string
  match_id: number | null
  side: MatchSide
  bracket_id: number | null
  group_number: number | null
  round: number
  position: number
  /** The bracket's upper rounds, for round titles. */
  rounds: number
  slot1: number | null
  slot2: number | null
  entry1_id: number | null
  entry2_id: number | null
  score1: number | null
  score2: number | null
  winner_id: number | null
  completed: boolean
  /** Null when no day has room for it yet. */
  date: string | null
  time: string | null
  /** The organizer put it on this day; otherwise it fills the days in playing order. */
  moved: boolean
}

export type GameSchedule = {
  /** How long each game takes; a day's games run back to back. */
  minutes: number
  /** In date order. */
  days: Array<GameDay>
  /** Every game in playing order. */
  games: Array<ScheduledGame>
  /** An elimination stage without a bracket yet: the bracket's games show once one is created. */
  bracket_pending: boolean
}

/** One named bracket in an elimination tournament, e.g. "Men's division". */
export type Bracket = {
  id: number
  name: string
  /** First-round slots. Max players is every bracket's size added up. */
  size: number
  /** Rounds in its winners (upper) bracket once the tournament has started. */
  rounds: number
  /** Before the start: who the organizer put in each first-round slot, top to bottom (null = open). */
  draw: Array<number | null> | null
  /** With the draw: the first-round pairs that play an opening match; every other pair is a bye. */
  opening: Array<number> | null
  /** Custom round titles counted back from the final (0 = final, 1 = semifinals …); null = the usual name. */
  round_names: Array<string | null>
  winner_id: number | null
}

export type TournamentDetail = TournamentSummary & {
  entries: Array<TournamentEntry>
  matches: Array<TournamentMatch>
  /** Round robin: how many rounds. Elimination brackets have their own. */
  rounds: number
  /** Elimination tournaments only, in order. */
  brackets: Array<Bracket>
  /** Round robin only, leader first. */
  standings: Array<StandingRow>
  /** Every result so far across the elimination stage and brackets, leader first; empty until a match is played. */
  overall_standings: Array<StandingRow>
  /** The elimination stage's groups once it has started, Group A first. */
  groups: Array<TournamentGroup>
  /** Before the start, with an elimination stage: who plays who by slot. */
  group_map: GroupMap | null
  /** Game setup: the playing days and when each game is played. */
  schedule: GameSchedule
  /** Pending invites; only filled in for organizers. */
  invites: Array<TournamentInvite>
  invites_count: number
  /** Who invited the viewer, while their invite is pending. */
  invited_by: FeedAuthor | null
  max_team_size: number
}

/**
 * The tournament as one bracket sees it: only its matches, and its rounds, draw, round names and champion. The
 * bracket views take this so they work the same whichever bracket they show.
 */
export type BracketScope = TournamentDetail & {
  /** The bracket being shown (`bracket` stays the tournament's bracket type). */
  group: Bracket
  draw: Array<number | null> | null
  opening: Array<number> | null
  round_names: Array<string | null>
}

export type TournamentList = {
  data: Array<TournamentSummary>
  /** Every public tournament, anyone's. */
  public: Array<TournamentSummary>
  /** Clubs the viewer can host tournaments for. */
  organize_clubs: Array<ClubSummary>
}

export type TournamentPayload = {
  name: string
  game: string
  format: TournamentFormat
  team_size: number | null
  bracket: TournamentBracket
  starts_at: string
  location: string
  prize: string
  max_entries: number | null
  description: string
  visibility: TournamentVisibility
}

export type CreateTournamentPayload = TournamentPayload & {
  club_id: number | null
  invite_ids: Array<number>
}

export type TournamentResponse = { message: string; tournament: TournamentDetail }
