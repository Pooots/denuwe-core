import type { DiaryEntry, DiaryInput, DiaryPage } from '@/types/diary'
import { api } from '@/lib/api'

export const diaryService = {
  /** Your own diary, or a friend's when `userId` is given. */
  async list(search: string, cursor: string | null, userId?: number): Promise<DiaryPage> {
    const params: Record<string, string> = {}
    if (search.trim()) params.search = search.trim()
    if (cursor) params.cursor = cursor
    const { data } = await api.get<DiaryPage>(userId ? `/users/${userId}/diary` : '/diary', { params })
    return data
  },

  async create(input: DiaryInput): Promise<DiaryEntry> {
    const { data } = await api.post<{ entry: DiaryEntry }>('/diary', input)
    return data.entry
  },

  async update(id: number, input: DiaryInput): Promise<DiaryEntry> {
    const { data } = await api.patch<{ entry: DiaryEntry }>(`/diary/${id}`, input)
    return data.entry
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/diary/${id}`)
  },
}
