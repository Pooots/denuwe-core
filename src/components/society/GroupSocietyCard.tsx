import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '@tanstack/react-router'
import { Plus, Users } from 'lucide-react'
import { openGroupInDock } from '@/components/feed/MessagingDock'
import { CreateGroupDialog, GroupAvatar, groupPreview, useGroups } from '@/components/society/groupUi'
import { cn } from '@/lib/utils'

const SHOWN = 6

/** Feed sidebar: create a group chat and jump into the groups you created or were added to. */
export function GroupSocietyCard() {
  const groups = useGroups(30_000)
  const [creating, setCreating] = useState(false)
  const list = groups.data?.data ?? []

  return (
    <section aria-label="Group Society" className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex items-center gap-2.5 px-4 pt-3">
        <span className="brand-gradient grid size-8 shrink-0 place-items-center rounded-lg text-white">
          <Users className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-ink">Group Society</h2>
          <p className="truncate text-[11px] text-muted-foreground">Group chats with your friends</p>
        </div>
        {(groups.data?.unread_count ?? 0) > 0 ? (
          <span
            aria-label={`${groups.data?.unread_count} unread`}
            className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white"
          >
            {groups.data?.unread_count}
          </span>
        ) : null}
      </div>

      <div className="px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-brand-blue/10 text-[13px] font-semibold text-brand-blue transition hover:bg-brand-blue/15"
        >
          <Plus className="size-4" /> Create Group Society
        </button>
      </div>

      {groups.isLoading ? (
        <ul className="space-y-1 px-4 pb-3" aria-hidden>
          {[0, 1].map((i) => (
            <li key={i} className="flex animate-pulse items-center gap-2.5 py-1.5">
              <span className="size-9 rounded-full bg-muted" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-2.5 w-1/2 rounded bg-muted" />
                <span className="block h-2 w-3/4 rounded bg-muted" />
              </span>
            </li>
          ))}
        </ul>
      ) : list.length === 0 ? (
        <p className="px-4 pt-1 pb-4 text-center text-[12px] leading-relaxed text-muted-foreground">
          No groups yet. Start one to chat with several friends at once.
        </p>
      ) : (
        <>
          <ul className="pb-1.5">
            {list.slice(0, SHOWN).map((group) => {
              const { text, time } = groupPreview(group)
              const unread = group.unread_count > 0
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => openGroupInDock(group.id)}
                    className="flex w-full items-center gap-2.5 px-4 py-1.5 text-left transition hover:bg-muted"
                  >
                    <GroupAvatar group={group} className="size-9 text-[11px]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-[13px] text-ink',
                            unread ? 'font-bold' : 'font-semibold',
                          )}
                        >
                          {group.name}
                        </span>
                        {time ? <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span> : null}
                      </span>
                      <span
                        className={cn(
                          'block truncate text-[11px]',
                          unread ? 'font-semibold text-ink' : 'text-muted-foreground',
                        )}
                      >
                        {text}
                      </span>
                    </span>
                    {unread ? (
                      <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-brand-blue px-1 text-[10px] font-bold text-white">
                        {group.unread_count}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
          <Link
            to="/society"
            search={{ tab: 'groups' }}
            className="block border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-ink/70 transition hover:bg-muted hover:text-ink"
          >
            {list.length > SHOWN ? `See all ${list.length} groups` : 'Open in My Society'}
          </Link>
        </>
      )}

      {creating
        ? createPortal(
            <CreateGroupDialog
              onClose={() => setCreating(false)}
              onCreated={(group) => {
                setCreating(false)
                openGroupInDock(group.id)
              }}
            />,
            document.body,
          )
        : null}
    </section>
  )
}
