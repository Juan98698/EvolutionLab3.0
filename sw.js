const CACHE_NAME = 'evolution-lab-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/fondo.jpg',
  '/icon.png',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js'
];

// Instalar el Service Worker y almacenar activos estáticos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Precaching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activar y limpiar cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar peticiones y aplicar estrategias de caché
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // 1. Estrategia: Network-First (Red primero, si falla usar Caché) para archivos HTML (Planes de Clientes)
  // Esto asegura que si el entrenador actualiza la rutina, el cliente la vea inmediatamente al tener internet.
  // Pero si están en el gimnasio sin señal, cargará al instante desde la caché.
  if (
    event.request.mode === 'navigate' || 
    requestUrl.pathname.endsWith('.html') || 
    requestUrl.pathname.includes('/clientes/')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Guardar copia actualizada en caché
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Si falla la red (offline), servir desde caché
          return caches.match(event.request);
        })
    );
    return;
  }

  // 2. Estrategia: Cache-First para recursos estáticos y librerías CDN
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then(response => {
        // Almacenar en caché dinámicamente recursos no precacheados del mismo dominio
        if (
          response.status === 200 && 
          (requestUrl.origin === location.origin || requestUrl.href.includes('googleapis') || requestUrl.href.includes('gstatic') || requestUrl.href.includes('cdnjs') || requestUrl.href.includes('jsdelivr'))
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
