import type { ActivityBoard, BoardActivity } from '@/types/club'
import { toDateInput } from '@/components/clubs/CreateActivityDialog'

/** Where an activity is in its life, from the viewer's point of view. */
export type ActivityStage = 'planned' | 'reply' | 'going' | 'done'

export const ACTIVITY_STAGES: Array<ActivityStage> = ['planned', 'reply', 'going', 'done']

/** Local calendar day, e.g. "2026-10-02". */
export function dayKey(iso: string): string {
  return toDateInput(new Date(iso))
}

/** Unique across club and personal activities, whose ids can overlap. */
export function activityKey(activity: BoardActivity): string {
  return `${activity.kind}-${activity.id}`
}

/** Personal activities are always on your calendar; club ones once you say you're going. */
export function isOnCalendar(activity: BoardActivity): boolean {
  return activity.kind === 'personal' || activity.my_response === 'going'
}

export function stageActivities(board: ActivityBoard): Record<ActivityStage, Array<BoardActivity>> {
  const today = toDateInput(new Date())
  const isPastDay = (a: BoardActivity) => dayKey(a.starts_at) < today
  const planned = board.upcoming.filter((a) => !isPastDay(a))
  const done = [...board.upcoming.filter(isPastDay).reverse(), ...board.past]
  return {
    planned,
    reply: planned.filter((a) => a.kind === 'club' && !a.has_started && a.my_response === null),
    going: planned.filter(isOnCalendar),
    done,
  }
}
