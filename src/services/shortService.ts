import type { PostReactions, Reaction } from '@/types/feed'
import type {
  CreateShortInput,
  Short,
  ShortComment,
  ShortCommentLikeResult,
  ShortFilters,
  ShortLikeResult,
  ShortsPage,
} from '@/types/short'
import { api } from '@/lib/api'

export const shortService = {
  async list(filters: ShortFilters, cursor: string | null): Promise<ShortsPage> {
    const { data } = await api.get<ShortsPage>('/shorts', {
      params: {
        feed: filters.feed,
        user: filters.user,
        club: filters.club,
        limit: filters.limit,
        cursor: cursor ?? undefined,
      },
    })
    return data
  },

  async get(id: number): Promise<Short> {
    const { data } = await api.get<{ short: Short }>(`/shorts/${id}`)
    return data.short
  },

  /** `onProgress` gets the upload progress from 0 to 1. */
  async create(
    input: CreateShortInput,
    { onProgress, signal }: { onProgress?: (progress: number) => void; signal?: AbortSignal } = {},
  ): Promise<{ message: string; short: Short }> {
    const form = new FormData()
    form.append('kind', input.kind)
    if (input.kind === 'video') {
      form.append('video', input.video)
      if (input.poster) form.append('poster', input.poster, 'poster.jpg')
      form.append('duration', input.duration.toFixed(2))
    } else {
      form.append('image', input.image)
    }
    if (input.caption.trim()) form.append('caption', input.caption.trim())
    form.append('audience', input.audience)
    if (input.audience === 'club' && input.clubId) form.append('club_id', String(input.clubId))
    if (input.width) form.append('width', String(input.width))
    if (input.height) form.append('height', String(input.height))

    const { data } = await api.post<{ message: string; short: Short }>('/shorts', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(event.loaded / event.total)
      },
    })
    return data
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/shorts/${id}`)
  },

  async view(id: number): Promise<{ short_id: number; views_count: number }> {
    const { data } = await api.post<{ short_id: number; views_count: number }>(`/shorts/${id}/view`)
    return data
  },

  async react(id: number, reaction: Reaction): Promise<ShortLikeResult> {
    const { data } = await api.post<ShortLikeResult>(`/shorts/${id}/like`, { reaction })
    return data
  },

  async unlike(id: number): Promise<ShortLikeResult> {
    const { data } = await api.delete<ShortLikeResult>(`/shorts/${id}/like`)
    return data
  },

  async reactions(id: number): Promise<PostReactions> {
    const { data } = await api.get<PostReactions>(`/shorts/${id}/reactions`)
    return data
  },

  async comments(id: number): Promise<Array<ShortComment>> {
    const { data } = await api.get<{ data: Array<ShortComment> }>(`/shorts/${id}/comments`)
    return data.data
  },

  async addComment(id: number, body: string): Promise<{ comment: ShortComment; comments_count: number }> {
    const { data } = await api.post<{ comment: ShortComment; comments_count: number }>(`/shorts/${id}/comments`, {
      body,
    })
    return data
  },

  async deleteComment(commentId: number): Promise<{ short_id: number; comments_count: number }> {
    const { data } = await api.delete<{ short_id: number; comments_count: number }>(`/short-comments/${commentId}`)
    return data
  },

  async reactComment(commentId: number, reaction: Reaction): Promise<ShortCommentLikeResult> {
    const { data } = await api.post<ShortCommentLikeResult>(`/short-comments/${commentId}/like`, { reaction })
    return data
  },

  async unlikeComment(commentId: number): Promise<ShortCommentLikeResult> {
    const { data } = await api.delete<ShortCommentLikeResult>(`/short-comments/${commentId}/like`)
    return data
  },

  async commentReactions(commentId: number): Promise<PostReactions> {
    const { data } = await api.get<PostReactions>(`/short-comments/${commentId}/reactions`)
    return data
  },
}
