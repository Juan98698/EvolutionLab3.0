// Custom Service Worker para Evolution Lab 3.0 — Push Notifications Handler
// Este archivo es inyectado por vite-plugin-pwa como SW adicional al generado por Workbox.

// Manejar notificaciones push entrantes
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Evolution Lab';
    const options = {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: data.url || '/dashboard'
      },
      vibrate: [200, 100, 200],
      tag: 'evolution-lab-notification',
      renotify: true
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('[SW] Error al procesar notificación push:', err);
  }
});

// Manejar clic en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana/pestaña abierta, enfocarla y navegar
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Si no hay ninguna ventana abierta, abrir una nueva
      return self.clients.openWindow(url);
    })
  );
});
