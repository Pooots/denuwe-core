import { useSyncExternalStore } from 'react'

/**
 * Installing denuwe as a web app: registers the service worker, keeps the browser's install prompt
 * (`beforeinstallprompt`, Chrome/Edge/Samsung Internet) for the "Download" buttons, and tracks whether
 * denuwe is installed or already running as the installed app.
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type InstallState = {
  /** The browser can show its own install dialog right now. */
  canPrompt: boolean
  /** Installed on this device (seen via `appinstalled`, or running as the app). */
  installed: boolean
  /** This window is the installed app, not a browser tab. */
  standalone: boolean
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

const INSTALLED_KEY = 'denuwe_pwa_installed'

let deferred: InstallPromptEvent | null = null
let state: InstallState = { canPrompt: false, installed: false, standalone: false }
const listeners = new Set<() => void>()
let started = false

function readFlag(): boolean {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1'
  } catch {
    return false
  }
}

function writeFlag(installed: boolean): void {
  try {
    if (installed) localStorage.setItem(INSTALLED_KEY, '1')
    else localStorage.removeItem(INSTALLED_KEY)
  } catch {
    // Private mode or storage disabled: the state just won't survive a reload.
  }
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return (
    iosStandalone ||
    ['standalone', 'fullscreen', 'minimal-ui'].some((mode) => matchMedia(`(display-mode: ${mode})`).matches)
  )
}

function update(change: Partial<InstallState>): void {
  const next = { ...state, ...change }
  if (
    next.canPrompt === state.canPrompt &&
    next.installed === state.installed &&
    next.standalone === state.standalone
  ) {
    return
  }
  state = next
  listeners.forEach((listener) => listener())
}

function markInstalled(): void {
  deferred = null
  writeFlag(true)
  update({ canPrompt: false, installed: true })
}

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return
  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      console.warn('denuwe: service worker registration failed; the app still works, but cannot be installed.', error)
    })
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

/** Call once at startup, before rendering, so an early install prompt isn't missed. */
export function initPwa(): void {
  if (started || typeof window === 'undefined') return
  started = true

  const standalone = isStandalone()
  state = { canPrompt: false, installed: standalone || readFlag(), standalone }

  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep the prompt for the Download buttons instead of the browser's own banner.
    event.preventDefault()
    deferred = event as InstallPromptEvent
    // Browsers only offer installing when denuwe isn't installed (any more).
    writeFlag(false)
    update({ canPrompt: true, installed: false })
  })
  window.addEventListener('appinstalled', markInstalled)

  for (const mode of ['standalone', 'fullscreen', 'minimal-ui']) {
    matchMedia(`(display-mode: ${mode})`).addEventListener('change', () => {
      const now = isStandalone()
      update(now ? { standalone: true, installed: true } : { standalone: false })
    })
  }

  registerServiceWorker()
}

/** Show the browser's install dialog (needs a click or tap). */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred
  if (!event) return 'unavailable'
  // A prompt can only be shown once; the browser sends a new one if it may ask again.
  deferred = null
  update({ canPrompt: false })
  try {
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') markInstalled()
    return outcome
  } catch {
    return 'unavailable'
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePwaInstall(): InstallState {
  return useSyncExternalStore(subscribe, () => state)
}
