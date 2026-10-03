import type {
  ActivityBoard,
  ActivityResponse,
  Club,
  ClubActivity,
  ClubDetail,
  ClubPosition,
  CreateActivityPayload,
  CreateClubPayload,
  FeeStatus,
  PersonalActivity,
  PersonalActivityPayload,
} from '@/types/club'
import { api } from '@/lib/api'

export type ClubMedia = 'avatar' | 'banner'

type PositionsResponse = { message: string; positions: Array<ClubPosition> }

type PersonalActivityResponse = { message: string; activity: PersonalActivity }

export const clubService = {
  async list(search = ''): Promise<Array<Club>> {
    const { data } = await api.get<{ data: Array<Club> }>('/clubs', {
      params: search.trim() ? { search: search.trim() } : undefined,
    })
    return data.data
  },

  async mine(): Promise<Array<Club>> {
    const { data } = await api.get<{ data: Array<Club> }>('/clubs/mine')
    return data.data
  },

  /** By slug, or by id for older links. */
  async get(slugOrId: string): Promise<ClubDetail> {
    const { data } = await api.get<ClubDetail>(`/clubs/${encodeURIComponent(slugOrId)}`)
    return data
  },

  async create(payload: CreateClubPayload): Promise<Club> {
    const { data } = await api.post<{ club: Club }>('/clubs', payload)
    return data.club
  },

  async update(id: number, payload: CreateClubPayload): Promise<Club> {
    const { data } = await api.patch<{ club: Club }>(`/clubs/${id}`, payload)
    return data.club
  },

  async uploadMedia(id: number, type: ClubMedia, file: File): Promise<Club> {
    const form = new FormData()
    form.append('image', file)
    const { data } = await api.post<{ club: Club }>(`/clubs/${id}/${type}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.club
  },

  async removeMedia(id: number, type: ClubMedia): Promise<Club> {
    const { data } = await api.delete<{ club: Club }>(`/clubs/${id}/${type}`)
    return data.club
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/clubs/${id}`)
  },

  async join(id: number): Promise<Club> {
    const { data } = await api.post<{ club: Club }>(`/clubs/${id}/join`)
    return data.club
  },

  async leave(id: number): Promise<Club> {
    const { data } = await api.delete<{ club: Club }>(`/clubs/${id}/join`)
    return data.club
  },

  async approveRequest(clubId: number, userId: number): Promise<string> {
    const { data } = await api.post<{ message: string }>(`/clubs/${clubId}/requests/${userId}`)
    return data.message
  },

  async declineRequest(clubId: number, userId: number): Promise<string> {
    const { data } = await api.delete<{ message: string }>(`/clubs/${clubId}/requests/${userId}`)
    return data.message
  },

  async setMemberFee(clubId: number, userId: number, feeStatus: FeeStatus): Promise<void> {
    await api.patch(`/clubs/${clubId}/members/${userId}`, { fee_status: feeStatus })
  },

  async addPosition(clubId: number, name: string): Promise<Array<ClubPosition>> {
    const { data } = await api.post<PositionsResponse>(`/clubs/${clubId}/positions`, { name })
    return data.positions
  },

  async renamePosition(clubId: number, positionId: number, name: string): Promise<Array<ClubPosition>> {
    const { data } = await api.patch<PositionsResponse>(`/clubs/${clubId}/positions/${positionId}`, { name })
    return data.positions
  },

  async setPositionOrganizer(
    clubId: number,
    positionId: number,
    canOrganize: boolean,
  ): Promise<{ message: string; positions: Array<ClubPosition> }> {
    const { data } = await api.patch<PositionsResponse>(`/clubs/${clubId}/positions/${positionId}`, {
      can_organize: canOrganize,
    })
    return data
  },

  async removePosition(clubId: number, positionId: number): Promise<Array<ClubPosition>> {
    const { data } = await api.delete<PositionsResponse>(`/clubs/${clubId}/positions/${positionId}`)
    return data.positions
  },

  async reorderPositions(clubId: number, ids: Array<number>): Promise<Array<ClubPosition>> {
    const { data } = await api.put<PositionsResponse>(`/clubs/${clubId}/positions/order`, { ids })
    return data.positions
  },

  /** Pass `null` to clear the member's position. */
  async assignPosition(clubId: number, userId: number, positionId: number | null): Promise<string> {
    const { data } = await api.put<{ message: string }>(`/clubs/${clubId}/members/${userId}/position`, {
      position_id: positionId,
    })
    return data.message
  },

  async activityBoard(): Promise<ActivityBoard> {
    const { data } = await api.get<ActivityBoard>('/activities')
    return data
  },

  async addPersonalActivity(payload: PersonalActivityPayload): Promise<PersonalActivityResponse> {
    const { data } = await api.post<PersonalActivityResponse>('/personal-activities', payload)
    return data
  },

  async updatePersonalActivity(id: number, payload: PersonalActivityPayload): Promise<PersonalActivityResponse> {
    const { data } = await api.put<PersonalActivityResponse>(`/personal-activities/${id}`, payload)
    return data
  },

  async removePersonalActivity(id: number): Promise<void> {
    await api.delete(`/personal-activities/${id}`)
  },

  async upcoming(limit = 5): Promise<Array<ClubActivity>> {
    const { data } = await api.get<{ data: Array<ClubActivity> }>('/activities/upcoming', { params: { limit } })
    return data.data
  },

  async addActivity(clubId: number, payload: CreateActivityPayload): Promise<ClubActivity> {
    const { data } = await api.post<{ activity: ClubActivity }>(`/clubs/${clubId}/activities`, payload)
    return data.activity
  },

  async removeActivity(id: number): Promise<void> {
    await api.delete(`/activities/${id}`)
  },

  async respondToActivity(id: number, status: ActivityResponse): Promise<{ message: string; activity: ClubActivity }> {
    const { data } = await api.put<{ message: string; activity: ClubActivity }>(`/activities/${id}/response`, {
      status,
    })
    return data
  },
}
