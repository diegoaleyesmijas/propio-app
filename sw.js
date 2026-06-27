/**
 * Service Worker para Web Push — Barber Booking MVP
 * 
 * Gestiona notificaciones push entrantes y apertura del panel admin.
 * Se registra desde admin.html.
 */

self.addEventListener('install', (event) => {
  // Activar inmediatamente sin esperar a que se cierren las páginas antiguas
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Reclamar todas las páginas abiertas para controlar los fetch
  event.waitUntil(clients.claim())
})

// ── Push entrante ──
self.addEventListener('push', (event) => {
  let data = { title: 'Código de Caballeros', body: 'Nueva actividad', url: '/admin.html' }

  if (event.data) {
    try {
      data = event.data.json()
    } catch (e) {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: data.icon || '/logo-192.png',
    badge: data.badge || '/pwa-icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'notification',
    data: {
      url: data.url || '/admin.html',
      ...(data.data || {})
    },
    renotify: true,
    requireInteraction: true,
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Código de Caballeros', options)
  )
})

// ── Clic en la notificación ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/admin.html'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Si ya hay una ventana del panel abierta, la enfocamos
        for (const client of windowClients) {
          if (client.url.includes(urlToOpen) || client.url.includes('/admin.html')) {
            return client.focus()
          }
        }
        // Si no, abrimos nueva
        return clients.openWindow(urlToOpen)
      })
  )
})

// ── Fetch (passthrough mínimo — sin caché offline) ──
self.addEventListener('fetch', (event) => {
  // Por ahora solo pasamos las requests al servidor
  // En el futuro aquí se podría añadir caché offline
  event.respondWith(fetch(event.request))
})
