import type { GroupMessage, GroupsOverview, SocietyGroup } from '@/types/society'
import { api } from '@/lib/api'

type GroupResult = { message: string; group: SocietyGroup }

export const groupService = {
  async list(): Promise<GroupsOverview> {
    const { data } = await api.get<GroupsOverview>('/society/groups')
    return data
  },

  async create(name: string, memberIds: Array<number>): Promise<GroupResult> {
    const { data } = await api.post<GroupResult>('/society/groups', { name, member_ids: memberIds })
    return data
  },

  async rename(id: number, name: string): Promise<GroupResult> {
    const { data } = await api.patch<GroupResult>(`/society/groups/${id}`, { name })
    return data
  },

  async remove(id: number): Promise<{ message: string; group_id: number }> {
    const { data } = await api.delete<{ message: string; group_id: number }>(`/society/groups/${id}`)
    return data
  },

  async addMembers(id: number, userIds: Array<number>): Promise<GroupResult> {
    const { data } = await api.post<GroupResult>(`/society/groups/${id}/members`, { user_ids: userIds })
    return data
  },

  /** Removing yourself leaves the group (the response has no `group` then). */
  async removeMember(
    id: number,
    userId: number,
  ): Promise<{ message: string; group?: SocietyGroup; group_id?: number }> {
    const { data } = await api.delete<{ message: string; group?: SocietyGroup; group_id?: number }>(
      `/society/groups/${id}/members/${userId}`,
    )
    return data
  },

  async messages(id: number): Promise<Array<GroupMessage>> {
    const { data } = await api.get<{ data: Array<GroupMessage> }>(`/society/groups/${id}/messages`)
    return data.data
  },

  async send(id: number, body: string): Promise<GroupMessage> {
    const { data } = await api.post<{ message: GroupMessage }>(`/society/groups/${id}/messages`, { body })
    return data.message
  },
}
