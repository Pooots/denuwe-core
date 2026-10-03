import { useEffect, useSyncExternalStore } from 'react'
import type { ProfileBackground } from '@/components/profile/backgrounds'
import { ProfileBackdrop } from '@/components/profile/ProfileBackdrop'
import { hasBackground } from '@/components/profile/backgrounds'
import { authService } from '@/services/authService'

/** The background of a profile being visited; shown instead of yours while that page is open. */
let visited: ProfileBackground | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Show someone else's background (theirs, even when they have none) until the returned cleanup runs. */
export function showVisitedBackground(background: ProfileBackground): () => void {
  visited = background
  listeners.forEach((listener) => listener())
  return () => {
    if (visited !== background) return
    visited = null
    listeners.forEach((listener) => listener())
  }
}

/**
 * Your profile background, behind every signed-in page. Page shells with the `app-page` class turn
 * transparent while it's showing (see styles.css); pages without it (Shorts, Status) keep their own.
 */
export function AppBackdrop() {
  const user = useSyncExternalStore(authService.subscribe, authService.getUser)
  const visiting = useSyncExternalStore(subscribe, () => visited)
  const shown: ProfileBackground | null =
    visiting ?? (user ? { background: user.background, url: user.background_url, effect: user.background_effect } : null)
  const active = shown !== null && hasBackground(shown)

  useEffect(() => {
    const root = document.documentElement
    if (active) root.dataset.backdrop = ''
    else delete root.dataset.backdrop
    return () => {
      delete root.dataset.backdrop
    }
  }, [active])

  if (!active) return null
  return <ProfileBackdrop {...shown} className="fixed inset-0 -z-10" />
}
