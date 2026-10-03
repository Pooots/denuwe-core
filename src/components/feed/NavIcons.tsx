import { useId } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Paint = { stroke: string; fill: string; fillOpacity: number; solidOpacity: number }

type NavIconProps = { active?: boolean; className?: string }

function NavIconBase({ active, className, children }: NavIconProps & { children: (paint: Paint) => ReactNode }) {
  const gradientId = `nav-icon-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const paint: Paint = active
    ? { stroke: `url(#${gradientId})`, fill: `url(#${gradientId})`, fillOpacity: 0.16, solidOpacity: 1 }
    : { stroke: 'currentColor', fill: 'none', fillOpacity: 0, solidOpacity: 0 }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-hidden
    >
      {active ? (
        <defs>
          <linearGradient id={gradientId} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: 'var(--brand-navy)' }} />
            <stop offset="0.55" style={{ stopColor: 'var(--brand-blue)' }} />
            <stop offset="1" style={{ stopColor: 'var(--brand-sky)' }} />
          </linearGradient>
        </defs>
      ) : null}
      {children(paint)}
    </svg>
  )
}

export function HomeIcon(props: NavIconProps) {
  return (
    <NavIconBase {...props}>
      {(p) => (
        <>
          <path
            d="M3.75 10.4 11.1 4.3a1.4 1.4 0 0 1 1.8 0l7.35 6.1v8.1a2 2 0 0 1-2 2h-2.9v-5a1.6 1.6 0 0 0-1.6-1.6h-1.5a1.6 1.6 0 0 0-1.6 1.6v5h-2.9a2 2 0 0 1-2-2z"
            stroke={p.stroke}
            fill={p.fill}
            fillOpacity={p.fillOpacity}
          />
        </>
      )}
    </NavIconBase>
  )
}

export function ExploreIcon(props: NavIconProps) {
  return (
    <NavIconBase {...props}>
      {(p) => (
        <>
          <circle cx="12" cy="12" r="8.75" stroke={p.stroke} />
          <path
            d="m15.6 8.4-1.9 4.6a1.3 1.3 0 0 1-.7.7l-4.6 1.9 1.9-4.6a1.3 1.3 0 0 1 .7-.7z"
            stroke={p.stroke}
            fill={p.fill}
            fillOpacity={p.solidOpacity}
          />
        </>
      )}
    </NavIconBase>
  )
}

export function SocietyIcon(props: NavIconProps) {
  return (
    <NavIconBase {...props}>
      {(p) => (
        <>
          <circle cx="12" cy="8.25" r="3.25" stroke={p.stroke} fill={p.fill} fillOpacity={p.solidOpacity} />
          <path d="M6.25 19.5a5.75 5.75 0 0 1 11.5 0z" stroke={p.stroke} fill={p.fill} fillOpacity={p.fillOpacity} />
          <path d="M5.6 12.1a2.35 2.35 0 1 1 1.1-4.3" stroke={p.stroke} />
          <path d="M18.4 12.1a2.35 2.35 0 1 0-1.1-4.3" stroke={p.stroke} />
          <path d="M2.75 18.25a3.9 3.9 0 0 1 3.4-3.85" stroke={p.stroke} />
          <path d="M21.25 18.25a3.9 3.9 0 0 0-3.4-3.85" stroke={p.stroke} />
        </>
      )}
    </NavIconBase>
  )
}

export function ShortsIcon(props: NavIconProps) {
  return (
    <NavIconBase {...props}>
      {(p) => (
        <>
          <rect
            x="3.75"
            y="3.75"
            width="16.5"
            height="16.5"
            rx="4.5"
            stroke={p.stroke}
            fill={p.fill}
            fillOpacity={p.fillOpacity}
          />
          <path d="M3.75 8.75h16.5" stroke={p.stroke} />
          <path d="m8.25 3.9 2.6 4.7M13.6 3.9l2.6 4.7" stroke={p.stroke} />
          <path
            d="M10.4 12.3v4.4a.6.6 0 0 0 .9.5l3.6-2.2a.6.6 0 0 0 0-1l-3.6-2.2a.6.6 0 0 0-.9.5z"
            stroke={p.stroke}
            fill={p.fill}
            fillOpacity={p.solidOpacity}
          />
        </>
      )}
    </NavIconBase>
  )
}

export function ActivitiesIcon(props: NavIconProps) {
  return (
    <NavIconBase {...props}>
      {(p) => (
        <>
          <path
            d="M3 13.5c1.6 0 2.4-1.2 3-2.8.8-2.2 1.5-4.7 2.9-4.7 2.2 0 2.3 12 4.6 12 1.4 0 2-2.4 2.7-4.4.5-1.3 1.1-2.1 2.4-2.1H21"
            stroke={p.stroke}
          />
        </>
      )}
    </NavIconBase>
  )
}

export function TournamentIcon(props: NavIconProps) {
  return (
    <NavIconBase {...props}>
      {(p) => (
        <>
          <path
            d="M7.25 4.25h9.5v5a4.75 4.75 0 0 1-9.5 0z"
            stroke={p.stroke}
            fill={p.fill}
            fillOpacity={p.fillOpacity}
          />
          <path d="M7.25 6.25H5.5a1.75 1.75 0 0 0 0 3.5h1.9" stroke={p.stroke} />
          <path d="M16.75 6.25h1.75a1.75 1.75 0 0 1 0 3.5h-1.9" stroke={p.stroke} />
          <path d="M12 14v3" stroke={p.stroke} />
          <path d="M8.75 20.25c0-1.8 1.45-3.25 3.25-3.25s3.25 1.45 3.25 3.25z" stroke={p.stroke} />
        </>
      )}
    </NavIconBase>
  )
}
