import { useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, LoaderCircle, MessageCircle, SendHorizontal, X } from 'lucide-react'
import type { AuthUser } from '@/types/auth'
import type { Reaction } from '@/types/feed'
import type { Short, ShortComment } from '@/types/short'
import { Avatar } from '@/components/feed/Avatar'
import { applyReaction } from '@/components/feed/feedCache'
import { CommentReactionSummary, ReactButton, ReactionIcon, WhoReactedDialog } from '@/components/feed/Reactions'
import { toast } from '@/components/feed/Toaster'
import { patchShort } from '@/components/shorts/shortsCache'
import { timeAgo } from '@/lib/time'
import { apiErrorMessage } from '@/services/authService'
import { shortService } from '@/services/shortService'

/** Comments on a short, newest at the bottom, with the box to add one. */
export function ShortComments({ short, user, onClose }: { short: Short; user: AuthUser; onClose: () => void }) {
  const qc = useQueryClient()
  const key = ['short-comments', short.id]
  const [body, setBody] = useState('')
  const [whoReacted, setWhoReacted] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const comments = useQuery({ queryKey: key, queryFn: () => shortService.comments(short.id) })

  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const fullHeight = el.scrollHeight + el.offsetHeight - el.clientHeight
    el.style.height = `${Math.min(fullHeight, 120)}px`
    el.style.overflowY = fullHeight > 120 ? 'auto' : 'hidden'
  }, [body])

  const count = comments.data?.length ?? 0
  useLayoutEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [count, short.id])

  const add = useMutation({
    mutationFn: (text: string) => shortService.addComment(short.id, text),
    onSuccess: (result) => {
      qc.setQueryData<Array<ShortComment>>(key, (list) => [...(list ?? []), result.comment])
      patchShort(qc, short.id, (s) => ({ ...s, comments_count: result.comments_count }))
    },
    onError: (error, text) => {
      toast(apiErrorMessage(error), 'error')
      setBody((current) => current || text)
    },
  })

  const remove = useMutation({
    mutationFn: (commentId: number) => shortService.deleteComment(commentId),
    onSuccess: (result, commentId) => {
      qc.setQueryData<Array<ShortComment>>(key, (list) => list?.filter((c) => c.id !== commentId))
      patchShort(qc, short.id, (s) => ({ ...s, comments_count: result.comments_count }))
    },
    onError: (error) => toast(apiErrorMessage(error), 'error'),
  })

  const [whoReactedTo, setWhoReactedTo] = useState<number | null>(null)
  const reactedComment = comments.data?.find((c) => c.id === whoReactedTo)
  const patchComment = (id: number, changes: Partial<ShortComment>) =>
    qc.setQueryData<Array<ShortComment>>(key, (list) => list?.map((c) => (c.id === id ? { ...c, ...changes } : c)))

  /** Set your reaction (`null` takes it back); the comment updates right away and settles on the server's counts. */
  const react = async (comment: ShortComment, reaction: Reaction | null) => {
    const before = { my_reaction: comment.my_reaction, likes_count: comment.likes_count, reactions: comment.reactions }
    patchComment(comment.id, applyReaction(comment, reaction))
    try {
      const result = reaction
        ? await shortService.reactComment(comment.id, reaction)
        : await shortService.unlikeComment(comment.id)
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

  const submit = () => {
    const text = body.trim()
    if (!text || add.isPending) return
    setBody('')
    add.mutate(text)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5 lg:py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to short"
          className="-ml-1 grid size-9 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-muted lg:hidden"
        >
          <ArrowLeft className="size-5" />
        </button>
        <Avatar name={short.author.name} src={short.author.avatar_url} className="size-10 text-sm lg:hidden" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-ink">
            Comments <span className="font-normal text-muted-foreground">{short.comments_count}</span>
          </h2>
          <p className="truncate text-xs text-muted-foreground lg:hidden">
            {short.is_mine ? 'Your short' : `${short.author.name}’s short`}
          </p>
        </div>
        {short.likes_count > 0 ? (
          <button
            type="button"
            onClick={() => setWhoReacted(true)}
            aria-label={`See who reacted (${short.likes_count})`}
            className="flex shrink-0 items-center gap-1 rounded-full bg-muted py-0.5 pr-2 pl-0.5 text-xs font-semibold text-ink/70 transition hover:text-brand-blue"
          >
            <span className="flex -space-x-0.5">
              {short.reactions.slice(0, 3).map((r) => (
                <ReactionIcon key={r.type} type={r.type} size={18} badge />
              ))}
            </span>
            {short.likes_count}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comments"
          className="hidden size-8 shrink-0 place-items-center rounded-full text-ink/70 transition hover:bg-muted lg:grid"
        >
          <X className="size-5" />
        </button>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {comments.isLoading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading comments…
          </p>
        ) : comments.isError ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">{apiErrorMessage(comments.error)}</p>
        ) : comments.data?.length === 0 ? (
          <div className="py-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-ink/60">
              <MessageCircle className="size-5" />
            </span>
            <p className="mt-3 text-[14px] font-semibold text-ink">No comments yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Start the conversation.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {comments.data?.map((comment) => (
              <li key={comment.id} className="flex gap-2">
                <Avatar name={comment.author.name} src={comment.author.avatar_url} className="size-9 text-xs" />
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
                        <CommentReactionSummary comment={comment} onOpen={() => setWhoReactedTo(comment.id)} />
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
        )}
      </div>

      <form
        className="flex shrink-0 items-end gap-2 border-t border-border bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Avatar name={user.name} src={user.avatar_url} className="mb-0.5 size-9 text-xs max-sm:hidden" />
        <textarea
          ref={inputRef}
          rows={1}
          value={body}
          maxLength={1000}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Add a comment…"
          aria-label="Add a comment"
          className="max-h-[120px] min-h-10 min-w-0 flex-1 resize-none rounded-[20px] bg-muted px-4 py-2 text-[16px] text-ink placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-blue/20 focus:outline-none sm:py-2.5 sm:text-[14px]"
        />
        <button
          type="submit"
          aria-label="Post comment"
          disabled={!body.trim() || add.isPending}
          onPointerDown={(e) => e.preventDefault()}
          className="grid size-10 shrink-0 place-items-center rounded-full text-brand-blue transition hover:bg-brand-blue/10 active:scale-90 disabled:text-muted-foreground disabled:hover:bg-transparent"
        >
          {add.isPending ? <LoaderCircle className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
        </button>
      </form>

      {whoReacted ? (
        <WhoReactedDialog
          queryKey={['short-reactions', short.id, short.likes_count, short.my_reaction]}
          load={() => shortService.reactions(short.id)}
          item={short}
          onClose={() => setWhoReacted(false)}
        />
      ) : null}
      {reactedComment ? (
        <WhoReactedDialog
          queryKey={[
            'short-comment-reactions',
            reactedComment.id,
            reactedComment.likes_count,
            reactedComment.my_reaction,
          ]}
          load={() => shortService.commentReactions(reactedComment.id)}
          item={reactedComment}
          onClose={() => setWhoReactedTo(null)}
        />
      ) : null}
    </div>
  )
}
