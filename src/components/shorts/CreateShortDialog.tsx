import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { ArrowLeft, Clapperboard, ImageIcon, LoaderCircle, RefreshCw, Shield, Upload } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AuthUser } from '@/types/auth'
import type { CreateShortInput, Short, ShortAudience, ShortKind } from '@/types/short'
import { SHORT_MAX_BYTES, SHORT_MAX_IMAGE_BYTES, SHORT_MAX_SECONDS } from '@/types/short'
import { CLUBS_KEY, CLUB_TYPE_LABEL, ClubIcon } from '@/components/clubs/clubUi'
import { Avatar } from '@/components/feed/Avatar'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { prependShort } from '@/components/shorts/shortsCache'
import { AUDIENCE_META, formatDuration } from '@/components/shorts/shortsUi'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { cn } from '@/lib/utils'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { clubService } from '@/services/clubService'
import { shortService } from '@/services/shortService'

type MediaInfo = { width: number; height: number; duration: number | null; poster: Blob | null }

const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-m4v'
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

const KINDS: Record<ShortKind, { label: string; noun: string; hint: string; icon: LucideIcon; cover: string }> = {
  video: {
    label: 'Video',
    noun: 'video',
    hint: `Up to ${SHORT_MAX_SECONDS} seconds · MP4, MOV or WebM · 40 MB`,
    icon: Clapperboard,
    cover: 'brand-gradient',
  },
  image: {
    label: 'Photo',
    noun: 'photo',
    hint: 'One photo · JPG, PNG, WebP or GIF · 10 MB',
    icon: ImageIcon,
    cover: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-orange-400',
  },
}

/** Length, size and a cover frame (about a second in), read in the browser before uploading. */
function inspectVideo(file: File): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let settled = false
    const finish = (result: MediaInfo | Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      URL.revokeObjectURL(url)
      if (result instanceof Error) reject(result)
      else resolve(result)
    }
    const info = (poster: Blob | null): MediaInfo => ({
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      poster,
    })
    // Some browsers never fire `seeked` for odd files; post without a cover rather than hang.
    const timer = window.setTimeout(() => {
      if (Number.isFinite(video.duration) && video.duration > 0) finish(info(null))
      else finish(new Error('We couldn’t read that video. Try an MP4 file.'))
    }, 8000)

    // Browser-recorded WebM files report an infinite length until you seek past the end.
    let findingLength = false
    const seekCover = () => {
      video.currentTime = Math.min(1, video.duration / 3)
    }

    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.onerror = () => finish(new Error('We couldn’t read that video. Try an MP4 file.'))
    video.onloadedmetadata = () => {
      if (video.duration === Infinity) {
        findingLength = true
        video.currentTime = 1e7
        return
      }
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        finish(new Error('We couldn’t tell how long that video is. Try an MP4 file.'))
        return
      }
      seekCover()
    }
    video.ondurationchange = () => {
      if (findingLength && Number.isFinite(video.duration)) {
        findingLength = false
        seekCover()
      }
    }
    video.onseeked = () => {
      if (findingLength) return
      const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight, 1))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        finish(info(null))
        return
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => finish(info(blob)), 'image/jpeg', 0.82)
    }
    video.src = url
  })
}

function inspectImage(file: File): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight, duration: null, poster: null })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('We couldn’t read that photo. Try a JPG or PNG.'))
    }
    image.src = url
  })
}

function KindCard({ kind, onClick }: { kind: ShortKind; onClick: () => void }) {
  const meta = KINDS[kind]
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl border border-border p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-lg sm:flex-col sm:items-center sm:gap-3 sm:px-5 sm:py-8 sm:text-center"
    >
      <span
        className={cn(
          'grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-lg transition group-hover:scale-105 sm:size-16',
          meta.cover,
        )}
      >
        <Icon className="size-7" />
      </span>
      <span className="min-w-0">
        <span className="block text-[16px] font-semibold text-ink">{meta.label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{meta.hint}</span>
      </span>
    </button>
  )
}

