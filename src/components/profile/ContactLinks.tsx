import { Mail, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

const linkClass =
  'inline-flex min-w-0 items-center gap-1.5 font-semibold text-ink/80 transition hover:text-brand-blue hover:underline'

/** Contact number and email for a profile header, as tap-to-call and tap-to-email links. */
export function ContactLinks({
  email,
  phone,
  className,
}: {
  email: string | null | undefined
  phone: string | null | undefined
  className?: string
}) {
  if (!email && !phone) return null

  return (
    <ul aria-label="Contact info" className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]', className)}>
      {phone ? (
        <li className="min-w-0">
          <a href={`tel:${phone}`} title="Call" className={linkClass}>
            <Phone className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="sr-only">Contact number: </span>
            {phone}
          </a>
        </li>
      ) : null}
      {email ? (
        <li className="min-w-0">
          <a href={`mailto:${email}`} title="Send an email" className={linkClass}>
            <Mail className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="sr-only">Email: </span>
            <span className="truncate">{email}</span>
          </a>
        </li>
      ) : null}
    </ul>
  )
}
