import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, LoaderCircle, Trash2 } from 'lucide-react'
import type { ProfileMedia } from '@/services/profileService'
import type { AuthUser } from '@/types/auth'
import { Avatar } from '@/components/feed/Avatar'
import { Modal } from '@/components/feed/Modal'
import { toast } from '@/components/feed/Toaster'
import { refreshAuthoredContent } from '@/components/profile/refresh'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { profileService } from '@/services/profileService'

const COPY: Record<ProfileMedia, { title: string; hint: string; maxMb: number; saved: string; removed: string }> = {
  avatar: {
    title: 'Profile photo',
    hint: 'A clear photo of your face helps your clubs recognise you.',
    maxMb: 5,
    saved: 'Profile photo updated.',
    removed: 'Profile photo removed.',
  },
  banner: {
    title: 'Banner image',
    hint: 'A wide image works best. Recommended 1584 × 396.',
    maxMb: 8,
    saved: 'Banner updated.',
    removed: 'Banner removed.',
  },
}

export function PhotoDialog({ type, user, onClose }: { type: ProfileMedia; user: AuthUser; onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[type]
  const current = type === 'avatar' ? user.avatar_url : user.banner_url

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const onError = (err: unknown) => {
    const fieldErrors = apiValidationErrors(err)
    setError(fieldErrors && 'image' in fieldErrors ? fieldErrors.image[0] : apiErrorMessage(err))
  }

  const save = useMutation({
    mutationFn: (selected: File) => profileService.uploadMedia(type, selected),
    onSuccess: () => {
      refreshAuthoredContent(qc)
      toast(copy.saved)
      onClose()
    },
    onError,
  })

  const remove = useMutation({
    mutationFn: () => profileService.removeMedia(type),
    onSuccess: () => {
      refreshAuthoredContent(qc)
      toast(copy.removed)
      onClose()
    },
    onError,
  })

  const pick = (selected: File | undefined) => {
    if (!selected) return
    if (!selected.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    if (selected.size > copy.maxMb * 1024 * 1024) {
      setError(`Photos can be up to ${copy.maxMb} MB.`)
      return
    }
    setError(null)
    setFile(selected)
  }

  const busy = save.isPending || remove.isPending
  const shown = preview ?? current

  return (
    <Modal
      title={<h2 className="text-[17px] font-semibold text-ink">{copy.title}</h2>}
      onClose={onClose}
      className={type === 'banner' ? 'max-w-[760px]' : undefined}
    >
      <div className="px-5 pb-2">
        <div className="overflow-hidden rounded-xl bg-ink">
          {type === 'avatar' ? (
            <div className="grid place-items-center py-8">
              <Avatar
                name={user.name}
                src={shown}
                className="size-[200px] rounded-full border-4 border-white/90 text-6xl"
              />
            </div>
          ) : (
            <div className="brand-gradient relative aspect-[4/1] w-full">
              {shown ? <img src={shown} alt="" className="absolute inset-0 size-full object-cover" /> : null}
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{copy.hint}</p>
        {error ? <p className="mt-2 text-xs font-semibold text-danger">{error}</p> : null}
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-border px-5 py-3">
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
        {current && !file ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => remove.mutate()}
            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink/70 transition hover:bg-muted hover:text-danger disabled:opacity-50"
          >
            {remove.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Delete
          </button>
        ) : null}
        <span className="flex-1" />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="flex h-9 items-center gap-1.5 rounded-full border border-brand-blue px-4 text-[13px] font-semibold text-brand-blue transition hover:bg-brand-blue/5 disabled:opacity-50"
        >
          <Camera className="size-4" />
          {current || file ? 'Change photo' : 'Upload photo'}
        </button>
        <button
          type="button"
          disabled={!file || busy}
          onClick={() => file && save.mutate(file)}
          className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:bg-[#e3e6ee] disabled:text-muted-foreground"
        >
          {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Save
        </button>
      </div>
    </Modal>
  )
}
