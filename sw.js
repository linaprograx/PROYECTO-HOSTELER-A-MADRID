const CACHE_NAME = 'barops-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event: cachear assets estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('Cache addAll error:', err);
        // Continuar incluso si algunos archivos fallan
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event: limpiar caches antiguos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: cache-first para assets, network-first para API
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Network-first para API calls (Supabase, etc)
  if (url.pathname.includes('/rest/') || url.pathname.includes('/realtime')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cachear respuestas exitosas
          if (response.ok) {
            const cache = caches.open(CACHE_NAME);
            cache.then(c => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Si falla y no hay caché, mostrar página offline
          return caches.match(request)
            .then(cached => cached || caches.match('/'))
            .then(response => response || new Response(
              getOfflineHTML(),
              { headers: { 'Content-Type': 'text/html' } }
            ));
        })
    );
  } else {
    // Cache-first para assets estáticos
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request)
          .then(response => {
            if (response && response.status === 200) {
              const cache = caches.open(CACHE_NAME);
              cache.then(c => c.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => {
            // Fallback para assets
            if (request.destination === 'image') {
              return new Response('', { status: 404 });
            }
            return caches.match('/');
          });
      })
    );
  }
});

// HTML de fallback offline
function getOfflineHTML() {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BarOps — Sin conexión</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0A0A0A;
      color: #E8E8E8;
      font-family: 'Courier New', monospace;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 30px;
      background: #FF6B35;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      font-weight: bold;
      color: #0A0A0A;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 12px;
      letter-spacing: 1px;
    }
    p {
      font-size: 14px;
      color: #888888;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .status {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      font-size: 12px;
      color: #FF6B35;
      letter-spacing: 2px;
    }
    .dot {
      width: 8px;
      height: 8px;
      background: #FF6B35;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    button {
      padding: 12px 24px;
      background: #FF6B35;
      border: none;
      border-radius: 6px;
      color: #0A0A0A;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 1.5px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">B</div>
    <h1>SIN CONEXIÓN</h1>
    <div class="status">
      <span class="dot"></span>
      ESPERANDO RED
    </div>
    <p>BarOps necesita conexión a internet para sincronizar datos con el servidor. Verifica tu conexión y vuelve a intentar.</p>
    <button onclick="location.reload()">REINTENTAR</button>
  </div>
</body>
</html>
  `;
}
