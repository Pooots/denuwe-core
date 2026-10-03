import type { FeedPost } from '@/types/feed'
import { Avatar } from '@/components/feed/Avatar'
import { HiddenTournament, SharedTournament } from '@/components/tournaments/ShareTournament'
import { timeAgo } from '@/lib/time'

/** Compact, read-only preview of a post (used for reposts with thoughts and the send dialog). */
export function QuotedPost({ post }: { post: FeedPost }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-2 px-3 pt-3">
        <Avatar name={post.author.name} src={post.author.avatar_url} className="size-8 text-[11px]" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink">{post.author.name}</p>
          <p className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</p>
        </div>
      </div>
      {post.body ? (
        <p className="line-clamp-3 px-3 pt-2 text-[13px] leading-relaxed whitespace-pre-line text-ink">{post.body}</p>
      ) : null}
      {post.tournament || post.tournament_hidden ? (
        <div className="px-3 pt-2">
          {post.tournament ? <SharedTournament tournament={post.tournament} /> : <HiddenTournament />}
        </div>
      ) : null}
      {post.image_url ? (
        <img src={post.image_url} alt="" className="mt-3 block max-h-64 w-full bg-muted object-cover" loading="lazy" />
      ) : (
        <div className="h-3" />
      )}
    </div>
  )
}
