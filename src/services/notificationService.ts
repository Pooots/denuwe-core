import type { NotificationList } from '@/types/notification'
import { api } from '@/lib/api'

export const notificationService = {
  async list(): Promise<NotificationList> {
    const { data } = await api.get<NotificationList>('/notifications')
    return data
  },

  async markRead(): Promise<void> {
    await api.post('/notifications/read')
  },
}
