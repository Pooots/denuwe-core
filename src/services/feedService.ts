import type {
  CommentLikeResult,
  CreatePostInput,
  FeedComment,
  FeedPage,
  FeedPost,
  LikeResult,
  PostReactions,
  Reaction,
  RepostResult,
} from '@/types/feed'
import { api } from '@/lib/api'

export const feedService = {
  async list(cursor: string | null): Promise<FeedPage> {
    const { data } = await api.get<FeedPage>('/posts', { params: cursor ? { cursor } : undefined })
    return data
  },

  async wall(clubId: number, cursor: string | null): Promise<FeedPage> {
    const { data } = await api.get<FeedPage>(`/clubs/${clubId}/posts`, { params: cursor ? { cursor } : undefined })
    return data
  },

  async byUser(userId: number, cursor: string | null): Promise<FeedPage> {
    const { data } = await api.get<FeedPage>(`/users/${userId}/posts`, { params: cursor ? { cursor } : undefined })
    return data
  },

  async get(id: number): Promise<FeedPost> {
    const { data } = await api.get<{ post: FeedPost }>(`/posts/${id}`)
    return data.post
  },

  async create(input: CreatePostInput): Promise<FeedPost> {
    const form = new FormData()
    const body = input.body?.trim()
    if (body) form.append('body', body)
    if (input.image) form.append('image', input.image)
    if (input.repostOfId) form.append('repost_of_id', String(input.repostOfId))
    if (input.clubId) form.append('club_id', String(input.clubId))
    if (input.tournamentId) form.append('tournament_id', String(input.tournamentId))

    const { data } = await api.post<{ post: FeedPost }>('/posts', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.post
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/posts/${id}`)
  },

  async react(id: number, reaction: Reaction): Promise<LikeResult> {
    const { data } = await api.post<LikeResult>(`/posts/${id}/like`, { reaction })
    return data
  },

  async unlike(id: number): Promise<LikeResult> {
    const { data } = await api.delete<LikeResult>(`/posts/${id}/like`)
    return data
  },

  async reactions(id: number): Promise<PostReactions> {
    const { data } = await api.get<PostReactions>(`/posts/${id}/reactions`)
    return data
  },

  async repost(id: number): Promise<RepostResult> {
    const { data } = await api.post<RepostResult>(`/posts/${id}/repost`)
    return data
  },

  async undoRepost(id: number): Promise<RepostResult> {
    const { data } = await api.delete<RepostResult>(`/posts/${id}/repost`)
    return data
  },

  async comments(postId: number): Promise<Array<FeedComment>> {
    const { data } = await api.get<{ data: Array<FeedComment> }>(`/posts/${postId}/comments`)
    return data.data
  },

  async addComment(postId: number, body: string): Promise<{ comment: FeedComment; comments_count: number }> {
    const { data } = await api.post<{ comment: FeedComment; comments_count: number }>(`/posts/${postId}/comments`, {
      body,
    })
    return data
  },

  async reactComment(commentId: number, reaction: Reaction): Promise<CommentLikeResult> {
    const { data } = await api.post<CommentLikeResult>(`/comments/${commentId}/like`, { reaction })
    return data
  },

  async unlikeComment(commentId: number): Promise<CommentLikeResult> {
    const { data } = await api.delete<CommentLikeResult>(`/comments/${commentId}/like`)
    return data
  },

  async commentReactions(commentId: number): Promise<PostReactions> {
    const { data } = await api.get<PostReactions>(`/comments/${commentId}/reactions`)
    return data
  },

  async deleteComment(commentId: number): Promise<{ post_id: number; comments_count: number }> {
    const { data } = await api.delete<{ post_id: number; comments_count: number }>(`/comments/${commentId}`)
    return data
  },
}
