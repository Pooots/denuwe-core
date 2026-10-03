import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AuthUser } from '@/types/auth'
import { Avatar } from '@/components/feed/Avatar'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { ProfileBackdrop } from '@/components/profile/ProfileBackdrop'
import { BACKGROUND_EFFECTS, BACKGROUND_TEMPLATES, DEFAULT_BACKGROUND_EFFECT } from '@/components/profile/backgrounds'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { cn } from '@/lib/utils'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { profileService } from '@/services/profileService'

const MAX_MB = 8

function Option({
  label,
  selected,
  onSelect,
  disabled,
  children,
}: {
  label: string
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className="group min-w-0 text-left disabled:opacity-50"
    >
      <span
        className={cn(
          'relative block aspect-[4/3] overflow-hidden rounded-lg border border-border bg-background transition',
          selected ? 'ring-2 ring-brand-blue ring-offset-2' : 'group-hover:border-brand-blue/50',
        )}
      >
        {children}
        {selected ? (
          <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-brand-blue text-white shadow-sm">
            <Check className="size-3" strokeWidth={3} />
          </span>
        ) : null}
      </span>
      <span className={cn('mt-1 block truncate text-[11px]', selected ? 'font-semibold text-ink' : 'text-muted-foreground')}>
        {label}
      </span>
    </button>
  )
}

