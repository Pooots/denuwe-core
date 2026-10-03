import type { AppPlatform } from '@/lib/platform'

function storeUrl(value: unknown): string {
  const url = String(value ?? '').trim()
  return url.startsWith('https://') ? url : ''
}

/**
 * Native app links (Microsoft Store or a Windows installer, Google Play, Apple App Store).
 * While a link is empty, its "Download" button installs denuwe as a web app (PWA) instead.
 * Set them with VITE_APP_DOWNLOAD_URL_PC / _ANDROID / _IOS (https only) — no UI changes needed.
 */
export const APP_DOWNLOAD_URLS: Record<AppPlatform, string> = {
  pc: storeUrl(import.meta.env.VITE_APP_DOWNLOAD_URL_PC),
  android: storeUrl(import.meta.env.VITE_APP_DOWNLOAD_URL_ANDROID),
  ios: storeUrl(import.meta.env.VITE_APP_DOWNLOAD_URL_IOS),
}

/** Shown under a button once its native link is set. */
export const APP_STORE_NAMES: Record<AppPlatform, string> = {
  pc: 'Windows app',
  android: 'Google Play',
  ios: 'App Store',
}
