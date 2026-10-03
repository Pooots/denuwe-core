import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Crown, LoaderCircle, LogOut, Pencil, Search, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react'
import type { QueryClient } from '@tanstack/react-query'
import type { GroupsOverview, SocietyGroup, SocietyPerson } from '@/types/society'
import { Avatar } from '@/components/feed/Avatar'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { useSocietyOverview } from '@/components/society/societyUi'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { POLL_MS } from '@/lib/polling'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { groupService } from '@/services/groupService'

export const GROUPS_KEY = ['society', 'groups'] as const
export const groupMessagesKey = (groupId: number) => ['society', 'group-messages', groupId] as const

export function useGroups(enabled = true) {
  return useQuery({
    queryKey: GROUPS_KEY,
    queryFn: () => groupService.list(),
    staleTime: 30_000,
    refetchInterval: POLL_MS,
    enabled,
  })
}

function withGroups(qc: QueryClient, change: (groups: Array<SocietyGroup>) => Array<SocietyGroup>): void {
  qc.setQueryData<GroupsOverview>(GROUPS_KEY, (data) => {
    if (!data) return data
    const groups = change(data.data)
    return { data: groups, unread_count: groups.reduce((sum, g) => sum + g.unread_count, 0) }
  })
}

/** Put a new or changed group in the cached list (on top, as it just had activity). */
export function upsertGroup(qc: QueryClient, group: SocietyGroup): void {
  withGroups(qc, (groups) => [group, ...groups.filter((g) => g.id !== group.id)])
}

export function dropGroup(qc: QueryClient, groupId: number): void {
  withGroups(qc, (groups) => groups.filter((g) => g.id !== groupId))
  qc.removeQueries({ queryKey: groupMessagesKey(groupId) })
}

const firstName = (name: string) => name.split(' ')[0]

/** Second line of a group row: the latest message, prefixed with who sent it. */
export function groupPreview(group: SocietyGroup): { text: string; time: string | null } {
  const last = group.last_message
  if (!last) return { text: `${group.member_count} members`, time: null }
  const text =
    last.kind === 'system'
      ? last.body
      : `${last.mine ? 'You' : last.author ? firstName(last.author.name) : 'Someone'}: ${last.body}`
  return { text, time: timeAgo(last.created_at) }
}

/** Two overlapping member photos (other people first), like a group chat icon. */
export function GroupAvatar({ group, className }: { group: SocietyGroup; className?: string }) {
  const me = useCurrentUser()
  const others = group.members.filter((m) => m.id !== me?.id)
  const pool = others.length > 0 ? others : group.members
  const front = pool.at(0)
  const back = pool.at(1)
  if (!front) {
    return (
      <span className={cn('grid shrink-0 place-items-center rounded-full bg-brand-blue/10 text-brand-blue', className)}>
        <Users className="size-1/2" />
      </span>
    )
  }
  if (!back) return <Avatar name={front.name} src={front.avatar_url} className={cn('shrink-0', className)} />
  return (
    <span className={cn('relative block shrink-0', className)} aria-hidden>
      <Avatar
        name={back.name}
        src={back.avatar_url}
        className="absolute top-0 right-0 size-[68%] text-[0.7em] ring-2 ring-white"
      />
      <Avatar
        name={front.name}
        src={front.avatar_url}
        className="absolute bottom-0 left-0 size-[68%] text-[0.7em] ring-2 ring-white"
      />
    </span>
  )
}

