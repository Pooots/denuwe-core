import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, Trash2, Users } from 'lucide-react'
import type { DiaryEntry, DiaryInput } from '@/types/diary'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { DIARY_KEY, MOODS, dayLabel, today } from '@/components/profile/diaryUi'
import { cn } from '@/lib/utils'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { diaryService } from '@/services/diaryService'

const MAX_BODY = 10000

const inputClass =
  'w-full rounded-lg border border-[#c4c9d4] bg-white px-3 text-[14px] text-ink placeholder:text-muted-foreground focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 focus:outline-none'

/** Write a new diary entry, or read, edit and delete an existing one. */
export function DiaryEntryDialog({ entry, onClose }: { entry: DiaryEntry | null; onClose: () => void }) {
  const qc = useQueryClient()
  const initial: DiaryInput = {
    entry_date: entry?.entry_date ?? today(),
    mood: entry?.mood ?? null,
    title: entry?.title ?? '',
    body: entry?.body ?? '',
  }
  const [form, setForm] = useState<DiaryInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<DiaryInput>) => {
    setForm((f) => ({ ...f, ...patch }))
    setError(null)
  }
  const dirty = (Object.keys(initial) as Array<keyof DiaryInput>).some((k) => initial[k] !== form[k])

  const refresh = () => void qc.invalidateQueries({ queryKey: DIARY_KEY })
  const fail = (err: unknown) => {
    const fieldErrors = apiValidationErrors(err)
    setError((fieldErrors && Object.values(fieldErrors)[0]?.[0]) || apiErrorMessage(err))
  }

  const save = useMutation({
    mutationFn: () => (entry ? diaryService.update(entry.id, form) : diaryService.create(form)),
    onSuccess: () => {
      refresh()
      toast(entry ? 'Diary entry updated.' : 'Diary entry saved.')
      onClose()
    },
    onError: fail,
  })

  const remove = useMutation({
    mutationFn: () => diaryService.remove(entry?.id ?? 0),
    onSuccess: () => {
      refresh()
      toast('Diary entry deleted.')
      onClose()
    },
    onError: fail,
  })

  const close = () => {
    if (dirty && !window.confirm('Discard your changes to this entry?')) return
    onClose()
  }

  const submit = () => {
    const problem = !form.entry_date
      ? 'Pick a date for this entry.'
      : form.entry_date > today()
        ? 'You can’t write an entry for a future date.'
        : !form.body.trim()
          ? 'Write something before saving.'
          : null
    setError(problem)
    if (!problem) save.mutate()
  }

  const busy = save.isPending || remove.isPending

  return (
    <Modal
      onClose={close}
      className="max-w-[640px]"
      title={
        <div>
          <h2 className="text-[17px] font-semibold text-ink">{entry ? 'Diary entry' : 'New diary entry'}</h2>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3" /> Visible to you and your society
          </p>
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
          <div className="flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="block text-xs font-semibold text-muted-foreground">Date</span>
              <input
                type="date"
                value={form.entry_date}
                max={today()}
                onChange={(e) => set({ entry_date: e.target.value })}
                className={cn(inputClass, 'mt-1 h-10 w-44')}
              />
            </label>
            <span className="pb-2.5 text-[13px] font-semibold text-ink/70">
              {form.entry_date ? dayLabel(form.entry_date) : null}
            </span>
          </div>

          <fieldset>
            <legend className="text-xs font-semibold text-muted-foreground">How are you feeling?</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {MOODS.map((mood) => {
                const active = form.mood === mood.value
                return (
                  <button
                    key={mood.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set({ mood: active ? null : mood.value })}
                    className={cn(
                      'flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition',
                      active
                        ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                        : 'border-[#c4c9d4] text-ink/70 hover:bg-muted',
                    )}
                  >
                    <span className="text-base leading-none">{mood.emoji}</span>
                    {mood.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Title</span>
            <input
              value={form.title}
              maxLength={120}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Give this entry a title (optional)"
              className={cn(inputClass, 'mt-1 h-10')}
            />
          </label>

          <label className="block">
            <span className="flex items-baseline justify-between text-xs font-semibold text-muted-foreground">
              <span>
                Entry <span className="text-danger">*</span>
              </span>
              <span className="font-normal">
                {form.body.length.toLocaleString()} / {MAX_BODY.toLocaleString()}
              </span>
            </span>
            <textarea
              autoFocus={!entry}
              value={form.body}
              maxLength={MAX_BODY}
              rows={10}
              onChange={(e) => set({ body: e.target.value })}
              placeholder="What happened today? What are you grateful for, proud of, or thinking about?"
              style={{ backgroundPosition: '0 0' }}
              className={cn(
                inputClass,
                'diary-paper diary-lines mt-1 min-h-[224px] resize-y px-4 pt-[5px] pb-2.5 font-brand text-[15px] leading-7',
              )}
            />
          </label>
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          {entry ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Delete this diary entry? This can’t be undone.')) remove.mutate()
              }}
              className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-60"
            >
              {remove.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete
            </button>
          ) : null}
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-danger">{error}</p>
          <button
            type="button"
            onClick={close}
            className="h-9 rounded-full px-4 text-[13px] font-semibold text-ink/70 transition hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || (entry !== null && !dirty)}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-60"
          >
            {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {entry ? 'Save changes' : 'Save entry'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
