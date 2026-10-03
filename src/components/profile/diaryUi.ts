import { useInfiniteQuery } from '@tanstack/react-query'
import type { DiaryMood } from '@/types/diary'
import { toDateInput } from '@/components/clubs/CreateActivityDialog'
import { diaryService } from '@/services/diaryService'

export const DIARY_KEY = ['diary'] as const

export const MOODS: Array<{ value: DiaryMood; emoji: string; label: string }> = [
  { value: 'great', emoji: '😄', label: 'Great' },
  { value: 'good', emoji: '🙂', label: 'Good' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'low', emoji: '😔', label: 'Low' },
  { value: 'bad', emoji: '😢', label: 'Rough' },
]

export const moodOf = (value: DiaryMood | null) => MOODS.find((m) => m.value === value) ?? null

/** Your own diary, or a friend's (read-only) when `userId` is given. */
export function useDiary(search = '', userId?: number) {
  return useInfiniteQuery({
    queryKey: [...DIARY_KEY, userId ?? 'mine', search],
    queryFn: ({ pageParam }) => diaryService.list(search, pageParam, userId),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    placeholderData: (previous) => previous,
  })
}

/** "YYYY-MM-DD" as a local date, so it never shifts a day across timezones. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => toDateInput(new Date())

export function dayLabel(day: string): string {
  const date = parseDay(day)
  const now = new Date()
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (day === today()) return 'Today'
  if (day === toDateInput(yesterday)) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

export function monthLabel(day: string): string {
  return parseDay(day).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** Consecutive days with an entry, ending today (or yesterday, so the streak survives until you write today). */
export function streak(dates: Array<string>): number {
  const written = new Set(dates)
  const cursor = new Date()
  if (!written.has(toDateInput(cursor))) cursor.setDate(cursor.getDate() - 1)
  let count = 0
  while (written.has(toDateInput(cursor))) {
    count += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return count
}
