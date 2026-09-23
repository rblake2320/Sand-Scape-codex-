const CACHE = 'sandscape-v5-sculpture';
const ASSETS = [
  './js/sim-clock.js', './js/sculpture.js', './vendor/three/three.module.js', './vendor/three/three.core.js', './vendor/three/loaders/GLTFLoader.js', './vendor/three/utils/BufferGeometryUtils.js', './vendor/three/utils/SkeletonUtils.js', './assets/sculpture-circle.glb', './assets/sculpture-square.glb',
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/engine.js', './js/render.js', './js/palettes.js', './js/selftests.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).pathname.startsWith('/api/')) return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
