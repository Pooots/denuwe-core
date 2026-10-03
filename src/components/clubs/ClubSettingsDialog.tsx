import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Camera, Info, LoaderCircle, Trash2 } from 'lucide-react'
import type { ClubMedia } from '@/services/clubService'
import type { Club, ClubDetail } from '@/types/club'
import { ClubDetailsFields, clubFormPayload, clubFormProblem, useClubForm } from '@/components/clubs/ClubForm'
import { CLUB_GRADIENT, CLUB_TYPE_LABEL, ClubIcon, clubLink, refreshClubs } from '@/components/clubs/clubUi'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { cn } from '@/lib/utils'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { clubService } from '@/services/clubService'

const MAX_MB: Record<ClubMedia, number> = { avatar: 5, banner: 8 }

type Staged = { file: File | null; remove: boolean }

export function ClubSettingsDialog({ club, onClose }: { club: Club; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const form = useClubForm(club)
  const { state } = form
  const [error, setError] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<Staged>({ file: null, remove: false })
  const [banner, setBanner] = useState<Staged>({ file: null, remove: false })
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)
  const avatarPreview = useObjectUrl(avatar.file)
  const bannerPreview = useObjectUrl(banner.file)

  const shownAvatar = avatarPreview ?? (avatar.remove ? null : club.avatar_url)
  const shownBanner = bannerPreview ?? (banner.remove ? null : club.banner_url)
  const otherMembers = club.members_count - 1
  const switchingToPaid = club.is_free && state.membership === 'paid'
  const switchingToFree = !club.is_free && state.membership === 'free'

  const pick = (type: ClubMedia, file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    if (file.size > MAX_MB[type] * 1024 * 1024) {
      setError(`${type === 'avatar' ? 'Profile pictures' : 'Banners'} can be up to ${MAX_MB[type]} MB.`)
      return
    }
    setError(null)
    ;(type === 'avatar' ? setAvatar : setBanner)({ file, remove: false })
  }

  const save = useMutation({
    mutationFn: async () => {
      const updated = await clubService.update(club.id, clubFormPayload(state))
      const media: Array<[ClubMedia, Staged, string | null]> = [
        ['avatar', avatar, club.avatar_url],
        ['banner', banner, club.banner_url],
      ]
      for (const [type, staged, current] of media) {
        if (staged.file) await clubService.uploadMedia(club.id, type, staged.file)
        else if (staged.remove && current) await clubService.removeMedia(club.id, type)
      }
      return updated
    },
    onSuccess: async (updated) => {
      if (updated.slug !== club.slug || updated.type !== club.type) {
        const detail = qc.getQueryData<ClubDetail>(['club', club.slug])
        if (detail) qc.setQueryData<ClubDetail>(['club', updated.slug], { ...detail, club: updated })
        await navigate({ ...clubLink(updated), replace: true })
        qc.removeQueries({ queryKey: ['club', club.slug], exact: true })
      }
      refreshClubs(qc)
      toast(`${CLUB_TYPE_LABEL[state.type]} settings saved.`)
      onClose()
    },
    onError: (err) => {
      refreshClubs(qc)
      const fieldErrors = apiValidationErrors(err)
      setError((fieldErrors && Object.values(fieldErrors)[0]?.[0]) || apiErrorMessage(err))
    },
  })

  const submit = () => {
    const problem = clubFormProblem(state)
    setError(problem)
    if (!problem) save.mutate()
  }

  const mediaButton =
    'flex h-8 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[12px] font-semibold text-ink shadow-sm backdrop-blur transition hover:bg-white'

  return (
    <Modal
      onClose={onClose}
      className="max-w-[640px]"
      title={
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">{CLUB_TYPE_LABEL[club.type]} settings</h2>
          <p className="truncate text-xs text-muted-foreground">{club.name}</p>
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
        <input
          ref={avatarInput}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          aria-label="Upload profile picture"
          onChange={(e) => {
            pick('avatar', e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <input
          ref={bannerInput}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          aria-label="Upload banner"
          onChange={(e) => {
            pick('banner', e.target.files?.[0])
            e.target.value = ''
          }}
        />

        <div className="max-h-[70dvh] space-y-5 overflow-y-auto px-5 pb-5">
          <section>
            <div
              className={cn(
                'relative aspect-[4/1] overflow-hidden rounded-xl bg-gradient-to-br',
                CLUB_GRADIENT[state.color],
              )}
            >
              {shownBanner ? (
                <img src={shownBanner} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                <div className="vibe-gradient absolute inset-0 opacity-30" />
              )}
              <div className="absolute top-2 right-2 flex gap-1.5">
                {shownBanner ? (
                  <button
                    type="button"
                    onClick={() => setBanner({ file: null, remove: true })}
                    className={cn(mediaButton, 'hover:text-danger')}
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                ) : null}
                <button type="button" onClick={() => bannerInput.current?.click()} className={mediaButton}>
                  <Camera className="size-3.5" /> {shownBanner ? 'Change banner' : 'Upload banner'}
                </button>
              </div>
            </div>

            <div className="flex items-end gap-4 px-4">
              <div className="relative -mt-10 shrink-0">
                <ClubIcon
                  color={state.color}
                  type={state.type}
                  src={shownAvatar}
                  className="size-24 rounded-2xl border-4 border-white shadow-sm"
                  iconClassName="size-10"
                />
                <button
                  type="button"
                  aria-label="Change profile picture"
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
                      onClick={() => setAvatar({ file: null, remove: true })}
                      className="text-ink/60 hover:text-danger"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Profile picture up to 5 MB, a square works best. Banner up to 8 MB, 1584 × 396 works best.
            </p>
          </section>

          <ClubDetailsFields
            form={form}
            onChange={() => setError(null)}
            privacyNote={
              club.visibility === 'private' && state.visibility === 'public' && club.requests_count > 0 ? (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-ink/80">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
                  {club.requests_count === 1
                    ? 'The person waiting to join will be let in automatically.'
                    : `The ${club.requests_count} people waiting to join will be let in automatically.`}
                </p>
              ) : club.visibility === 'public' && state.visibility === 'private' ? (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-brand-blue/5 px-3 py-2 text-xs text-ink/80">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-brand-blue" />
                  Current members stay. From now on, only members can see the wall, members, activities and tournaments,
                  and new people need your approval to join.
                </p>
              ) : null
            }
            membershipNote={
              otherMembers > 0 && (switchingToPaid || switchingToFree) ? (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-ink/80">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
                  {switchingToPaid
                    ? `Your ${otherMembers === 1 ? 'existing member' : `${otherMembers} existing members`} will be marked as fee pending until you mark them paid.`
                    : `Fee tracking for your ${otherMembers === 1 ? 'existing member' : `${otherMembers} existing members`} will be cleared.`}
                </p>
              ) : null
            }
          />
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-danger">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-full px-4 text-[13px] font-semibold text-ink/70 hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-70"
          >
            {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  )
}
