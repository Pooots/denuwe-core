import { useState } from 'react'
import { ChevronRight, Flame, PenLine, Users } from 'lucide-react'
import type { DiaryEntry } from '@/types/diary'
import type { DiaryOwner } from '@/components/profile/DiaryBook'
import { DiaryBook, audienceNote } from '@/components/profile/DiaryBook'
import { DiaryEntryDialog } from '@/components/profile/DiaryEntryDialog'
import { dayLabel, streak, today, useDiary } from '@/components/profile/diaryUi'
import { plural } from '@/components/clubs/clubUi'

function BookCover({ title, subtitle, onOpen }: { title: string; subtitle: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group mt-3 flex w-full items-center gap-3 rounded-xl border border-border p-2.5 text-left transition hover:border-brand-navy/30 hover:bg-muted/60"
    >
      <span className="diary-cover relative flex h-[68px] w-[52px] shrink-0 flex-col items-center justify-center rounded-l-sm rounded-r-md shadow-[2px_3px_8px_-2px_rgb(0_0_0/0.4)] transition group-hover:-rotate-3">
        <span aria-hidden className="absolute inset-y-0 left-1.5 w-px bg-white/20" />
        <span aria-hidden className="absolute -top-0.5 right-2 h-5 w-1.5 bg-brand-sky" />
        <span className="font-hand text-[16px] leading-none font-bold text-amber-200">Diary</span>
        <span aria-hidden className="mt-1 h-px w-6 bg-amber-200/50" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-ink">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-ink/40 transition group-hover:translate-x-0.5" />
    </button>
  )
}

/** Your diary (write as often as you like, for today or any past day), or a friend's diary to read. */
export function DiaryCard({ owner }: { owner?: DiaryOwner }) {
  const diary = useDiary('', owner?.id)
  const [editing, setEditing] = useState<DiaryEntry | 'new' | null>(null)
  const [reading, setReading] = useState(false)
  // Live here so the book reopens on the same page and search after the editor closes.
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState(0)

  const first = diary.data?.pages[0]
  const latest = first?.data[0]
  const total = first?.total ?? 0
  const days = streak(first?.dates ?? [])
  const wroteToday = first?.dates.includes(today()) ?? false

  /** Open the book on the newest entry; your own diary ends with a blank page. */
  const openBook = () => {
    setSearch('')
    setPos(owner ? 0 : 1)
    setReading(true)
  }

  return (
    <section className="rounded-xl border border-border bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-semibold text-ink">{owner ? `${owner.firstName}’s diary` : 'My diary'}</h2>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3" /> {audienceNote(owner)}
          </p>
        </div>
        {days > 0 ? (
          <span
            title={`${owner ? `${owner.firstName} has` : 'You’ve'} written ${plural(days, 'day')} in a row`}
            className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-700"
          >
            <Flame className="size-3.5" /> {plural(days, 'day')}
          </span>
        ) : null}
      </div>

      {owner ? null : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-full bg-brand-blue text-[13px] font-semibold text-white transition hover:bg-brand-blue/90"
        >
          <PenLine className="size-4" />
          {wroteToday ? 'Add another entry' : 'Write today’s entry'}
        </button>
      )}

      {diary.isLoading ? (
        <div className="mt-3 h-[90px] animate-pulse rounded-xl bg-muted" />
      ) : total > 0 || !owner ? (
        <BookCover
          title={owner ? `Open ${owner.firstName}’s diary` : 'Open my diary'}
          subtitle={
            latest
              ? `${plural(total, 'page')} · latest ${dayLabel(latest.entry_date)}`
              : 'Capture your thoughts, wins and memories.'
          }
          onOpen={openBook}
        />
      ) : (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {owner.firstName} hasn’t written any diary entries yet.
        </p>
      )}

      {reading && editing === null ? (
        <DiaryBook
          owner={owner}
          search={search}
          onSearch={(value) => {
            setSearch(value)
            setPos(0)
          }}
          pos={pos}
          onPos={setPos}
          onEdit={setEditing}
          onWrite={() => setEditing('new')}
          onClose={() => setReading(false)}
        />
      ) : null}
      {editing !== null && !owner ? (
        <DiaryEntryDialog entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </section>
  )
}
