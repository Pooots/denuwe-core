import type { AuthUser } from '@/types/auth'
import { api } from '@/lib/api'
import { authService } from '@/services/authService'

export type ProfileMedia = 'avatar' | 'banner'

export type ProfilePayload = {
  first_name: string
  last_name: string
  headline: string
  pronouns: string
  location: string
  bio: string
  website: string
  contact_email: string
  contact_phone: string
}

export const profileService = {
  async update(payload: ProfilePayload): Promise<AuthUser> {
    const { data } = await api.patch<{ user: AuthUser }>('/profile', payload)
    authService.setUser(data.user)
    return data.user
  },

  async uploadMedia(type: ProfileMedia, file: File): Promise<AuthUser> {
    const form = new FormData()
    form.append('image', file)
    const { data } = await api.post<{ user: AuthUser }>(`/profile/${type}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    authService.setUser(data.user)
    return data.user
  },

  async removeMedia(type: ProfileMedia): Promise<AuthUser> {
    const { data } = await api.delete<{ user: AuthUser }>(`/profile/${type}`)
    authService.setUser(data.user)
    return data.user
  },
}
