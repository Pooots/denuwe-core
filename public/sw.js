/*
 * denuwe service worker: makes denuwe installable and keeps the app shell usable when the network drops.
 * It never touches API calls, uploads or real-time traffic, and always prefers the network for pages,
 * so a deploy is picked up on the next load.
 */
const SHELL_CACHE = 'denuwe-shell-v1'
const ASSET_CACHE = 'denuwe-assets-v1'
const KNOWN_CACHES = [SHELL_CACHE, ASSET_CACHE]
/** Built files are content-hashed, so old ones are only trimmed, never revalidated. */
const MAX_ASSETS = 120
const SHELL_URL = '/'
const PRECACHE = [SHELL_URL, '/manifest.webmanifest', '/denuwe-mark.png', '/icons/icon-192.png', '/icons/icon-512.png']
/** Same-origin paths that must always go straight to the network (Laravel API, uploads, dev tooling). */
const BYPASS = ['/api/', '/storage/', '/broadcasting/', '/@', '/src/', '/node_modules/']
const STATIC_FILES = ['/manifest.webmanifest', '/denuwe-mark.png', '/denuwe-wordmark.jpg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // One missing file must not block installing the worker.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('denuwe-') && !KNOWN_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (BYPASS.some((prefix) => url.pathname.startsWith(prefix))) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstAsset(request))
  } else if (url.pathname.startsWith('/icons/') || STATIC_FILES.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})

async function networkFirstPage(request) {
  try {
    const response = await fetch(request)
    const type = response.headers.get('content-type') || ''
    if (response.ok && response.type === 'basic' && type.includes('text/html')) {
      const cache = await caches.open(SHELL_CACHE)
      await cache.put(SHELL_URL, response.clone())
    }
    return response
  } catch {
    // Every route is the same single-page app, so the saved shell can render any of them.
    return (await caches.match(SHELL_URL)) || offlinePage()
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(ASSET_CACHE)
    await cache.put(request, response.clone())
    trim(cache)
  }
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok && response.type === 'basic') void cache.put(request, response.clone())
      return response
    })
    .catch(() => undefined)
  return cached || (await fresh) || Response.error()
}

async function trim(cache) {
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)))
}

function offlinePage() {
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>denuwe</title></head>' +
      '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7fc;color:#12172b;font-family:system-ui,sans-serif;text-align:center">' +
      '<main><img src="/icons/icon-192.png" alt="" width="64" height="64"><h1 style="font-size:20px;margin:16px 0 4px">You’re offline</h1>' +
      '<p style="margin:0;color:#6b7290;font-size:14px">Reconnect to the internet to keep using denuwe.</p></main></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
