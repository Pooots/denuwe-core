import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Search, Users } from 'lucide-react'
import { Avatar } from '@/components/feed/Avatar'
import { useSocietyOverview } from '@/components/society/societyUi'
import { cn } from '@/lib/utils'

/** Checklist of the viewer's society; people in `exclude` are shown as already in. */
export function FriendPicker({
  selected,
  onChange,
  exclude = new Set<number>(),
  className,
}: {
  selected: Set<number>
  onChange: (next: Set<number>) => void
  exclude?: Set<number>
  className?: string
}) {
  const overview = useSocietyOverview()
  const [search, setSearch] = useState('')
  const friends = overview.data?.friends ?? []
  const needle = search.trim().toLowerCase()
  const shown = friends.filter((f) => f.name.toLowerCase().includes(needle))
  const available = friends.filter((f) => !exclude.has(f.id))

  const toggle = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  if (overview.isLoading) {
    return <div className={cn('h-24 animate-pulse rounded-lg bg-muted', className)} />
  }

  if (friends.length === 0) {
    return (
      <div className={cn('flex items-center gap-3 rounded-lg bg-muted/70 px-4 py-3', className)}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-ink/60">
          <Users className="size-4" />
        </span>
        <p className="text-[13px] text-muted-foreground">
          You can invite people from your society.{' '}
          <Link to="/society" className="font-semibold text-brand-blue hover:underline">
            Add friends
          </Link>{' '}
          first.
        </p>
      </div>
    )
  }

  const allPicked = available.length > 0 && available.every((f) => selected.has(f.id))

  return (
    <div className={cn('rounded-lg border border-[#c4c9d4]', className)}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your society"
          aria-label="Search your society"
          className="h-7 min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-muted-foreground focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {available.length > 1 ? (
          <button
            type="button"
            onClick={() => onChange(allPicked ? new Set() : new Set(available.map((f) => f.id)))}
            className="shrink-0 text-xs font-semibold text-brand-blue hover:underline"
          >
            {allPicked ? 'Clear' : 'Select all'}
          </button>
        ) : null}
      </div>
      <ul className="max-h-56 overflow-y-auto py-1">
        {shown.map((friend) => {
          const taken = exclude.has(friend.id)
          const picked = selected.has(friend.id)
          return (
            <li key={friend.id}>
              <button
                type="button"
                disabled={taken}
                aria-pressed={picked}
                onClick={() => toggle(friend.id)}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
              >
                <Avatar name={friend.name} src={friend.avatar_url} className="size-8 text-[11px]" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{friend.name}</span>
                {taken ? (
                  <span className="text-xs text-muted-foreground">Already in</span>
                ) : (
                  <span
                    className={cn(
                      'grid size-5 place-items-center rounded-md border transition',
                      picked ? 'border-brand-blue bg-brand-blue text-white' : 'border-[#c4c9d4] bg-white',
                    )}
                  >
                    {picked ? <Check className="size-3.5" /> : null}
                  </span>
                )}
              </button>
            </li>
          )
        })}
        {shown.length === 0 ? (
          <li className="px-3 py-3 text-[13px] text-muted-foreground">No friends match “{search.trim()}”.</li>
        ) : null}
      </ul>
    </div>
  )
}
