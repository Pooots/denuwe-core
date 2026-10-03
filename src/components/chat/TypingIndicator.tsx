import type { Typer } from '@/components/chat/typing'
import { typingLabel } from '@/components/chat/typing'
import { Avatar } from '@/components/feed/Avatar'
import { cn } from '@/lib/utils'

/** A "typing" bubble (three bouncing dots) under the latest message, with who is typing. */
export function TypingIndicator({ typers, className }: { typers: Array<Typer>; className?: string }) {
  if (typers.length === 0) return null
  const shown = typers.slice(0, 3)
  return (
    <div className={cn('mt-1 flex items-start gap-2', className)} aria-live="polite">
      <div className="mt-0.5 flex shrink-0 -space-x-2">
        {shown.map((t) => (
          <Avatar key={t.id} name={t.name} src={t.avatar_url} className="size-7 text-[10px] ring-2 ring-white" />
        ))}
      </div>
      <div className="min-w-0">
        <div className="flex w-fit items-center gap-1 rounded-[18px] bg-muted px-3.5 py-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-bounce rounded-full bg-ink/40"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{typingLabel(typers)}</p>
      </div>
    </div>
  )
}

/** "typing..." in place of a chat's last-message preview in lists. */
export function TypingPreview({ typers, group = false }: { typers: Array<Typer>; group?: boolean }) {
  if (typers.length === 0) return null
  return <span className="font-medium text-brand-blue">{group ? typingLabel(typers) : 'typing...'}</span>
}