/** A small mock of the profile page, so the background can be judged with the cards on top of it. */
function Preview({ user, background, url, effect }: { user: AuthUser; background: string; url: string | null; effect: string }) {
  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border bg-background sm:aspect-[21/9]">
      <ProfileBackdrop background={background} url={url} effect={effect} className="absolute inset-0" />
      <div className="absolute inset-x-[8%] top-[9%] bottom-0 flex gap-[3%]">
        <div className="flex-[3] overflow-hidden rounded-t-lg border border-border bg-white shadow-sm">
          <div className="brand-gradient relative h-[30%]">
            {user.banner_url ? <img src={user.banner_url} alt="" className="absolute inset-0 size-full object-cover" /> : null}
          </div>
          <div className="px-[5%]">
            <div className="-mt-[8%] aspect-square w-[17%] rounded-full border-2 border-white bg-white">
              <Avatar name={user.name} src={user.avatar_url} className="size-full text-[10px]" />
            </div>
            <div className="mt-2 h-2 w-2/5 rounded-full bg-ink/70" />
            <div className="mt-1.5 h-1.5 w-1/4 rounded-full bg-ink/20" />
            <div className="mt-1.5 h-1.5 w-1/3 rounded-full bg-ink/15" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-[6%]">
          <div className="h-[34%] rounded-lg border border-border bg-white p-[8%] shadow-sm">
            <div className="h-1.5 w-2/3 rounded-full bg-ink/50" />
            <div className="mt-1.5 h-3 w-full rounded-full bg-brand-blue/80" />
          </div>
          <div className="flex-1 rounded-t-lg border border-border bg-white p-[8%] shadow-sm">
            <div className="h-1.5 w-1/2 rounded-full bg-ink/50" />
            <div className="mt-1.5 h-1.5 w-3/4 rounded-full bg-ink/15" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Profile settings: the page background behind your profile, a template design or your own photo. */
export function BackgroundDialog({ user, onClose }: { user: AuthUser; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const saved = user.background ?? 'none'
  const savedEffect = user.background_effect ?? DEFAULT_BACKGROUND_EFFECT
  const [choice, setChoice] = useState<string>(saved)
  const [effect, setEffect] = useState<string>(savedEffect)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const preview = useObjectUrl(file)
  const photoUrl = preview ?? user.background_url

  const onError = (err: unknown) => {
    const fieldErrors = apiValidationErrors(err)
    const first = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : null
    setError(first ?? apiErrorMessage(err))
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!file) return profileService.setBackground(choice, choice === 'photo' ? effect : undefined)
      const uploaded = await profileService.uploadBackground(file, effect)
      return choice === 'photo' ? uploaded : profileService.setBackground(choice)
    },
    onSuccess: () => {
      toast('Background updated.')
      onClose()
    },
    onError,
  })

  const remove = useMutation({
    mutationFn: () => profileService.removeBackground(),
    onSuccess: (updated) => {
      if (choice === 'photo') setChoice(updated.background ?? 'none')
      toast('Background photo removed.')
    },
    onError,
  })

  const pick = (selected: File | undefined) => {
    if (!selected) return
    if (!selected.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    if (selected.size > MAX_MB * 1024 * 1024) {
      setError(`Background photos can be up to ${MAX_MB} MB.`)
      return
    }
    setError(null)
    setFile(selected)
    setChoice('photo')
  }

  const deletePhoto = () => {
    setError(null)
    if (file) {
      setFile(null)
      if (choice === 'photo' && !user.background_url) setChoice(saved === 'photo' ? 'none' : saved)
      return
    }
    remove.mutate()
  }

  const busy = save.isPending || remove.isPending
  const changed = file !== null || choice !== saved || (choice === 'photo' && effect !== savedEffect)

  return (
    <Modal
      title={
        <div>
          <h2 id="background-dialog-title" className="text-[17px] font-semibold text-ink">
            Profile background
          </h2>
          <p className="text-xs text-muted-foreground">
            Shown behind the pages you browse, and behind your profile for everyone who visits it.
          </p>
        </div>
      }
      labelledBy="background-dialog-title"
      onClose={onClose}
      className="max-w-[640px]"
    >
      <div className="px-5 pb-2">
        <Preview user={user} background={choice} url={photoUrl} effect={effect} />

        <h3 className="mt-4 text-[13px] font-semibold text-ink">Templates</h3>
        <div className="mt-2 grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6">
          <Option label="Default" selected={choice === 'none'} onSelect={() => setChoice('none')} disabled={busy}>
            <span className="absolute inset-0 bg-background" />
          </Option>
          {BACKGROUND_TEMPLATES.map((template) => (
            <Option
              key={template.id}
              label={template.name}
              selected={choice === template.id}
              onSelect={() => setChoice(template.id)}
              disabled={busy}
            >
              <ProfileBackdrop background={template.id} className="absolute inset-0" />
            </Option>
          ))}
        </div>

        <h3 className="mt-4 text-[13px] font-semibold text-ink">Your photo</h3>
        <div className="mt-2 grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6">
          {photoUrl ? (
            <Option label="My photo" selected={choice === 'photo'} onSelect={() => setChoice('photo')} disabled={busy}>
              <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
            </Option>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="group min-w-0 text-left disabled:opacity-50"
          >
            <span className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed border-brand-blue/50 bg-brand-blue/[0.04] text-brand-blue transition group-hover:bg-brand-blue/10">
              <ImagePlus className="size-5" />
            </span>
            <span className="mt-1 block truncate text-[11px] font-semibold text-brand-blue">
              {photoUrl ? 'Replace photo' : 'Upload photo'}
            </span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          JPG, PNG, GIF or WEBP up to {MAX_MB} MB. Portrait and landscape photos both fill the page.
        </p>

        {choice === 'photo' && photoUrl ? (
          <>
            <h3 className="mt-4 text-[13px] font-semibold text-ink">Photo look</h3>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {BACKGROUND_EFFECTS.map((look) => (
                <Option
                  key={look.id}
                  label={look.name}
                  selected={effect === look.id}
                  onSelect={() => setEffect(look.id)}
                  disabled={busy}
                >
                  <ProfileBackdrop background="photo" url={photoUrl} effect={look.id} className="absolute inset-0" />
                </Option>
              ))}
            </div>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-xs font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-border px-5 py-3">
        {photoUrl ? (
          <button
            type="button"
            disabled={busy}
            onClick={deletePhoto}
            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink/70 transition hover:bg-muted hover:text-danger disabled:opacity-50"
          >
            {remove.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            <span className="hidden sm:inline">Delete photo</span>
          </button>
        ) : null}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-full px-4 text-[13px] font-semibold text-ink/70 transition hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!changed || busy}
          onClick={() => save.mutate()}
          className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:bg-[#e3e6ee] disabled:text-muted-foreground"
        >
          {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Save
        </button>
      </div>
    </Modal>
  )
}
