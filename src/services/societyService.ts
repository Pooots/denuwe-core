import type { RelationshipResult, SocietyOverview, SocietyPerson, UserProfile } from '@/types/society'
import { api } from '@/lib/api'

export const societyService = {
  async overview(): Promise<SocietyOverview> {
    const { data } = await api.get<SocietyOverview>('/society')
    return data
  },

  /** Search by name, exact email or mobile number; without a search returns suggestions. */
  async people(search = ''): Promise<Array<SocietyPerson>> {
    const { data } = await api.get<{ data: Array<SocietyPerson> }>('/society/people', {
      params: search.trim() ? { search: search.trim() } : undefined,
    })
    return data.data
  },

  async add(userId: number): Promise<RelationshipResult> {
    const { data } = await api.post<RelationshipResult>(`/society/${userId}`)
    return data
  },

  async accept(userId: number): Promise<RelationshipResult> {
    const { data } = await api.post<RelationshipResult>(`/society/${userId}/accept`)
    return data
  },

  async profile(userId: number): Promise<UserProfile> {
    const { data } = await api.get<{ user: UserProfile }>(`/users/${userId}`)
    return data.user
  },

  /** Withdraw a sent request, ignore a received one, or remove a friend. */
  async remove(userId: number): Promise<RelationshipResult> {
    const { data } = await api.delete<RelationshipResult>(`/society/${userId}`)
    return data
  },
}
