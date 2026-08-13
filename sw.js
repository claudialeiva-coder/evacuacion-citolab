// Service Worker — Evacuación Citolab
// Estrategia: stale-while-revalidate para el shell de la app.
// Sube CACHE_VERSION cada vez que subas una nueva versión de index.html,
// para forzar que los teléfonos ya instalados descarguen la actualización.
const CACHE_VERSION = 'v3';
const CACHE_NAME = 'evac-citolab-' + CACHE_VERSION;

const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith('evac-citolab-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Nunca cachear el CSV de Sheets ni ningún request a otro dominio:
  // eso siempre debe ir directo a la red (o fallar limpio si no hay señal).
  // El fallback offline de la nómina lo maneja localStorage, no el Service Worker.
  if (new URL(req.url).origin !== self.location.origin) {
    return; // deja que el navegador maneje el request normalmente
  }

  if (req.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      // Estrategia: responde con caché de inmediato si existe (rápido, funciona sin señal);
      // en paralelo actualiza el caché en segundo plano para la próxima vez.
      return cached || network || caches.match('./index.html');
    })
  );
});
