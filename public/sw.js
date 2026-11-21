// CleenDee service worker: shows phone pop-ups (Web Push) and opens the right page when tapped.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', e => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { title: e.data ? e.data.text() : 'CleenDee' } }
  e.waitUntil(self.registration.showNotification(d.title || 'CleenDee', {
    body: d.body || '', tag: d.tag, renotify: !!d.tag, data: { link: d.link || '/' },
    icon: '/brand/CleenDee_navy_192.png', badge: '/brand/CleenDee_navy_192.png',
  }))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = new URL(e.notification.data?.link || '/', self.location.origin).href
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) if (w.url.startsWith(self.location.origin)) { await w.focus(); return w.navigate(url) }
    return self.clients.openWindow(url)
  })())
})
