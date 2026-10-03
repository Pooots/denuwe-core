import { Copy, Share2 } from 'lucide-react'
import type { FeedPost } from '@/types/feed'
import { Modal } from '@/components/feed/Modal'
import { QuotedPost } from '@/components/feed/QuotedPost'
import { toast } from '@/components/feed/Toaster'

export function postLink(id: number): string {
  return `${window.location.origin}/feed?post=${id}`
}

export async function copyPostLink(id: number): Promise<void> {
  try {
    await navigator.clipboard.writeText(postLink(id))
    toast('Link copied to clipboard.')
  } catch {
    toast('Could not copy the link.', 'error')
  }
}

export function SendDialog({ post, onClose }: { post: FeedPost; onClose: () => void }) {
  const link = postLink(post.id)
  const canShare = typeof navigator.share === 'function'

  const share = async () => {
    try {
      await navigator.share({ title: `${post.author.name} on denuwe`, text: post.body ?? undefined, url: link })
      onClose()
    } catch {
      // Share sheet dismissed.
    }
  }

  return (
    <Modal title={<h2 className="text-[17px] font-semibold text-ink">Send post</h2>} onClose={onClose}>
      <div className="space-y-4 px-5 pb-5">
        <QuotedPost post={post} />

        <div>
          <label htmlFor={`post-link-${post.id}`} className="text-xs font-semibold text-muted-foreground">
            Post link
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id={`post-link-${post.id}`}
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-lg border border-[#c4c9d4] bg-muted px-3 text-[13px] text-ink focus:border-brand-blue focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void copyPostLink(post.id)}
              className="flex h-10 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
            >
              <Copy className="size-4" /> Copy
            </button>
          </div>
        </div>

        {canShare ? (
          <button
            type="button"
            onClick={() => void share()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-ink/60 text-[13px] font-semibold text-ink/80 transition hover:border-ink hover:bg-muted"
          >
            <Share2 className="size-4" /> Share via…
          </button>
        ) : null}
      </div>
    </Modal>
  )
}
