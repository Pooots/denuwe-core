export type DiaryMood = 'great' | 'good' | 'okay' | 'low' | 'bad'

export type DiaryEntry = {
  id: number
  /** The day the entry is about, as YYYY-MM-DD. */
  entry_date: string
  mood: DiaryMood | null
  title: string | null
  body: string
  created_at: string | null
  updated_at: string | null
}

export type DiaryPage = {
  data: Array<DiaryEntry>
  next_cursor: string | null
  total: number
  /** Days that have at least one entry, newest first. */
  dates: Array<string>
}

export type DiaryInput = {
  entry_date: string
  mood: DiaryMood | null
  title: string
  body: string
}