function AudienceOption({
  selected,
  label,
  hint,
  icon,
  onClick,
}: {
  selected: boolean
  label: string
  hint: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors sm:flex-col sm:items-start sm:gap-2',
        selected ? 'border-brand-blue bg-brand-blue/5 ring-1 ring-brand-blue' : 'border-border hover:bg-muted',
      )}
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          selected ? 'bg-brand-blue text-white' : 'bg-muted text-ink/70',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-ink">{label}</span>
        <span className="block text-[11px] leading-snug text-muted-foreground">{hint}</span>
      </span>
    </button>
  )
}

export function CreateShortDialog({
  user,
  onClose,
  onCreated,
  placeholder,
}: {
  user: AuthUser
  onClose: () => void
  onCreated?: (short: Short) => void
  /** Caption hint, e.g. from a short idea. */
  placeholder?: string
}) {
  const qc = useQueryClient()
  const videoInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [kind, setKind] = useState<ShortKind | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [caption, setCaption] = useState('')
  const [audience, setAudience] = useState<ShortAudience>('everyone')
  const [clubId, setClubId] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const preview = useObjectUrl(file)

  const clubs = useQuery({ queryKey: [...CLUBS_KEY, 'mine'], queryFn: () => clubService.mine() })
  const myClubs = clubs.data ?? []
  const club = myClubs.find((c) => c.id === clubId) ?? null

  useEffect(() => () => abortRef.current?.abort(), [])

  const browse = (which: ShortKind) => (which === 'video' ? videoInputRef : imageInputRef).current?.click()

  const choose = (next: ShortKind) => {
    if (next !== kind) {
      setFile(null)
      setInfo(null)
      setError(null)
    }
    setKind(next)
    browse(next)
  }

  const backToChoice = () => {
    setKind(null)
    setFile(null)
    setInfo(null)
    setError(null)
  }

  const pickVideo = async (next: File) => {
    if (!next.type.startsWith('video/')) {
      setError('Choose a video file (MP4, MOV or WebM).')
      return
    }
    if (next.size > SHORT_MAX_BYTES) {
      setError(`That video is ${(next.size / 1024 / 1024).toFixed(0)} MB. Videos can be up to 40 MB.`)
      return
    }
    const read = await inspectVideo(next)
    if ((read.duration ?? 0) > SHORT_MAX_SECONDS + 0.5) {
      setError(
        `That video is ${formatDuration(read.duration ?? 0)} long. Shorts can be up to ${SHORT_MAX_SECONDS} seconds.`,
      )
      return
    }
    setFile(next)
    setInfo(read)
  }

  const pickImage = async (next: File) => {
    if (!IMAGE_ACCEPT.split(',').includes(next.type)) {
      setError('Choose a photo (JPG, PNG, WebP or GIF).')
      return
    }
    if (next.size > SHORT_MAX_IMAGE_BYTES) {
      setError(`That photo is ${(next.size / 1024 / 1024).toFixed(0)} MB. Photos can be up to 10 MB.`)
      return
    }
    setFile(next)
    setInfo(await inspectImage(next))
  }

  const pick = async (next: File | undefined) => {
    if (!next || !kind) return
    setError(null)
    setReading(true)
    try {
      await (kind === 'video' ? pickVideo(next) : pickImage(next))
    } catch (err) {
      setError(err instanceof Error ? err.message : `We couldn’t read that ${KINDS[kind].noun}.`)
    } finally {
      setReading(false)
    }
  }

  const create = useMutation({
    mutationFn: () => {
      if (!kind || !file || !info) throw new Error('Choose a video or a photo first.')
      const controller = new AbortController()
      abortRef.current = controller
      setProgress(0)
      const common = {
        caption,
        audience,
        clubId,
        width: info.width || null,
        height: info.height || null,
      }
      const input: CreateShortInput =
        kind === 'video'
          ? { ...common, kind, video: file, poster: info.poster, duration: info.duration ?? 0 }
          : { ...common, kind, image: file }
      return shortService.create(input, { onProgress: setProgress, signal: controller.signal })
    },
    onSuccess: ({ message, short }) => {
      prependShort(qc, short)
      toast(message)
      onCreated?.(short)
      onClose()
    },
    onError: (err) => {
      if (isAxiosError(err) && err.code === 'ERR_CANCELED') return
      if (isAxiosError(err) && err.response?.status === 413) {
        setError(`That ${kind ? KINDS[kind].noun : 'file'} is too big for the server. Try a smaller one.`)
        return
      }
      const fieldErrors = apiValidationErrors(err)
      setError((fieldErrors && Object.values(fieldErrors)[0]?.[0]) || apiErrorMessage(err))
    },
    onSettled: () => {
      abortRef.current = null
    },
  })

  const uploading = create.isPending
  const needsClub = audience === 'club' && !club
  const canPost = Boolean(file && info) && !needsClub && !uploading && !reading
  const meta = kind ? KINDS[kind] : null
  const KindIcon = meta?.icon ?? Clapperboard
  const wide = Boolean(info && info.width > info.height)

  const close = () => {
    if (!uploading) onClose()
  }

  const fileInput = (which: ShortKind) => (
    <input
      ref={which === 'video' ? videoInputRef : imageInputRef}
      type="file"
      accept={which === 'video' ? VIDEO_ACCEPT : IMAGE_ACCEPT}
      aria-label={`Choose a ${KINDS[which].noun}`}
      className="hidden"
      onChange={(e) => {
        void pick(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  return (
    <Modal
      onClose={close}
      className={kind ? 'max-w-[720px]' : 'max-w-[560px]'}
      title={
        <div className="flex items-center gap-3">
          {kind && !uploading ? (
            <button
              type="button"
              onClick={backToChoice}
              aria-label="Back to video or photo"
              className="-ml-2 grid size-9 shrink-0 place-items-center rounded-full text-ink/70 transition hover:bg-muted"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : null}
          <Avatar name={user.name} src={user.avatar_url} className="size-10 text-[13px]" />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold text-ink">
              {meta ? `Create a ${meta.noun} short` : 'Create a short'}
            </p>
            <p className="text-xs text-muted-foreground">{meta ? meta.hint : 'Share a quick video or a photo'}</p>
          </div>
        </div>
      }
    >
      {fileInput('video')}
      {fileInput('image')}

      {kind === null ? (
        <div className="px-5 pt-2 pb-6">
          <p className="text-[14px] font-semibold text-ink">What do you want to share?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <KindCard kind="video" onClick={() => choose('video')} />
            <KindCard kind="image" onClick={() => choose('image')} />
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canPost) create.mutate()
          }}
        >
          <div className="grid gap-4 px-5 pt-2 pb-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-5">
            <div className="mx-auto w-[180px] sm:w-full">
              {preview && info ? (
                <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-black">
                  {kind === 'video' ? (
                    <video
                      src={preview}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className={cn('size-full', wide ? 'object-contain' : 'object-cover')}
                    />
                  ) : (
                    <>
                      <img
                        src={preview}
                        alt=""
                        aria-hidden
                        className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-xl"
                      />
                      <img src={preview} alt="Selected" className="relative size-full object-contain" />
                    </>
                  )}
                  <span className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {info.duration !== null ? formatDuration(info.duration) : 'Photo'}
                  </span>
                  {uploading ? null : (
                    <button
                      type="button"
                      onClick={() => browse(kind)}
                      className="absolute inset-x-2 bottom-2 flex h-8 items-center justify-center gap-1.5 rounded-full bg-white/90 text-xs font-semibold text-ink backdrop-blur transition hover:bg-white"
                    >
                      <RefreshCw className="size-3.5" /> Change {meta?.noun}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => browse(kind)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    void pick(e.dataTransfer.files[0])
                  }}
                  disabled={reading}
                  className={cn(
                    'flex aspect-[9/16] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 text-center transition',
                    dragging
                      ? 'border-brand-blue bg-brand-blue/5'
                      : 'border-[#c4c9d4] bg-muted/50 hover:border-brand-blue',
                  )}
                >
                  {reading ? (
                    <LoaderCircle className="size-8 animate-spin text-brand-blue" />
                  ) : (
                    <span
                      className={cn('grid size-14 place-items-center rounded-full text-white shadow-lg', meta?.cover)}
                    >
                      <KindIcon className="size-6" />
                    </span>
                  )}
                  <span className="text-[14px] font-semibold text-ink">
                    {reading ? `Reading ${meta?.noun}…` : `Select a ${meta?.noun}`}
                  </span>
                  <span className="text-xs text-muted-foreground">or drag it here</span>
                  <span className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-blue px-4 text-xs font-semibold text-white">
                    <Upload className="size-3.5" /> Upload
                  </span>
                </button>
              )}
            </div>

            <div className="min-w-0 space-y-4">
              <label className="block">
                <span className="text-[13px] font-semibold text-ink">Caption</span>
                <textarea
                  value={caption}
                  maxLength={500}
                  rows={4}
                  disabled={uploading}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={placeholder ?? 'What’s happening in this short?'}
                  className="mt-1.5 w-full resize-none rounded-xl border border-[#c4c9d4] px-3 py-2 text-[14px] leading-relaxed text-ink placeholder:text-muted-foreground focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none disabled:opacity-60"
                />
                <span className="block text-right text-[11px] text-muted-foreground">{caption.length}/500</span>
              </label>

              <div role="radiogroup" aria-label="Who can see your short">
                <p className="text-[13px] font-semibold text-ink">Who can see it?</p>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                  {(['everyone', 'society'] as const).map((value) => {
                    const Icon = AUDIENCE_META[value].icon
                    return (
                      <AudienceOption
                        key={value}
                        selected={audience === value}
                        label={AUDIENCE_META[value].label}
                        hint={AUDIENCE_META[value].hint}
                        icon={<Icon className="size-4" />}
                        onClick={() => {
                          setAudience(value)
                          setError(null)
                        }}
                      />
                    )
                  })}
                  <AudienceOption
                    selected={audience === 'club'}
                    label="A club"
                    hint="Club or community"
                    icon={
                      club ? (
                        <ClubIcon
                          color={club.color}
                          type={club.type}
                          src={club.avatar_url}
                          className="size-9 rounded-full"
                        />
                      ) : (
                        <Shield className="size-4" />
                      )
                    }
                    onClick={() => {
                      setAudience('club')
                      setError(null)
                      if (!clubId && myClubs.length > 0) setClubId(myClubs[0].id)
                    }}
                  />
                </div>

                {audience === 'club' ? (
                  myClubs.length > 0 ? (
                    <label className="mt-2 block">
                      <span className="sr-only">Club or community</span>
                      <select
                        value={clubId ?? ''}
                        disabled={uploading}
                        onChange={(e) => setClubId(Number(e.target.value) || null)}
                        className="h-10 w-full rounded-xl border border-[#c4c9d4] bg-white px-3 text-[14px] text-ink focus:border-brand-blue focus:outline-none"
                      >
                        {myClubs.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} · {CLUB_TYPE_LABEL[c.type]}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        Only members of {club?.name ?? 'this club'} will see it.
                      </span>
                    </label>
                  ) : clubs.isLoading ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <LoaderCircle className="size-3.5 animate-spin" /> Loading your clubs…
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      You haven’t joined a club or community yet.{' '}
                      <Link to="/clubs" className="font-semibold text-brand-blue hover:underline">
                        Explore clubs
                      </Link>
                    </p>
                  )
                ) : null}
              </div>
            </div>
          </div>

          {uploading ? (
            <div className="px-5 pb-2">
              <div
                role="progressbar"
                aria-label="Uploading"
                aria-valuenow={Math.round(progress * 100)}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="brand-gradient h-full rounded-full transition-[width] duration-200"
                  style={{ width: `${Math.max(4, progress * 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2 border-t border-border px-5 py-3">
            <p role={error ? 'alert' : undefined} className="min-w-0 flex-1 text-xs text-danger">
              {error ??
                (uploading ? (
                  <span className="text-muted-foreground">
                    {progress >= 1 ? 'Processing…' : `Uploading ${Math.round(progress * 100)}%`}
                  </span>
                ) : null)}
            </p>
            {uploading ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="h-9 rounded-full px-4 text-[13px] font-semibold text-ink/70 transition hover:bg-muted"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!canPost}
              className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:bg-[#e3e6ee] disabled:text-muted-foreground"
            >
              {uploading ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Post short
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
