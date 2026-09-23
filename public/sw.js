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
