import { useRef, useState } from 'react'
import { Check, Monitor } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import type { AppPlatform, Device } from '@/lib/platform'
import type { InstallState } from '@/lib/pwa'
import { InstallGuide } from '@/components/auth/InstallGuide'
import { AndroidIcon, AppleIcon } from '@/components/brand/PlatformIcons'
import { APP_DOWNLOAD_URLS, APP_STORE_NAMES } from '@/config/appDownloads'
import { detectDevice } from '@/lib/platform'
import { promptInstall, usePwaInstall } from '@/lib/pwa'
import { cn } from '@/lib/utils'

type PlatformInfo = {
  id: AppPlatform
  name: string
  icon: ComponentType<{ className?: string }>
  /** Hint when this isn't the visitor's device. */
  reach: string
}

const PLATFORMS: Array<PlatformInfo> = [
  { id: 'pc', name: 'PC', icon: Monitor, reach: 'Desktop & laptop' },
  { id: 'android', name: 'Android', icon: AndroidIcon, reach: 'Phones & tablets' },
  { id: 'ios', name: 'iOS', icon: AppleIcon, reach: 'iPhone & iPad' },
]

type Action = { kind: 'store'; href: string; hint: string } | { kind: 'prompt' | 'open' | 'guide'; hint: string }

function hereHint(platform: AppPlatform, device: Device): string {
  if (platform === 'pc') return 'Install on PC'
  if (platform === 'android') return 'Install on Android'
  return device.os === 'ipad' ? 'Add to iPad' : 'Add to iPhone'
}

/** Native link when one is configured; otherwise install (or open) denuwe as a web app. */
function actionFor(platform: PlatformInfo, device: Device, install: InstallState): Action {
  const href = APP_DOWNLOAD_URLS[platform.id]
  if (href) return { kind: 'store', href, hint: APP_STORE_NAMES[platform.id] }
  if (device.platform !== platform.id) return { kind: 'guide', hint: platform.reach }
  if (install.installed) return { kind: 'open', hint: 'Open denuwe' }
  if (install.canPrompt) return { kind: 'prompt', hint: 'Install denuwe' }
  return { kind: 'guide', hint: hereHint(platform.id, device) }
}

const ACCESSIBLE_HINT: Record<Action['kind'], string> = {
  store: 'opens the app store in a new tab',
  prompt: 'install denuwe on this device',
  open: 'denuwe is installed on this device',
  guide: 'shows how to install denuwe',
}

function AppButton({
  platform,
  action,
  featured,
  buttonRef,
  onActivate,
}: {
  platform: PlatformInfo
  action: Action
  featured: boolean
  buttonRef: (el: HTMLElement | null) => void
  onActivate: () => void
}) {
  const Icon = platform.icon
  const label = `Download ${platform.name}`
  const className = cn(
    'group flex h-full w-full flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 text-center',
    '@min-[26rem]:flex-row @min-[26rem]:gap-2.5 @min-[26rem]:px-3 @min-[26rem]:text-left',
    'transition duration-200 ease-out hover:-translate-y-px hover:border-brand-blue/60 hover:shadow-[0_8px_20px_-12px_rgb(42_107_214/0.5)] active:translate-y-0',
    'focus-visible:ring-2 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2 focus-visible:outline-none',
    'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
    featured ? 'border-brand-blue/40 bg-brand-blue/[0.04]' : 'border-[#d5d9e2] bg-white',
  )
  const content: ReactNode = (
    <>
      <Icon className="size-5 shrink-0 text-brand-blue" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-[11px] text-muted-foreground">Download</span>
        <span className="text-[14px] font-semibold text-brand-blue">{platform.name}</span>
        <span
          className={cn(
            'mt-0.5 inline-flex items-center justify-center gap-1 text-[11px] text-balance @min-[26rem]:justify-start',
            featured ? 'font-medium text-brand-blue' : 'text-muted-foreground',
          )}
        >
          {action.kind === 'open' ? <Check className="size-3 shrink-0" aria-hidden /> : null}
          {action.hint}
        </span>
      </span>
    </>
  )
  const ariaLabel = `${label}: ${action.hint}, ${ACCESSIBLE_HINT[action.kind]}`

  if (action.kind === 'store') {
    return (
      <a
        ref={buttonRef}
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        className={className}
      >
        {content}
      </a>
    )
  }
  return (
    <button ref={buttonRef} type="button" onClick={onActivate} aria-label={ariaLabel} className={className}>
      {content}
    </button>
  )
}

/** "Get denuwe on your devices": install denuwe as an app (PWA) until native apps are published. */
export function AppDownloads({ className }: { className?: string }) {
  const device = detectDevice()
  const install = usePwaInstall()
  const [guide, setGuide] = useState<PlatformInfo | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const triggers = useRef(new Map<AppPlatform, HTMLElement>())

  const activate = async (platform: PlatformInfo, action: Action) => {
    if (action.kind === 'prompt') {
      const outcome = await promptInstall()
      if (outcome === 'accepted') setAnnouncement('denuwe is installed. You can open it from your apps.')
      if (outcome !== 'unavailable') return
    }
    setGuide(platform)
  }

  const closeGuide = () => {
    const trigger = guide ? triggers.current.get(guide.id) : undefined
    setGuide(null)
    trigger?.focus()
  }

  return (
    <section aria-labelledby="get-app-title" className={cn('@container', className)}>
      <h3 id="get-app-title" className="text-center text-[14px] font-semibold text-ink">
        Get denuwe on your devices
      </h3>
      <p className="mt-0.5 text-center text-[12px] text-muted-foreground">Connect with your community anywhere.</p>

      <ul className="mt-3 grid grid-cols-3 gap-2 @max-[17.5rem]:grid-cols-1">
        {PLATFORMS.map((platform) => {
          const action = actionFor(platform, device, install)
          return (
            <li key={platform.id}>
              <AppButton
                platform={platform}
                action={action}
                featured={device.platform === platform.id}
                buttonRef={(el) => {
                  if (el) triggers.current.set(platform.id, el)
                  else triggers.current.delete(platform.id)
                }}
                onActivate={() => void activate(platform, action)}
              />
            </li>
          )
        })}
      </ul>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {guide ? (
        <InstallGuide platform={guide.id} icon={guide.icon} device={device} install={install} onClose={closeGuide} />
      ) : null}
    </section>
  )
}
