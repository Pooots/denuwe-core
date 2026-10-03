import { DEFAULT_BACKGROUND_EFFECT, templateStyle } from '@/components/profile/backgrounds'
import { cn } from '@/lib/utils'

/**
 * A profile's background: a template design, or their photo with one of the looks.
 * Fills its positioned parent (pass `fixed inset-0` for the page, `absolute inset-0` for previews).
 */
export function ProfileBackdrop({
  background,
  url,
  effect,
  className,
}: {
  background: string | null | undefined
  url?: string | null
  effect?: string | null
  className?: string
}) {
  if (background === 'photo') {
    if (!url) return null
    const look = effect ?? DEFAULT_BACKGROUND_EFFECT
    return (
      <div aria-hidden className={cn('pointer-events-none isolate overflow-hidden', className)}>
        <img
          src={url}
          alt=""
          className={cn(
            'absolute inset-0 size-full object-cover',
            look === 'frosted' && 'scale-110 blur-xl',
            look === 'duotone' && 'contrast-125 grayscale',
          )}
        />
        {look === 'soft' ? (
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/45 to-background/90" />
        ) : null}
        {look === 'frosted' ? <div className="absolute inset-0 bg-white/30" /> : null}
        {look === 'duotone' ? (
          <>
            <div className="absolute inset-0 bg-brand-blue mix-blend-multiply" />
            <div className="absolute inset-0 bg-brand-sky opacity-40 mix-blend-lighten" />
          </>
        ) : null}
        {look === 'dark' ? <div className="absolute inset-0 bg-[#0b1020]/55" /> : null}
      </div>
    )
  }

  const style = templateStyle(background)
  if (!style) return null
  return <div aria-hidden className={cn('pointer-events-none', className)} style={style} />
}
