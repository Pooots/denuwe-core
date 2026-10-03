import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, ChevronDown, Earth, Image, LoaderCircle, X } from 'lucide-react'
import type { AuthUser } from '@/types/auth'
import type { ClubSummary } from '@/types/club'
import type { FeedPost } from '@/types/feed'
import { CLUBS_KEY, CLUB_TYPE_LABEL, ClubIcon, plural } from '@/components/clubs/clubUi'
import { Avatar } from '@/components/feed/Avatar'
import { Modal } from '@/components/feed/Modal'
import { QuotedPost } from '@/components/feed/QuotedPost'
import { toast } from '@/components/feed/Toaster'
import { patchPost, prependPost } from '@/components/feed/feedCache'
import { cn } from '@/lib/utils'
import { useDismiss } from '@/components/feed/useDismiss'
import { apiErrorMessage, apiValidationErrors } from '@/services/authService'
import { clubService } from '@/services/clubService'
import { feedService } from '@/services/feedService'

export type ComposerMode = 'post' | 'photo' | 'event' | 'article'

/** `club` preselects the audience, e.g. when writing from a club's wall. */
export type ComposerRequest = { mode: ComposerMode; quote?: FeedPost; club?: ClubSummary }

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const PLACEHOLDERS: Record<ComposerMode, string> = {
  post: 'What do you want to talk about?',
  photo: 'Say something about this photo…',
  event: 'Share an event: what, when and where?',
  article: 'Write your article…',
}

function AudiencePicker({
  club,
  onChange,
}: {
  club: ClubSummary | null
  onChange: (club: ClubSummary | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)
  const clubs = useQuery({
    queryKey: [...CLUBS_KEY, 'mine'],
    queryFn: () => clubService.mine(),
  })

  const choose = (next: ClubSummary | null) => {
    onChange(next)
    setOpen(false)
  }

  const option = (selected: boolean) =>
    cn('flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-muted', selected && 'bg-brand-blue/5')

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="-ml-1.5 flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-ink"
      >
        {club ? (
          <ClubIcon
            color={club.color}
            type={club.type}
            src={club.avatar_url}
            className="size-3.5 rounded-sm"
            iconClassName="size-2.5"
          />
        ) : (
          <Earth className="size-3 shrink-0" />
        )}
        <span className="truncate">{club ? `Post in ${club.name}` : 'Post to everyone on denuwe'}</span>
        <ChevronDown className="size-3.5 shrink-0" />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Who can see your post"
          className="absolute top-full left-0 z-30 mt-1 w-[300px] overflow-hidden rounded-xl border border-border bg-white py-1 shadow-xl"
        >
          <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Who can see your post?
          </p>
          <button
            type="button"
            role="option"
            aria-selected={!club}
            onClick={() => choose(null)}
            className={option(!club)}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-ink/70">
              <Earth className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-ink">Anyone</span>
              <span className="block text-xs text-muted-foreground">Everyone on denuwe</span>
            </span>
            {!club ? <Check className="size-4 shrink-0 text-brand-blue" /> : null}
          </button>

          <p className="border-t border-border px-4 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Your clubs & communities
          </p>
          <div className="max-h-64 overflow-y-auto">
            {clubs.isLoading ? (
              <p className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Loading…
              </p>
            ) : null}
            {clubs.data?.map((item) => {
              const selected = club?.id === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(item)}
                  className={option(selected)}
                >
                  <ClubIcon color={item.color} type={item.type} src={item.avatar_url} className="size-9 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{item.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {CLUB_TYPE_LABEL[item.type]} · {plural(item.members_count, 'member')}
                    </span>
                  </span>
                  {selected ? <Check className="size-4 shrink-0 text-brand-blue" /> : null}
                </button>
              )
            })}
            {clubs.isSuccess && clubs.data.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">
                You haven’t joined any yet.{' '}
                <Link to="/clubs" className="font-semibold text-brand-blue hover:underline">
                  Explore clubs
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ComposerModal({
  user,
  request,
  onClose,
}: {
  user: AuthUser
  request: ComposerRequest
  onClose: () => void
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [body, setBody] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [club, setClub] = useState<ClubSummary | null>(request.club ?? null)
  const { quote } = request

  useEffect(() => {
    if (request.mode === 'photo') fileRef.current?.click()
  }, [request.mode])

  useEffect(() => {
    if (!image) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  const create = useMutation({
    mutationFn: () =>
      feedService.create({
        body,
        image,
        repostOfId: quote?.id,
        clubId: club?.id,
      }),
    onSuccess: (post) => {
      prependPost(qc, post)
      if (quote)
        patchPost(qc, quote.id, (p) => ({
          ...p,
          reposts_count: p.reposts_count + 1,
        }))
      toast(post.club ? `Posted in ${post.club.name}.` : quote ? 'Reposted with your thoughts.' : 'Your post is live.')
      onClose()
    },
    onError: (err) => {
      const fieldErrors = apiValidationErrors(err)
      setError((fieldErrors && Object.values(fieldErrors)[0]?.[0]) || apiErrorMessage(err))
    },
  })

  const pickImage = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Photos can be up to 5 MB.')
      return
    }
    setError(null)
    setImage(file)
  }

  const canPost = Boolean(body.trim() || image || quote) && !create.isPending

  return (
    <Modal
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <Avatar name={user.name} src={user.avatar_url} className="size-12 text-[15px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold text-ink">{user.name}</p>
            <AudiencePicker
              club={club}
              onChange={(next) => {
                setClub(next)
                setError(null)
              }}
            />
          </div>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canPost) create.mutate()
        }}
      >
        <div className="max-h-[60dvh] overflow-y-auto px-5">
          <textarea
            autoFocus
            value={body}
            maxLength={3000}
            onChange={(e) => {
              setBody(e.target.value)
              if (error) setError(null)
            }}
            placeholder={
              quote
                ? 'Add your thoughts…'
                : club && request.mode === 'post'
                  ? `Share something with ${club.name}…`
                  : PLACEHOLDERS[request.mode]
            }
            className={cn(
              'w-full resize-none bg-transparent py-2 text-[15px] leading-relaxed text-ink placeholder:text-muted-foreground focus:outline-none',
              request.mode === 'article' ? 'min-h-[240px]' : quote || preview ? 'min-h-[96px]' : 'min-h-[160px]',
            )}
          />

          {preview ? (
            <div className="relative mb-3 overflow-hidden rounded-lg border border-border bg-muted">
              <img src={preview} alt="Selected" className="block max-h-[360px] w-full object-contain" />
              <button
                type="button"
                onClick={() => setImage(null)}
                aria-label="Remove photo"
                className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-ink/70 text-white hover:bg-ink"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          {quote ? (
            <div className="mb-3">
              <QuotedPost post={quote} />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              pickImage(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Add a photo"
            className="grid size-10 place-items-center rounded-full text-sky-500 transition hover:bg-muted"
          >
            <Image className="size-5" />
          </button>
          <p className="min-w-0 flex-1 truncate text-xs text-danger">{error}</p>
          <button
            type="submit"
            disabled={!canPost}
            className="flex h-9 items-center gap-2 rounded-full bg-brand-blue px-5 text-[13px] font-semibold text-white transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:bg-[#e3e6ee] disabled:text-muted-foreground"
          >
            {create.isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {quote ? 'Repost' : 'Post'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
