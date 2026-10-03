import type {
  CreateTournamentPayload,
  GameDay,
  GroupStage,
  TournamentDetail,
  TournamentList,
  TournamentPayload,
  TournamentResponse,
} from '@/types/tournament'
import { api } from '@/lib/api'

export type TournamentMedia = 'avatar' | 'banner'

export const tournamentService = {
  async list(): Promise<TournamentList> {
    const { data } = await api.get<TournamentList>('/tournaments')
    return data
  },

  /** By slug, uuid or id. */
  async get(key: string): Promise<TournamentDetail> {
    const { data } = await api.get<{ tournament: TournamentDetail }>(`/tournaments/${encodeURIComponent(key)}`)
    return data.tournament
  },

  async create(payload: CreateTournamentPayload): Promise<TournamentResponse> {
    const { data } = await api.post<TournamentResponse>('/tournaments', payload)
    return data
  },

  async update(id: number, payload: TournamentPayload): Promise<TournamentResponse> {
    const { data } = await api.patch<TournamentResponse>(`/tournaments/${id}`, payload)
    return data
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/tournaments/${id}`)
  },

  async uploadMedia(id: number, type: TournamentMedia, file: File): Promise<TournamentResponse> {
    const form = new FormData()
    form.append('image', file)
    const { data } = await api.post<TournamentResponse>(`/tournaments/${id}/${type}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  async removeMedia(id: number, type: TournamentMedia): Promise<TournamentResponse> {
    const { data } = await api.delete<TournamentResponse>(`/tournaments/${id}/${type}`)
    return data
  },

  async invite(id: number, userIds: Array<number>): Promise<TournamentResponse> {
    const { data } = await api.post<TournamentResponse>(`/tournaments/${id}/invites`, { user_ids: userIds })
    return data
  },

  /** Organizers withdraw an invite; pass your own id to decline. */
  async uninvite(id: number, userId: number): Promise<{ message: string; tournament?: TournamentDetail }> {
    const { data } = await api.delete<{ message: string; tournament?: TournamentDetail }>(
      `/tournaments/${id}/invites/${userId}`,
    )
    return data
  },

  /** Individual: no options. Team: `team_name` starts a team, `entry_id` joins one. */
  async join(id: number, options: { team_name?: string; entry_id?: number } = {}): Promise<TournamentResponse> {
    const { data } = await api.post<TournamentResponse>(`/tournaments/${id}/join`, options)
    return data
  },

  async leave(id: number): Promise<TournamentResponse> {
    const { data } = await api.delete<TournamentResponse>(`/tournaments/${id}/join`)
    return data
  },

  async removeEntry(id: number, entryId: number): Promise<TournamentResponse> {
    const { data } = await api.delete<TournamentResponse>(`/tournaments/${id}/entries/${entryId}`)
    return data
  },

  async start(id: number): Promise<TournamentResponse> {
    const { data } = await api.post<TournamentResponse>(`/tournaments/${id}/start`)
    return data
  },

  /** Turn the round-robin elimination stage on (`single` or `double`) or off (null), and how many groups. */
  async saveGroupStage(
    id: number,
    settings: { group_stage: GroupStage | null; group_count: number },
  ): Promise<TournamentResponse> {
    const { data } = await api.put<TournamentResponse>(`/tournaments/${id}/group-stage`, settings)
    return data
  },

  /** Before the elimination stage starts: an entry id or null for each match-map slot; the rest are drawn at random. */
  async saveGroupSlots(id: number, slots: Array<number | null>): Promise<TournamentResponse> {
    const { data } = await api.put<TournamentResponse>(`/tournaments/${id}/group-slots`, { slots })
    return data
  },

  async saveSchedule(id: number, settings: { minutes: number; days: Array<GameDay> }): Promise<TournamentResponse> {
    const { data } = await api.put<TournamentResponse>(`/tournaments/${id}/schedule`, settings)
    return data
  },

  /** Put a game on a set day, or back in playing order with `date` null. */
  async moveGame(id: number, key: string, date: string | null): Promise<TournamentResponse> {
    const { data } = await api.put<TournamentResponse>(`/tournaments/${id}/schedule/move`, { key, date })
    return data
  },

  /** During the elimination stage: everyone who moves on to the bracket (the rest are taken off it). */
  async saveAdvancing(id: number, entryIds: Array<number>): Promise<TournamentResponse> {
    const { data } = await api.put<TournamentResponse>(`/tournaments/${id}/advancing`, { entry_ids: entryIds })
    return data
  },

  /** A new bracket with a name and its number of first-round slots; Max players becomes all the slots added up. */
  async createBracket(id: number, bracket: { name: string; size: number }): Promise<TournamentResponse> {
    const { data } = await api.post<TournamentResponse>(`/tournaments/${id}/brackets`, bracket)
    return data
  },

  /** Rename (any time) or resize (before the start) a bracket. */
  async updateBracket(
    id: number,
    bracketId: number,
    bracket: { name: string; size: number },
  ): Promise<TournamentResponse> {
    const { data } = await api.patch<TournamentResponse>(`/tournaments/${id}/brackets/${bracketId}`, bracket)
    return data
  },

  async removeBracket(id: number, bracketId: number): Promise<TournamentResponse> {
    const { data } = await api.delete<TournamentResponse>(`/tournaments/${id}/brackets/${bracketId}`)
    return data
  },

  /** Who's in each of the bracket's slots (an entry id or null), and which first-round pairs play an opening match. */
  async saveBracketDraw(
    id: number,
    bracketId: number,
    slots: Array<number | null>,
    opening: Array<number>,
  ): Promise<TournamentResponse> {
    const { data } = await api.put<TournamentResponse>(`/tournaments/${id}/brackets/${bracketId}/draw`, {
      slots,
      opening,
    })
    return data
  },

  /** Round titles counted back from the bracket's final; null or blank for the usual name. */
  async saveRoundNames(id: number, bracketId: number, names: Array<string | null>): Promise<TournamentResponse> {
    const { data } = await api.put<TournamentResponse>(`/tournaments/${id}/brackets/${bracketId}/round-names`, {
      names,
    })
    return data
  },

  async reset(id: number): Promise<TournamentResponse> {
    const { data } = await api.post<TournamentResponse>(`/tournaments/${id}/reset`)
    return data
  },

  async recordMatch(
    id: number,
    matchId: number,
    result: { winner_id: number | null; score1: number | null; score2: number | null },
  ): Promise<TournamentResponse> {
    const { data } = await api.put<TournamentResponse>(`/tournaments/${id}/matches/${matchId}`, result)
    return data
  },

  async clearMatch(id: number, matchId: number): Promise<TournamentResponse> {
    const { data } = await api.delete<TournamentResponse>(`/tournaments/${id}/matches/${matchId}`)
    return data
  },
}
