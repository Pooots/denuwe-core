import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import type { ClubSummary } from '@/types/club'
import { ClubIcon, refreshClubs } from '@/components/clubs/clubUi'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { cn } from '@/lib/utils'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { clubService } from '@/services/clubService'

const inputClass =
  'w-full rounded-lg border border-[#c4c9d4] bg-white px-3 text-[14px] text-ink placeholder:text-muted-foreground focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 focus:outline-none'

export function toDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function CreateActivityDialog({ club, onClose }: { club: ClubSummary; onClose: () => void }) {
  const qc = useQueryClient()
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => toDateInput(tomorrow))
  const [time, setTime] = useState('18:00')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const startsAt = (): Date | null => {
    if (!date || !time) return null
    const value = new Date(`${date}T${time}`)
    return Number.isNaN(value.getTime()) ? null : value
  }

  const create = useMutation({
    mutationFn: (when: Date) =>
      clubService.addActivity(club.id, { title, starts_at: when.toISOString(), location, description }),
    onSuccess: (activity) => {
      refreshClubs(qc)
      toast(`${activity.title} added to ${club.name}.`)
      onClose()
    },
    onError: (err) => {
      const fieldErrors = apiValidationErrors(err)
      setError((fieldErrors && Object.values(fieldErrors)[0]?.[0]) || apiErrorMessage(err))
    },
  })

  const submit = () => {
    const when = startsAt()
    const problem = !title.trim()
      ? 'Give the activity a name.'
      : !when
        ? 'Pick a date and time.'
        : when.getTime() <= Date.now()
          ? 'Pick a date and time in the future.'
          : null
    setError(problem)
    if (!problem && when) create.mutate(when)
  }

  return (
    <Modal
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <ClubIcon
            color={club.color}
            type={club.type}
            src={club.avatar_url}
            className="size-10 rounded-lg"
            iconClassName="size-5"
          />
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-ink">Add activity</h2>
            <p className="truncate text-xs text-muted-foreground">{club.name}</p>
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
              Activity name <span className="text-danger">*</span>
            </span>
            <input
              autoFocus
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Friday chess social"
              className={cn(inputClass, 'mt-1 h-10')}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">
                Date <span className="text-danger">*</span>
              </span>
              <input
                type="date"
                value={date}
                min={toDateInput(new Date())}
                onChange={(e) => setDate(e.target.value)}
                className={cn(inputClass, 'mt-1 h-10')}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">
                Time <span className="text-danger">*</span>
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={cn(inputClass, 'mt-1 h-10')}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Location</span>
            <input
              value={location}
              maxLength={120}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where are you meeting?"
              className={cn(inputClass, 'mt-1 h-10')}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Details</span>
            <textarea
              value={description}
              maxLength={2000}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should people bring or know?"
              className={cn(inputClass, 'mt-1 resize-none py-2')}
            />
          </label>
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-danger">{error}</p>
          <button
            type="submit"
            disabled={create.isPending}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-70"
          >
            {create.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Add activity
          </button>
        </div>
      </form>
    </Modal>
  )
}
