// Service worker de Nitakitos: recibe las notificaciones push (FCM) y las muestra,
// también con la app cerrada. Las envían las Cloud Functions (functions/src/index.ts).

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event))
})

async function handlePush(event) {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { data: { title: 'Nitakitos', body: event.data ? event.data.text() : '' } }
  }
  // FCM envía { data: {...}, from, fcmMessageId… }
  const data = payload.data || payload
  const title = data.title || 'Nitakitos'

  // Si la app está abierta y en primer plano, los cambios ya se ven en vivo:
  // no hace falta avisar de la actividad (los recordatorios sí se muestran siempre).
  if (data.kind === 'activity') {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (windows.some((w) => w.visibilityState === 'visible' && w.focused)) return
  }

  await self.registration.showNotification(title, {
    body: data.body || '',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    vibrate: data.kind === 'reminder' ? [80, 60, 80, 60, 160] : [60],
    data: { url: data.url || '/' },
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })(),
  )
})
