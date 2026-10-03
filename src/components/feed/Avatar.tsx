import { useState } from 'react'
import { cn } from '@/lib/utils'

const GRADIENTS = [
  'from-brand-navy to-brand-blue',
  'from-brand-blue to-brand-sky',
  'from-sky-400 to-teal-400',
  'from-emerald-400 to-brand-blue',
  'from-indigo-500 to-brand-sky',
]

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

function gradientFor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return GRADIENTS[hash % GRADIENTS.length]
}

export function Avatar({
  name,
  src,
  className,
  online,
}: {
  name: string
  src?: string | null
  className?: string
  online?: boolean
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  return (
    <span className={cn('relative inline-grid shrink-0', className)}>
      {src && src !== failedSrc ? (
        <img
          src={src}
          alt={name}
          onError={() => setFailedSrc(src)}
          className="size-full rounded-full bg-muted object-cover"
        />
      ) : (
        <span
          className={cn(
            'grid size-full place-items-center rounded-full bg-gradient-to-br font-semibold text-white',
            gradientFor(name),
          )}
        >
          {initialsOf(name)}
        </span>
      )}
      {online ? (
        <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-white bg-emerald-500" />
      ) : null}
    </span>
  )
}
