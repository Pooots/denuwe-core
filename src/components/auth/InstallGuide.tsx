import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, MonitorDown, MoreHorizontal, MoreVertical, Share, SquarePlus } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import type { AppPlatform, Device } from '@/lib/platform'
import type { InstallState } from '@/lib/pwa'
import { Modal } from '@/components/feed/Modal'

type Guide = {
  title: string
  intro?: ReactNode
  steps: Array<ReactNode>
  note?: ReactNode
  /** Show this page's link to copy, for installing on another device or browser. */
  showLink: boolean
}

/** A browser control written inline in a step, e.g. the ⋮ menu. */
function Ui({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <span
      className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 align-[-0.15em] text-[13px] font-semibold text-ink"
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {children}
    </span>
  )
}

const icon = 'size-3.5'

function iosSteps(onThisDevice: boolean): Array<ReactNode> {
  return [
    onThisDevice ? (
      <>
        Open denuwe in <b>Safari</b>.
      </>
    ) : (
      <>
        On your iPhone or iPad, open the link below in <b>Safari</b>.
      </>
    ),
    <>
      Tap the Share button
      <Ui label="Share">
        <Share className={icon} />
      </Ui>
      (at the bottom on iPhone, at the top on iPad).
    </>,
    <>
      Scroll down and select <b>Add to Home Screen</b>
      <Ui label="Add to Home Screen">
        <SquarePlus className={icon} />
      </Ui>
      .
    </>,
    <>
      Tap <b>Add</b>. denuwe appears on your Home Screen like any other app.
    </>,
  ]
}

function androidChromeSteps(onThisDevice: boolean): Array<ReactNode> {
  return [
    onThisDevice ? (
      <>
        Open denuwe in <b>Chrome</b>.
      </>
    ) : (
      <>
        On your Android phone or tablet, open the link below in <b>Chrome</b>.
      </>
    ),
    <>
      Tap the menu
      <Ui label="More options">
        <MoreVertical className={icon} />
      </Ui>
      at the top right.
    </>,
    <>
      Tap <b>Install app</b> or <b>Add to Home screen</b>.
    </>,
    <>
      Tap <b>Install</b>. denuwe is added to your home screen and app drawer.
    </>,
  ]
}

function pcGuide(device: Device): Guide {
  const title = 'Install denuwe on your PC'
  if (device.platform !== 'pc') {
    return {
      title,
      intro: 'Install denuwe on your Windows PC, Mac or Linux computer as an app:',
      steps: [
        <>
          On your computer, open the link below in <b>Google Chrome</b> or <b>Microsoft Edge</b>.
        </>,
        <>
          Click the install icon
          <Ui label="Install">
            <MonitorDown className={icon} />
          </Ui>
          in the address bar.
        </>,
        <>
          Click <b>Install</b>. denuwe opens in its own window.
        </>,
      ],
      showLink: true,
    }
  }
  switch (device.browser) {
    case 'edge':
      return {
        title,
        steps: [
          <>
            Click the <b>App available</b> icon at the right end of the address bar.
          </>,
          <>
            Or open the menu
            <Ui label="Settings and more">
              <MoreHorizontal className={icon} />
            </Ui>
            → <b>Apps</b> → <b>Install this site as an app</b>.
          </>,
          <>
            Click <b>Install</b>. denuwe opens in its own window and is added to your Start menu or app launcher.
          </>,
        ],
        showLink: false,
      }
    case 'chrome':
    case 'opera':
      return {
        title,
        steps: [
          <>
            Click the install icon
            <Ui label="Install">
              <MonitorDown className={icon} />
            </Ui>
            at the right end of the address bar.
          </>,
          <>
            Or open the menu
            <Ui label="More options">
              <MoreVertical className={icon} />
            </Ui>
            → <b>Cast, save, and share</b> → <b>Install page as app</b>.
          </>,
          <>
            Click <b>Install</b>. denuwe opens in its own window and is added to your Start menu, Dock or app launcher.
          </>,
        ],
        showLink: false,
      }
    case 'safari':
      return {
        title,
        steps: [
          <>
            In the menu bar, choose <b>File</b> → <b>Add to Dock</b> (macOS Sonoma or later).
          </>,
          <>
            Or click Share
            <Ui label="Share">
              <Share className={icon} />
            </Ui>
            in the toolbar → <b>Add to Dock</b>.
          </>,
          <>
            Click <b>Add</b>. denuwe opens from your Dock and Launchpad.
          </>,
        ],
        showLink: false,
      }
    default:
      return {
        title,
        intro: 'This browser can’t install web apps. Use Google Chrome or Microsoft Edge instead:',
        steps: [
          <>
            Open the link below in <b>Chrome</b> or <b>Edge</b>.
          </>,
          <>
            Click the install icon
            <Ui label="Install">
              <MonitorDown className={icon} />
            </Ui>
            in the address bar.
          </>,
          <>
            Click <b>Install</b>.
          </>,
        ],
        showLink: true,
      }
  }
}

