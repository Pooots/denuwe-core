import { Link } from '@tanstack/react-router'
import { CalendarDays, Image, Newspaper } from 'lucide-react'
import type { ComposerMode } from '@/components/feed/ComposerModal'
import type { AuthUser } from '@/types/auth'
import { Avatar } from '@/components/feed/Avatar'

const ACTIONS = [
  { icon: <Image className="size-5 text-sky-500" />, label: 'Photo', mode: 'photo' as const },
  { icon: <CalendarDays className="size-5 text-amber-500" />, label: 'Event', mode: 'event' as const },
  { icon: <Newspaper className="size-5 text-rose-500" />, label: 'Write article', mode: 'article' as const },
]

export function PostComposer({ user, onOpen }: { user: AuthUser; onOpen: (mode: ComposerMode) => void }) {
  const firstName = user.first_name || user.name.split(' ')[0]

  return (
    <section className="rounded-xl border border-border bg-white px-3 py-3 sm:px-4 sm:pt-3 sm:pb-1">
      <div className="flex items-center gap-2">
        <Link to="/profile" aria-label="View your profile" className="shrink-0">
          <Avatar name={user.name} src={user.avatar_url} className="size-10 text-[13px] sm:size-12 sm:text-[15px]" />
        </Link>
        <button
          type="button"
          onClick={() => onOpen('post')}
          className="h-10 min-w-0 flex-1 truncate rounded-full border border-[#c4c9d4] px-4 text-left text-[14px] text-muted-foreground transition hover:bg-muted sm:h-12 sm:text-[15px] sm:font-semibold"
        >
          <span className="sm:hidden">What’s on your mind, {firstName}?</span>
          <span className="hidden sm:inline">Start a post</span>
        </button>
        <button
          type="button"
          onClick={() => onOpen('photo')}
          aria-label="Add a photo"
          className="flex shrink-0 flex-col items-center rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-ink/70 transition hover:bg-muted active:scale-95 sm:hidden"
        >
          <Image className="size-6 text-sky-500" />
          Photo
        </button>
      </div>

      <div className="scrollbar-none -mx-3 mt-2.5 flex gap-2 overflow-x-auto px-3 sm:hidden">
        {ACTIONS.slice(1).map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onOpen(action.mode)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-semibold text-ink/80 transition hover:bg-[#e4e7ee] active:scale-95 [&_svg]:size-4"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      <div className="mt-1 hidden justify-around sm:flex">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onOpen(action.mode)}
            className="flex items-center gap-2 rounded-lg px-3 py-3 text-[13px] font-semibold text-ink/80 transition hover:bg-muted"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </section>
  )
}