/** Search your friends and tick the ones to add. */
function FriendPicker({
  selected,
  onChange,
  exclude = [],
}: {
  selected: Array<number>
  onChange: (ids: Array<number>) => void
  exclude?: Array<number>
}) {
  const [search, setSearch] = useState('')
  const overview = useSocietyOverview()
  const friends = (overview.data?.friends ?? []).filter((p) => !exclude.includes(p.id))
  const query = search.trim().toLowerCase()
  const shown = friends
    .filter((p) => !query || p.name.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name))
  const picked = selected
    .map((id) => friends.find((p) => p.id === id))
    .filter((p): p is SocietyPerson => p !== undefined)
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  return (
    <div>
      {picked.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Selected friends">
          {picked.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                aria-label={`Remove ${p.name}`}
                className="flex h-7 items-center gap-1.5 rounded-full bg-brand-blue/10 pr-2 pl-0.5 text-xs font-semibold text-brand-blue transition hover:bg-brand-blue/15"
              >
                <Avatar name={p.name} src={p.avatar_url} className="size-6 text-[9px]" />
                {firstName(p.name)}
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label className="relative block">
        <span className="sr-only">Search friends</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your friends"
          className="h-9 w-full rounded-full bg-muted pr-3 pl-9 text-[14px] text-ink placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-blue/20 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </label>
      <div className="mt-2 h-[min(280px,40dvh)] overflow-y-auto rounded-xl border border-border">
        {overview.isLoading ? (
          <div className="grid h-full place-items-center">
            <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : shown.length === 0 ? (
          <p className="grid h-full place-items-center px-6 text-center text-[13px] text-muted-foreground">
            {friends.length === 0
              ? exclude.length > 0
                ? 'All your friends are already in this group.'
                : 'Add friends to your society first, then make a group with them.'
              : `No friend named “${search.trim()}”.`}
          </p>
        ) : (
          <ul className="py-1">
            {shown.map((p) => {
              const on = selected.includes(p.id)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(p.id)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted"
                  >
                    <Avatar name={p.name} src={p.avatar_url} className="size-9 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{p.name}</span>
                      {p.headline ? (
                        <span className="block truncate text-xs text-muted-foreground">{p.headline}</span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-full border-2 transition',
                        on ? 'border-brand-blue bg-brand-blue text-white' : 'border-[#c4c9d4]',
                      )}
                    >
                      {on ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export function CreateGroupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (group: SocietyGroup) => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [members, setMembers] = useState<Array<number>>([])
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => groupService.create(name.trim(), members),
    onSuccess: ({ message, group }) => {
      upsertGroup(qc, group)
      void qc.invalidateQueries({ queryKey: GROUPS_KEY })
      toast(message)
      onCreated(group)
    },
    onError: (err) => {
      const fields = apiValidationErrors(err)
      setError((fields && Object.values(fields)[0]?.[0]) || apiErrorMessage(err))
    },
  })

  const canCreate = name.trim() !== '' && members.length > 0 && !create.isPending

  return (
    <Modal
      onClose={() => (create.isPending ? undefined : onClose())}
      title={
        <div>
          <p className="text-[17px] font-semibold text-ink">Create a Group Society</p>
          <p className="text-xs text-muted-foreground">Chat with several friends at once.</p>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canCreate) create.mutate()
        }}
      >
        <div className="space-y-4 px-5 pt-2 pb-4">
          <label className="block">
            <span className="text-[13px] font-semibold text-ink">Group name</span>
            <input
              value={name}
              maxLength={80}
              autoFocus
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              placeholder="e.g. Sunday Runners"
              className="mt-1.5 h-10 w-full rounded-xl border border-[#c4c9d4] px-3 text-[14px] text-ink placeholder:text-muted-foreground focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none"
            />
          </label>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink">
              Add friends{' '}
              {members.length > 0 ? (
                <span className="font-normal text-muted-foreground">· {members.length} selected</span>
              ) : null}
            </p>
            <FriendPicker
              selected={members}
              onChange={(ids) => {
                setMembers(ids)
                setError(null)
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          <p role={error ? 'alert' : undefined} className="min-w-0 flex-1 text-xs text-danger">
            {error}
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={create.isPending}
            className="h-9 rounded-full px-4 text-[13px] font-semibold text-ink/70 transition hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canCreate}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:bg-[#e3e6ee] disabled:text-muted-foreground"
          >
            {create.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Create group
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Members, rename, add people, leave; the owner can also remove people and delete the group. */
export function GroupInfoDialog({
  group,
  onClose,
  onGone,
}: {
  group: SocietyGroup
  onClose: () => void
  /** You left or deleted the group. */
  onGone: () => void
}) {
  const qc = useQueryClient()
  const me = useCurrentUser()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(group.name)
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<Array<number>>([])
  const [confirm, setConfirm] = useState<'leave' | 'delete' | null>(null)

  const refreshChat = () => void qc.invalidateQueries({ queryKey: groupMessagesKey(group.id) })
  const fail = (err: unknown) => toast(apiErrorMessage(err), 'error')

  const rename = useMutation({
    mutationFn: () => groupService.rename(group.id, name.trim()),
    onSuccess: (result) => {
      upsertGroup(qc, result.group)
      refreshChat()
      setRenaming(false)
    },
    onError: fail,
  })
  const add = useMutation({
    mutationFn: () => groupService.addMembers(group.id, picked),
    onSuccess: (result) => {
      upsertGroup(qc, result.group)
      refreshChat()
      toast(result.message)
      setAdding(false)
      setPicked([])
    },
    onError: fail,
  })
  const kick = useMutation({
    mutationFn: (userId: number) => groupService.removeMember(group.id, userId),
    onSuccess: (result) => {
      if (result.group) upsertGroup(qc, result.group)
      refreshChat()
      toast(result.message)
    },
    onError: fail,
  })
  const leave = useMutation({
    mutationFn: (): Promise<{ message: string }> =>
      confirm === 'delete' ? groupService.remove(group.id) : groupService.removeMember(group.id, me?.id ?? 0),
    onSuccess: (result) => {
      dropGroup(qc, group.id)
      toast(result.message)
      onGone()
    },
    onError: fail,
  })

  return (
    <Modal
      onClose={onClose}
      className="max-w-[440px]"
      title={<p className="text-[17px] font-semibold text-ink">Group info</p>}
    >
      <div className="px-5 pb-2">
        <div className="flex flex-col items-center text-center">
          <GroupAvatar group={group} className="size-16 text-lg" />
          {renaming ? (
            <form
              className="mt-3 flex w-full items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (name.trim() && !rename.isPending) rename.mutate()
              }}
            >
              <input
                value={name}
                maxLength={80}
                autoFocus
                aria-label="Group name"
                onChange={(e) => setName(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-xl border border-[#c4c9d4] px-3 text-[14px] text-ink focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!name.trim() || rename.isPending}
                className="h-9 rounded-full bg-brand-blue px-4 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenaming(false)
                  setName(group.name)
                }}
                className="h-9 rounded-full px-3 text-[13px] font-semibold text-ink/70 hover:bg-muted"
              >
                Cancel
              </button>
            </form>
          ) : (
            <p className="mt-3 flex max-w-full items-center gap-1.5 text-[17px] font-semibold text-ink">
              <span className="truncate">{group.name}</span>
              <button
                type="button"
                onClick={() => setRenaming(true)}
                aria-label="Rename group"
                className="grid size-7 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-muted"
              >
                <Pencil className="size-3.5" />
              </button>
            </p>
          )}
          <p className="text-xs text-muted-foreground">{group.member_count} members</p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink">Members</p>
          {adding ? null : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-8 items-center gap-1.5 rounded-full bg-brand-blue/10 px-3 text-xs font-semibold text-brand-blue transition hover:bg-brand-blue/15"
            >
              <UserPlus className="size-3.5" /> Add people
            </button>
          )}
        </div>

        {adding ? (
          <div className="mt-2">
            <FriendPicker selected={picked} onChange={setPicked} exclude={group.members.map((m) => m.id)} />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false)
                  setPicked([])
                }}
                className="h-8 rounded-full px-3 text-xs font-semibold text-ink/70 hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={picked.length === 0 || add.isPending}
                onClick={() => add.mutate()}
                className="flex h-8 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-xs font-semibold text-white disabled:opacity-60"
              >
                {add.isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                Add{picked.length > 0 ? ` ${picked.length}` : ''}
              </button>
            </div>
          </div>
        ) : (
          <ul className="mt-1 max-h-[min(300px,40dvh)] overflow-y-auto">
            {group.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-1.5">
                <Avatar name={m.name} src={m.avatar_url} className="size-9 text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">
                    {m.name}
                    {m.id === me?.id ? <span className="font-normal text-muted-foreground"> · You</span> : null}
                  </span>
                  {m.is_owner ? (
                    <span className="flex items-center gap-1 text-[11px] text-amber-600">
                      <Crown className="size-3" /> Owner
                    </span>
                  ) : null}
                </span>
                {group.is_owner && m.id !== me?.id ? (
                  <button
                    type="button"
                    aria-label={`Remove ${m.name}`}
                    title="Remove from group"
                    disabled={kick.isPending && kick.variables === m.id}
                    onClick={() => {
                      if (window.confirm(`Remove ${m.name} from ${group.name}?`)) kick.mutate(m.id)
                    }}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-ink/60 transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                  >
                    <UserMinus className="size-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border px-3 py-2">
        {confirm ? (
          <div className="flex items-center gap-2 px-2 py-1">
            <p className="min-w-0 flex-1 text-[13px] text-ink">
              {confirm === 'delete'
                ? 'Delete this group and all its messages for everyone?'
                : group.member_count === 1
                  ? 'You’re the last member, so leaving deletes the group.'
                  : `Leave ${group.name}?`}
            </p>
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="h-8 rounded-full px-3 text-xs font-semibold text-ink/70 hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={leave.isPending}
              onClick={() => leave.mutate()}
              className="flex h-8 items-center gap-1.5 rounded-full bg-danger px-3 text-xs font-semibold text-white disabled:opacity-70"
            >
              {leave.isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {confirm === 'delete' ? 'Delete' : 'Leave'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => setConfirm('leave')}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] font-semibold text-ink transition hover:bg-muted"
            >
              <LogOut className="size-4 text-ink/60" /> Leave group
            </button>
            {group.is_owner ? (
              <button
                type="button"
                onClick={() => setConfirm('delete')}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] font-semibold text-danger transition hover:bg-danger/5"
              >
                <Trash2 className="size-4" /> Delete group
              </button>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  )
}