function androidGuide(device: Device): Guide {
  const title = 'Install denuwe on Android'
  if (device.platform !== 'android') {
    return { title, steps: androidChromeSteps(false), showLink: true }
  }
  if (device.browser === 'samsung') {
    return {
      title,
      steps: [
        <>
          Tap the menu <Ui label="Menu">☰</Ui> at the bottom of the screen.
        </>,
        <>
          Tap <b>Add page to</b> → <b>Home screen</b>.
        </>,
        <>
          Tap <b>Add</b>.
        </>,
      ],
      showLink: false,
    }
  }
  if (device.browser === 'firefox') {
    return {
      title,
      steps: [
        <>
          Tap the menu
          <Ui label="More options">
            <MoreVertical className={icon} />
          </Ui>
          .
        </>,
        <>
          Tap <b>Install</b> or <b>Add to Home screen</b>.
        </>,
        <>
          Tap <b>Add</b>.
        </>,
      ],
      showLink: false,
    }
  }
  return {
    title,
    intro: 'Open denuwe in Chrome → tap the menu ⋮ → Add to Home screen / Install app.',
    steps: androidChromeSteps(true),
    showLink: device.browser !== 'chrome',
  }
}

function iosGuide(device: Device): Guide {
  const title = device.os === 'ipad' ? 'Add denuwe to your iPad' : 'Add denuwe to your iPhone'
  if (device.platform !== 'ios') {
    return { title: 'Add denuwe to your iPhone or iPad', steps: iosSteps(false), showLink: true }
  }
  const safari = device.browser === 'safari'
  return {
    title,
    steps: iosSteps(true),
    note: safari ? undefined : (
      <>
        Using another browser? On iOS 16.4 or later its Share menu may also offer <b>Add to Home Screen</b>; otherwise
        copy the link and open it in Safari.
      </>
    ),
    showLink: !safari,
  }
}

function openGuide(platform: AppPlatform, install: InstallState): Guide {
  if (install.standalone) {
    return {
      title: 'You’re using the denuwe app',
      intro: 'denuwe is installed and running as an app.',
      steps: [],
      showLink: false,
    }
  }
  const where: Record<AppPlatform, ReactNode> = {
    pc: (
      <>
        Open denuwe from your Start menu, taskbar or desktop on Windows, from Launchpad or the Dock on a Mac, or from
        your app launcher. In Chrome or Edge you can also click <b>Open in app</b> in the address bar.
      </>
    ),
    android: 'Open denuwe from your home screen or app drawer.',
    ios: 'Open denuwe from your Home Screen.',
  }
  return { title: 'denuwe is installed', intro: where[platform], steps: [], showLink: false }
}

function CopyLink() {
  const link = window.location.origin
  const inputRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // No clipboard access (e.g. plain http on a LAN address): select it so it can be copied by hand.
      inputRef.current?.select()
    }
  }

  return (
    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#d5d9e2] bg-white py-1.5 pr-1.5 pl-3">
      <input
        ref={inputRef}
        readOnly
        value={link}
        aria-label="denuwe link"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none"
      />
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-brand-blue px-3.5 text-[13px] font-medium text-brand-blue transition hover:bg-brand-blue/5 focus-visible:ring-2 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}

/** How to install (or open) denuwe on a platform, adapted to this device and browser. */
export function InstallGuide({
  platform,
  icon: Icon,
  device,
  install,
  onClose,
}: {
  platform: AppPlatform
  icon: ComponentType<{ className?: string }>
  device: Device
  install: InstallState
  onClose: () => void
}) {
  const guide =
    device.platform === platform && install.installed
      ? openGuide(platform, install)
      : platform === 'pc'
        ? pcGuide(device)
        : platform === 'android'
          ? androidGuide(device)
          : iosGuide(device)
  const titleId = `install-guide-${platform}`

  // Portaled: the login panel's entrance animation leaves a transform that would trap a fixed overlay inside it.
  return createPortal(
    <Modal
      labelledBy={titleId}
      onClose={onClose}
      className="max-w-[440px] rounded-2xl"
      title={
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-blue/10 text-brand-blue">
            <Icon className="size-5" />
          </span>
          <h2 id={titleId} className="text-[17px] font-semibold text-ink">
            {guide.title}
          </h2>
        </div>
      }
    >
      <div className="px-5 pt-2 pb-5">
        {guide.intro ? <p className="text-[14px] leading-relaxed text-muted-foreground">{guide.intro}</p> : null}
        {guide.steps.length > 0 ? (
          <ol className="mt-3 space-y-3">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-ink">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-blue text-[12px] font-semibold text-white">
                  {i + 1}
                </span>
                <span className="min-w-0 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {guide.note ? <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{guide.note}</p> : null}
        {guide.showLink ? <CopyLink /> : null}
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="mt-5 flex h-11 w-full items-center justify-center rounded-full bg-brand-blue text-[15px] font-medium text-white transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2 focus-visible:outline-none active:brightness-95"
        >
          Got it
        </button>
      </div>
    </Modal>,
    document.body,
  )
}
