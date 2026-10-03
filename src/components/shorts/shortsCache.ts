import { useEffect } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { Reaction } from '@/types/feed'
import type { Short, ShortFilters, ShortsPage } from '@/types/short'
import { toast } from '@/components/feed/Toaster'
import { applyReaction } from '@/components/feed/feedCache'
import { apiErrorMessage } from '@/services/authService'
import { shortService } from '@/services/shortService'

export const SHORTS_KEY = ['shorts'] as const

type ShortsData = InfiniteData<ShortsPage, string | null>

export function useShorts(filters: ShortFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...SHORTS_KEY, filters],
    queryFn: ({ pageParam }) => shortService.list(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled,
    retry: false,
  })
}

/** Apply a change to a short in every list it appears in, and in its own query. */
export function patchShort(qc: QueryClient, id: number, patch: (short: Short) => Short): void {
  qc.setQueriesData<ShortsData>({ queryKey: SHORTS_KEY }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({ ...page, data: page.data.map((s) => (s.id === id ? patch(s) : s)) })),
        }
      : data,
  )
  qc.setQueryData<Short>(['short', id], (short) => (short ? patch(short) : short))
}

/** Your new short goes on top of every loaded list it belongs in (never your society feed: that's friends only). */
function belongsIn(filters: ShortFilters, short: Short): boolean {
  if (filters.user && filters.user !== short.author.id) return false
  if (filters.club && filters.club !== short.club?.id) return false
  if (filters.feed === 'society') return false
  if (filters.feed === 'clubs') return short.audience === 'club'
  return true
}

export function prependShort(qc: QueryClient, short: Short): void {
  for (const [queryKey, data] of qc.getQueriesData<ShortsData>({ queryKey: SHORTS_KEY })) {
    const filters = queryKey[1] as ShortFilters | undefined
    if (!data || !filters || !belongsIn(filters, short)) continue
    if (data.pages.some((page) => page.data.some((s) => s.id === short.id))) continue
    const [first, ...rest] = data.pages
    qc.setQueryData<ShortsData>(queryKey, { ...data, pages: [{ ...first, data: [short, ...first.data] }, ...rest] })
  }
}

function removeShort(qc: QueryClient, id: number): void {
  qc.setQueriesData<ShortsData>({ queryKey: SHORTS_KEY }, (data) =>
    data
      ? { ...data, pages: data.pages.map((page) => ({ ...page, data: page.data.filter((s) => s.id !== id) })) }
      : data,
  )
  qc.removeQueries({ queryKey: ['short', id] })
}

const VIEW_AFTER_MS = 1000
const viewed = new Set<number>()

/** Count a view once someone else's short has been on screen for a second; once per short per page load. */
export function useRecordView(short: Short, active: boolean): void {
  const qc = useQueryClient()
  const { id, is_mine: mine } = short
  useEffect(() => {
    if (!active || mine || viewed.has(id)) return
    const timer = window.setTimeout(() => {
      viewed.add(id)
      shortService
        .view(id)
        .then((result) => patchShort(qc, id, (s) => ({ ...s, views_count: result.views_count })))
        .catch(() => viewed.delete(id))
    }, VIEW_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [active, mine, id, qc])
}

export function useShortActions() {
  const qc = useQueryClient()

  /** Set your reaction (`null` takes it back); the short updates right away and settles on the server's counts. */
  const react = async (short: Short, reaction: Reaction | null) => {
    const before = { my_reaction: short.my_reaction, likes_count: short.likes_count, reactions: short.reactions }
    patchShort(qc, short.id, (s) => ({ ...s, ...applyReaction(s, reaction) }))
    try {
      const result = reaction ? await shortService.react(short.id, reaction) : await shortService.unlike(short.id)
      patchShort(qc, short.id, (s) => ({
        ...s,
        my_reaction: result.my_reaction,
        likes_count: result.likes_count,
        reactions: result.reactions,
      }))
    } catch (error) {
      patchShort(qc, short.id, (s) => ({ ...s, ...before }))
      toast(apiErrorMessage(error), 'error')
    }
  }

  const remove = async (short: Short): Promise<boolean> => {
    try {
      await shortService.remove(short.id)
      removeShort(qc, short.id)
      toast('Short deleted.')
      return true
    } catch (error) {
      toast(apiErrorMessage(error), 'error')
      return false
    }
  }

  return { react, remove }
}
