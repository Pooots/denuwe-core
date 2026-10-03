import { useRef } from 'react'
import { Camera, Trash2, Trophy } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import type { ClubColor } from '@/types/club'
import type { TournamentMedia } from '@/services/tournamentService'
import type { TournamentResponse, TournamentSummary } from '@/types/tournament'
import { CLUB_BG, CLUB_GRADIENT } from '@/components/clubs/clubUi'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { cn } from '@/lib/utils'
import { tournamentService } from '@/services/tournamentService'

export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp'

const MAX_MB: Record<TournamentMedia, number> = { avatar: 5, banner: 8 }

export const MEDIA_HINT = 'Profile picture up to 5 MB, a square works best. Banner up to 8 MB, 1584 × 396 works best.'

export const mediaButton =
  'flex h-8 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[12px] font-semibold text-ink shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-60'

export type StagedMedia = { file: File | null; remove: boolean }

export const UNCHANGED: StagedMedia = { file: null, remove: false }

/** The reason a picked file can't be used, or null when it's fine. */
export function mediaProblem(type: TournamentMedia, file: File): string | null {
  if (!MEDIA_ACCEPT.split(',').includes(file.type)) return 'Use a JPG, PNG, GIF or WEBP photo.'
  if (file.size > MAX_MB[type] * 1024 * 1024) {
    return `${type === 'avatar' ? 'Profile pictures' : 'Banners'} can be up to ${MAX_MB[type]} MB.`
  }
  return null
}

/** Upload or remove the staged pictures. Returns the latest response, or null when nothing changed. */
export async function saveStagedMedia(
  id: number,
  staged: Record<TournamentMedia, StagedMedia>,
  current?: Pick<TournamentSummary, 'avatar_url' | 'banner_url'>,
): Promise<TournamentResponse | null> {
  let latest: TournamentResponse | null = null
  for (const type of ['avatar', 'banner'] as const) {
    const { file, remove } = staged[type]
    if (file) latest = await tournamentService.uploadMedia(id, type, file)
    else if (remove && current?.[type === 'avatar' ? 'avatar_url' : 'banner_url']) {
      latest = await tournamentService.removeMedia(id, type)
    }
  }
  return latest
}

export function TournamentBanner({
  src,
  color,
  className,
  children,
}: {
  src: string | null
  color: ClubColor | null
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-gradient-to-br',
        color ? CLUB_GRADIENT[color] : 'from-brand-navy to-brand-sky',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <div className="vibe-gradient absolute inset-0 opacity-30" />
          <Trophy className="absolute top-1/2 right-6 size-20 -translate-y-1/2 text-white/15 sm:size-24" />
        </>
      )}
      {children}
    </div>
  )
}

/** Hidden file input; `onPick` gets the chosen file and the input is cleared so the same file can be picked again. */
export function MediaInput({
  inputRef,
  label,
  onPick,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  label: string
  onPick: (file: File) => void
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={MEDIA_ACCEPT}
      className="hidden"
      aria-label={label}
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) onPick(file)
      }}
    />
  )
}

/** Banner and profile picture pickers for the create / edit form. Nothing uploads until the form is saved. */
export function TournamentMediaFields({
  color,
  avatar,
  banner,
  current,
  onChange,
  onError,
}: {
  color: ClubColor | null
  avatar: StagedMedia
  banner: StagedMedia
  current?: Pick<TournamentSummary, 'avatar_url' | 'banner_url'>
  onChange: (type: TournamentMedia, staged: StagedMedia) => void
  onError: (message: string | null) => void
}) {
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)
  const avatarPreview = useObjectUrl(avatar.file)
  const bannerPreview = useObjectUrl(banner.file)
  const shownAvatar = avatarPreview ?? (avatar.remove ? null : (current?.avatar_url ?? null))
  const shownBanner = bannerPreview ?? (banner.remove ? null : (current?.banner_url ?? null))

  const pick = (type: TournamentMedia) => (file: File) => {
    const problem = mediaProblem(type, file)
    onError(problem)
    if (!problem) onChange(type, { file, remove: false })
  }

  return (
    <section>
      <MediaInput inputRef={avatarInput} label="Upload tournament profile picture" onPick={pick('avatar')} />
      <MediaInput inputRef={bannerInput} label="Upload tournament banner" onPick={pick('banner')} />

      <TournamentBanner src={shownBanner} color={color} className="aspect-[4/1] rounded-xl">
        <div className="absolute top-2 right-2 flex gap-1.5">
          {shownBanner ? (
            <button
              type="button"
              onClick={() => onChange('banner', { file: null, remove: true })}
              className={cn(mediaButton, 'hover:text-danger')}
            >
              <Trash2 className="size-3.5" /> Remove
            </button>
          ) : null}
          <button type="button" onClick={() => bannerInput.current?.click()} className={mediaButton}>
            <Camera className="size-3.5" /> {shownBanner ? 'Change banner' : 'Upload banner'}
          </button>
        </div>
      </TournamentBanner>

      <div className="flex items-end gap-4 px-4">
        <div className="relative -mt-8 shrink-0">
          {shownAvatar ? (
            <img
              src={shownAvatar}
              alt=""
              className="size-20 rounded-2xl border-4 border-white bg-muted object-cover shadow-sm"
            />
          ) : (
            <span
              className={cn(
                'grid size-20 place-items-center rounded-2xl border-4 border-white text-white shadow-sm',
                color ? CLUB_BG[color] : 'brand-gradient',
              )}
            >
              <Trophy className="size-8" />
            </span>
          )}
          <button
            type="button"
            aria-label="Change tournament profile picture"
            onClick={() => avatarInput.current?.click()}
            className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border-2 border-white bg-brand-blue text-white shadow transition hover:bg-brand-blue/90"
          >
            <Camera className="size-4" />
          </button>
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <p className="text-[13px] font-semibold text-ink">Profile picture</p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] font-semibold">
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              className="text-brand-blue hover:underline"
            >
              {shownAvatar ? 'Change' : 'Upload'}
            </button>
            {shownAvatar ? (
              <button
                type="button"
                onClick={() => onChange('avatar', { file: null, remove: true })}
                className="text-ink/60 hover:text-danger"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{MEDIA_HINT}</p>
    </section>
  )
}
