export type DeviceOS = 'windows' | 'macos' | 'linux' | 'chromeos' | 'android' | 'iphone' | 'ipad' | 'unknown'
export type DeviceBrowser = 'edge' | 'chrome' | 'samsung' | 'opera' | 'firefox' | 'safari' | 'other'
/** Where denuwe can be installed: a computer, an Android device, or an iPhone/iPad. */
export type AppPlatform = 'pc' | 'android' | 'ios'

export type Device = { os: DeviceOS; browser: DeviceBrowser; platform: AppPlatform | null }

function detectOS(ua: string): DeviceOS {
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPod/i.test(ua)) return 'iphone'
  // iPadOS 13+ asks for desktop sites and reports itself as a Mac; touch support gives it away.
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ipad'
  if (/Windows/i.test(ua)) return 'windows'
  if (/CrOS/i.test(ua)) return 'chromeos'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos'
  if (/Linux|X11/i.test(ua)) return 'linux'
  return 'unknown'
}

function detectBrowser(ua: string): DeviceBrowser {
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'edge'
  if (/SamsungBrowser\//.test(ua)) return 'samsung'
  if (/OPR\/|Opera|OPiOS/.test(ua)) return 'opera'
  if (/Firefox\/|FxiOS\//.test(ua)) return 'firefox'
  if (/Chrome\/|CriOS\//.test(ua)) return 'chrome'
  if (/Safari\//.test(ua)) return 'safari'
  return 'other'
}

const PLATFORM_BY_OS: Record<DeviceOS, AppPlatform | null> = {
  windows: 'pc',
  macos: 'pc',
  linux: 'pc',
  chromeos: 'pc',
  android: 'android',
  iphone: 'ios',
  ipad: 'ios',
  unknown: null,
}

let cached: Device | null = null

/** The visitor's OS, browser and matching install platform (from the user agent; never sent anywhere). */
export function detectDevice(): Device {
  if (cached) return cached
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const os = detectOS(ua)
  cached = { os, browser: detectBrowser(ua), platform: PLATFORM_BY_OS[os] }
  return cached
}
