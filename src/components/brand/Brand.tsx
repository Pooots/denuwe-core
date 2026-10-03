import { cn } from '@/lib/utils'

export const BRAND_NAME = 'denuwe'

/** The blue "d" logo mark. */
export function BrandMark({ className, alt = '' }: { className?: string; alt?: string }) {
  return <img src="/denuwe-mark.png" alt={alt} className={cn('object-contain', className)} />
}

/** The navy "denuwe" wordmark, always lowercase. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-brand leading-none font-bold tracking-[-0.01em] text-brand-navy', className)}>
      {BRAND_NAME}
    </span>
  )
}

/** Mark and wordmark side by side. */
export function BrandLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} aria-label={BRAND_NAME}>
      <BrandMark className={cn('size-[1.15em]', markClassName)} />
      <Wordmark />
    </span>
  )
}
