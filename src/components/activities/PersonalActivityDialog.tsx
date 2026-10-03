import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, CalendarHeart, LoaderCircle, Lock } from 'lucide-react'
import type { ClubSummary, PersonalActivity } from '@/types/club'
import { ACTIVITY_BOARD_KEY } from '@/components/clubs/clubUi'
import { toDateInput } from '@/components/clubs/CreateActivityDialog'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { cn } from '@/lib/utils'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { clubService } from '@/services/clubService'

const inputClass =
  'w-full rounded-lg border border-[#c4c9d4] bg-white px-3 text-[14px] text-ink placeholder:text-muted-foreground focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 focus:outline-none disabled:bg-muted disabled:text-ink/40'

function toTimeInput(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

/**
 * Add something to your own schedule, or edit one you added. It can be for one of your clubs or communities, or
 * personal; either way only you see it and you're going without having to reply.
 */
export function PersonalActivityDialog({
  activity,
  initialDate,
  clubs,
  onClose,
}: {
  activity?: PersonalActivity
  /** "YYYY-MM-DD" to start on, e.g. the day picked on the calendar. */
  initialDate?: string
  /** Clubs and communities you're in. */
  clubs: Array<ClubSummary>
  onClose: () => void
}) {
  const qc = useQueryClient()
  const start = activity ? new Date(activity.starts_at) : null
  const [title, setTitle] = useState(activity?.title ?? '')
  const [clubId, setClubId] = useState<number | null>(activity?.club?.id ?? null)
  const [isMeeting, setIsMeeting] = useState(activity?.is_meeting ?? false)
  const [meetingUrl, setMeetingUrl] = useState(activity?.meeting_url ?? '')
  const [date, setDate] = useState(() => (start ? toDateInput(start) : (initialDate ?? toDateInput(new Date()))))
  const [allDay, setAllDay] = useState(activity?.all_day ?? false)
  const [time, setTime] = useState(start && !activity?.all_day ? toTimeInput(start) : '09:00')
  const [endTime, setEndTime] = useState(activity?.ends_at ? toTimeInput(new Date(activity.ends_at)) : '')
  const [location, setLocation] = useState(activity?.location ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [error, setError] = useState<string | null>(null)

  /** Keeps a club you've since left on an activity you're editing. */
  const choices = activity?.club && !clubs.some((c) => c.id === activity.club?.id) ? [...clubs, activity.club] : clubs
  const groups = [
    { label: 'Clubs', items: choices.filter((c) => c.type === 'club') },
    { label: 'Communities', items: choices.filter((c) => c.type === 'community') },
  ].filter((group) => group.items.length > 0)

  const save = useMutation({
    mutationFn: ({ startsAt, endsAt }: { startsAt: Date; endsAt: Date | null }) => {
      const payload = {
        title,
        club_id: clubId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        all_day: allDay,
        location,
        is_meeting: isMeeting,
        meeting_url: isMeeting ? meetingUrl.trim() : '',
        description,
      }
      return activity
        ? clubService.updatePersonalActivity(activity.id, payload)
        : clubService.addPersonalActivity(payload)
    },
    onSuccess: ({ message }) => {
      void qc.invalidateQueries({ queryKey: ACTIVITY_BOARD_KEY })
      toast(message)
      onClose()
    },
    onError: (err) => {
      const fieldErrors = apiValidationErrors(err)
      setError((fieldErrors && Object.values(fieldErrors)[0]?.[0]) || apiErrorMessage(err))
    },
  })

  const submit = () => {
    const at = (clock: string) => {
      const value = new Date(`${date}T${clock}`)
      return Number.isNaN(value.getTime()) ? null : value
    }
    const startsAt = date ? at(allDay ? '00:00' : time) : null
    const endsAt = !allDay && endTime ? at(endTime) : null
    const problem = !title.trim()
      ? 'Give the activity a name.'
      : !startsAt
        ? allDay
          ? 'Pick a date.'
          : 'Pick a date and time.'
        : endsAt && endsAt <= startsAt
          ? 'The end time must be after the start time.'
          : isMeeting && meetingUrl.trim() && !/^https?:\/\/\S+$/i.test(meetingUrl.trim())
            ? 'The meeting link should start with https://'
            : null
    setError(problem)
    if (!problem && startsAt) save.mutate({ startsAt, endsAt })
  }

  return (
    <Modal
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-violet-500 text-white">
            <CalendarHeart className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-ink">
              {activity ? 'Edit personal activity' : 'Add to my schedule'}
            </h2>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" /> Only you can see this
            </p>
          </div>
        </div>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="space-y-4 px-5 pb-5">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">
              What are you doing? <span className="text-danger">*</span>
            </span>
            <input
              autoFocus
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning run, Board meeting, Dentist"
              className={cn(inputClass, 'mt-1 h-10')}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">For</span>
            <select
              value={clubId ?? ''}
              onChange={(e) => setClubId(e.target.value ? Number(e.target.value) : null)}
              className={cn(inputClass, 'mt-1 h-10')}
            >
              <option value="">Personal</option>
              {groups.map(({ label, items }) => (
                <optgroup key={label} label={label}>
                  {items.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">
                Date <span className="text-danger">*</span>
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cn(inputClass, 'mt-1 h-10')}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Starts</span>
              <input
                type="time"
                value={allDay ? '' : time}
                disabled={allDay}
                onChange={(e) => setTime(e.target.value)}
                className={cn(inputClass, 'mt-1 h-10')}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Ends</span>
              <input
                type="time"
                value={allDay ? '' : endTime}
                disabled={allDay}
                onChange={(e) => setEndTime(e.target.value)}
                className={cn(inputClass, 'mt-1 h-10')}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="size-4 accent-brand-blue"
              />
              All day
            </label>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={isMeeting}
                onChange={(e) => setIsMeeting(e.target.checked)}
                className="size-4 accent-brand-blue"
              />
              It’s a meeting
            </label>
          </div>

          {isMeeting ? (
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Meeting link</span>
              <input
                type="url"
                inputMode="url"
                value={meetingUrl}
                maxLength={500}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/… or a Zoom link"
                className={cn(inputClass, 'mt-1 h-10')}
              />
            </label>
          ) : null}

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Location</span>
            <input
              value={location}
              maxLength={120}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where?"
              className={cn(inputClass, 'mt-1 h-10')}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Notes</span>
            <textarea
              value={description}
              maxLength={2000}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anything to remember?"
              className={cn(inputClass, 'mt-1 resize-none py-2')}
            />
          </label>
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          {error ? (
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-danger">{error}</p>
          ) : (
            <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarCheck className="size-3.5 shrink-0 text-emerald-600" />
              <span className="truncate">You’re going. No reply needed.</span>
            </p>
          )}
          <button
            type="submit"
            disabled={save.isPending}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-70"
          >
            {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {activity ? 'Save' : 'Add to schedule'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
