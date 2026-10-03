import { Plus } from 'lucide-react'
import type { ProfileMedia } from '@/services/profileService'
import type { AuthUser } from '@/types/auth'

type Step = { label: string; done: boolean; open: () => void }

/** Nudges you to fill in your profile; gone once every detail is there. */
export function ProfileCompletion({
  user,
  onEdit,
  onPhoto,
}: {
  user: AuthUser
  onEdit: () => void
  onPhoto: (type: ProfileMedia) => void
}) {
  const steps: Array<Step> = [
    { label: 'Photo', done: !!user.avatar_url, open: () => onPhoto('avatar') },
    { label: 'Banner', done: !!user.banner_url, open: () => onPhoto('banner') },
    { label: 'Headline', done: !!user.headline, open: onEdit },
    { label: 'Location', done: !!user.location, open: onEdit },
    { label: 'Contact info', done: !!(user.contact_phone || user.contact_email), open: onEdit },
    { label: 'About', done: !!user.bio, open: onEdit },
  ]
  const missing = steps.filter((step) => !step.done)
  if (missing.length === 0) return null

  const done = steps.length - missing.length
  return (
    <section
      aria-label="Complete your profile"
      className="mt-4 max-w-[400px] rounded-lg bg-gradient-to-br from-brand-navy/10 via-brand-blue/10 to-brand-sky/10 px-4 py-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">Stand out in your clubs</p>
        <p className="shrink-0 text-xs text-muted-foreground">
          {done} of {steps.length} done
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        aria-label="Profile completion"
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70"
      >
        <div
          className="brand-gradient h-full rounded-full transition-[width]"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Finish your profile so members know who you are.</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {missing.map((step) => (
          <li key={step.label}>
            <button
              type="button"
              onClick={step.open}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-white px-2.5 text-xs font-semibold text-brand-blue shadow-sm transition hover:bg-brand-blue hover:text-white"
            >
              <Plus className="size-3.5" /> {step.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
