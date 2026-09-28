// Habit Tracker offline shell. Rewritten on every production build (see scripts/stamp-service-worker.mjs)
// so the browser's own byte-comparison update check fires a real install/waiting cycle.
const PRECACHE_NAME = 'habit-tracker-precache'
const RUNTIME_NAME = 'habit-tracker-runtime'
const SHELL_URLS = ['/', '/today', '/privacy']
const ASSET_TAG_PATTERN = /<(?:script|link)\b[^>]*?\s(?:src|href)="([^"]+)"[^>]*>/g

function isApiRequest(url) {
  return url.pathname.startsWith('/api/')
}

// Only these paths are content-addressed/static (hashed build assets, icons, the manifest) and safe to
// cache indefinitely. Everything else — notably the dev server's unbundled, un-hashed module URLs — can
// change at the same URL between requests, so it must always go to the network uncached.
function isImmutableAsset(url) {
  return url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest'
}

// Fetched one at a time, never in a burst: this runs automatically on every install, and a pile of
// concurrent same-origin requests can queue up behind (or starve) a request the User is actively
// waiting on right after load, such as the sign-in redirect. A slower install is an acceptable trade.
async function precacheShell() {
  await caches.delete(PRECACHE_NAME)
  const cache = await caches.open(PRECACHE_NAME)
  const assetUrls = new Set()
  for (const shellUrl of SHELL_URLS) {
    try {
      const response = await fetch(shellUrl, { cache: 'no-store' })
      if (!response || !response.ok) continue
      const html = await response.clone().text()
      await cache.put(shellUrl, response)
      for (const match of html.matchAll(ASSET_TAG_PATTERN)) {
        const href = match[1]
        if (href && href.startsWith('/') && isImmutableAsset(new URL(href, self.location.origin))) assetUrls.add(href)
      }
    } catch {
      // Offline install (or a route that failed to render); the shell stays whatever was cached before.
    }
  }
  for (const assetUrl of assetUrls) {
    try {
      const assetResponse = await fetch(assetUrl, { cache: 'no-store' })
      if (assetResponse && assetResponse.ok) await cache.put(assetUrl, assetResponse)
    } catch {
      // Best-effort precache; the runtime cache picks up anything missed here on its next request.
    }
  }
}

self.addEventListener('install', event => {
  event.waitUntil(precacheShell())
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

async function respondToNavigation(request) {
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const cache = await caches.open(PRECACHE_NAME)
      void cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true })
    return cached || (await caches.match('/today')) || (await caches.match('/'))
  }
}

async function respondCacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) {
    const cache = await caches.open(RUNTIME_NAME)
    void cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || isApiRequest(url)) return

  if (request.mode === 'navigate') {
    event.respondWith(respondToNavigation(request))
    return
  }
  if (isImmutableAsset(url)) event.respondWith(respondCacheFirst(request))
})
