// VisionOne Portal service worker: app shell cache + network-first API with offline fallback for GETs.
const CACHE = 'portal-v2'
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon.svg']))); self.skipWaiting() })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim() })
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  const isApi = url.pathname.startsWith('/api/')
  if (isApi && (url.pathname.includes('/backup') || url.pathname.includes('/export') || url.pathname.includes('/secret/'))) return
  e.respondWith(fetch(req).then((res) => {
    if (res.ok && (!isApi || url.pathname.startsWith('/api/r/') || url.pathname === '/api/dashboard' || url.pathname === '/api/calendar')) {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy))
    }
    return res
  }).catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/') : Response.error()))))
})
