const CACHE_NAME = 'hcl-cache-v1';
const ASSETS = [
  '/',
  '/webapp/index.html',
  '/webapp/assets/style.css',
  '/webapp/assets/shared.js',
  '/webapp/assets/sidebar.js',
  '/webapp/pages/login.html',
  '/webapp/pages/dashboard.html',
  '/webapp/pages/analytics.html'
];

// Install Event - Caching Assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Fetch Event - Serve from Cache, fall back to Network
self.addEventListener('fetch', (e) => {
  // Exclude Firebase Firestore/Auth calls from simple caching
  if (e.request.url.includes('firestore.googleapis') || e.request.url.includes('identitytoolkit')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
