import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import type { AuthUser } from '@/types/auth'
import type { FeedComment, FeedPost, Reaction } from '@/types/feed'
import { Avatar } from '@/components/feed/Avatar'
import { CommentReactionSummary, CommentReactionsDialog, ReactButton } from '@/components/feed/Reactions'
import { toast } from '@/components/feed/Toaster'
import { applyReaction, patchPost } from '@/components/feed/feedCache'
import { timeAgo } from '@/lib/time'
import { apiErrorMessage } from '@/services/authService'
import { feedService } from '@/services/feedService'

export function PostComments({ post, user }: { post: FeedPost; user: AuthUser }) {
  const qc = useQueryClient()
  const key = ['comments', post.id]
  const [body, setBody] = useState('')

  const comments = useQuery({
    queryKey: key,
    queryFn: () => feedService.comments(post.id),
  })

  const add = useMutation({
    mutationFn: () => feedService.addComment(post.id, body.trim()),
    onSuccess: (result) => {
      qc.setQueryData<Array<FeedComment>>(key, (list) => [...(list ?? []), result.comment])
      patchPost(qc, post.id, (p) => ({ ...p, comments_count: result.comments_count }))
      setBody('')
    },
    onError: (error) => toast(apiErrorMessage(error), 'error'),
  })

  const remove = useMutation({
    mutationFn: (commentId: number) => feedService.deleteComment(commentId),
    onSuccess: (result, commentId) => {
      qc.setQueryData<Array<FeedComment>>(key, (list) => list?.filter((c) => c.id !== commentId))
      patchPost(qc, post.id, (p) => ({ ...p, comments_count: result.comments_count }))
    },
    onError: (error) => toast(apiErrorMessage(error), 'error'),
  })

  const [whoReacted, setWhoReacted] = useState<number | null>(null)
  const reactedComment = comments.data?.find((c) => c.id === whoReacted)
  const patchComment = (id: number, changes: Partial<FeedComment>) =>
    qc.setQueryData<Array<FeedComment>>(key, (list) => list?.map((c) => (c.id === id ? { ...c, ...changes } : c)))

  /** Set your reaction (`null` takes it back); the comment updates right away and settles on the server's counts. */
  const react = async (comment: FeedComment, reaction: Reaction | null) => {
    const before = { my_reaction: comment.my_reaction, likes_count: comment.likes_count, reactions: comment.reactions }
    patchComment(comment.id, applyReaction(comment, reaction))
    try {
      const result = reaction
        ? await feedService.reactComment(comment.id, reaction)
        : await feedService.unlikeComment(comment.id)
      patchComment(comment.id, {
        my_reaction: result.my_reaction,
        likes_count: result.likes_count,
        reactions: result.reactions,
      })
    } catch (error) {
      patchComment(comment.id, before)
      toast(apiErrorMessage(error), 'error')
    }
  }

  return (
    <div className="px-4 pt-1 pb-3">
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (body.trim() && !add.isPending) add.mutate()
        }}
      >
        <Avatar name={user.name} src={user.avatar_url} className="size-10 text-[13px]" />
        <div className="flex min-h-10 flex-1 items-center gap-2 rounded-full border border-[#c4c9d4] pr-1 pl-4 focus-within:border-ink/60">
          <input
            autoFocus
            value={body}
            maxLength={1000}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-muted-foreground focus:outline-none"
          />
          {body.trim() ? (
            <button
              type="submit"
              disabled={add.isPending}
              className="flex h-8 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-70"
            >
              {add.isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              Comment
            </button>
          ) : null}
        </div>
      </form>

      {comments.isLoading ? (
        <p className="flex items-center gap-2 py-3 pl-12 text-xs text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" /> Loading comments…
        </p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {comments.data?.map((comment) => (
          <li key={comment.id} className="flex gap-2">
            <Avatar name={comment.author.name} src={comment.author.avatar_url} className="size-10 text-[13px]" />
            <div className="min-w-0 flex-1">
              <div className="relative rounded-lg rounded-tl-none bg-muted px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {comment.author.name}
                    {comment.author.id === user.id ? (
                      <span className="font-normal text-muted-foreground"> · You</span>
                    ) : null}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed break-words whitespace-pre-line text-ink">
                  {comment.body}
                </p>
                {comment.likes_count > 0 ? (
                  <div className="absolute right-2 -bottom-3">
                    <CommentReactionSummary comment={comment} onOpen={() => setWhoReacted(comment.id)} />
                  </div>
                ) : null}
              </div>
              <div className="mt-1 ml-2 flex items-center gap-1">
                <ReactButton
                  variant="small"
                  mine={comment.my_reaction}
                  onReact={(reaction) => void react(comment, reaction)}
                />
                {comment.can_delete ? (
                  <>
                    <span aria-hidden className="text-xs text-muted-foreground">
                      ·
                    </span>
                    <button
                      type="button"
                      disabled={remove.isPending && remove.variables === comment.id}
                      onClick={() => remove.mutate(comment.id)}
                      className="rounded px-1 py-0.5 text-xs font-semibold text-muted-foreground hover:text-danger disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {reactedComment ? <CommentReactionsDialog comment={reactedComment} onClose={() => setWhoReacted(null)} /> : null}
    </div>
  )
}
