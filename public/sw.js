// OHRR app — the offline cache. Lets the app open, and the Counter and Door
// screens work, when a phone has no signal (the BunFest hall, the back of the
// Hop Shop). It never gets in the way of fresh content:
//
//   pages     network first; the last good copy only when there's no network
//   /assets/  the built files have a fingerprint in their name, so a copy is
//             always the right copy: served from the cache, fetched once
//   other     network first, cached copy as the fallback
//
// Nothing from other sites is touched — the database, fonts and maps always
// go straight to the network.
//
// It also shows phone notifications (update 32 — web push, sent by the
// ohrr-jobs function as { title, body, url, tag }) and opens their link when
// one is tapped.
const CACHE = 'ohrr-app-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

const put = async (req, res) => {
  if (!res || !res.ok || res.type === 'opaque') return
  const cache = await caches.open(CACHE)
  await cache.put(req, res)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          event.waitUntil(put('/index.html', res.clone()))
          return res
        })
        .catch(async () => (await caches.match('/index.html')) || Response.error()),
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            event.waitUntil(put(req, res.clone()))
            return res
          }),
      ),
    )
    return
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        event.waitUntil(put(req, res.clone()))
        return res
      })
      .catch(async () => (await caches.match(req)) || Response.error()),
  )
})

// A notification arrives: show it, even with the app closed.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Ohio House Rabbit Rescue'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/ohrr-mark.png',
      // Android's status-bar icon: one colour, drawn from the transparency.
      badge: '/ohrr-badge.png',
      tag: data.tag || undefined,
      data: { url: data.url || '/' },
    }),
  )
})

// Tapped: bring an open OHRR window to the front on that page, or open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin)
  event.waitUntil(
    (async () => {
      if (target.origin === self.location.origin) {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        const client = windows.find((c) => new URL(c.url).origin === self.location.origin)
        if (client) {
          await client.focus().catch(() => undefined)
          if (client.url === target.href) return
          // Only a window this worker controls can be sent elsewhere; otherwise open a new one.
          const moved = 'navigate' in client ? await client.navigate(target.href).catch(() => null) : null
          if (moved) return
        }
      }
      await self.clients.openWindow(target.href)
    })(),
  )
})
