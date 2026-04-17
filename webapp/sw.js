const CACHE_NAME = 'hcl-cache-v2';
const ASSETS = [
  '/index.html',
  '/manifest.json',
  '/assets/style.css',
  '/assets/shared.js',
  '/assets/sidebar.js',
  '/assets/chart.js',
  '/assets/firebase_config.js',
  '/pages/login.html',
  '/pages/dashboard.html',
  '/pages/analytics.html',
  '/pages/new_booking.html',
  '/pages/patient_history.html',
  '/pages/patient_history_new.html',
  '/pages/pending_results.html',
  '/pages/print_receipt.html',
  '/pages/print_report.html',
  // Add icons and images if needed
  // '/assets/image.png',
];

// Install Event - Caching Assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Serve from Cache, fall back to Network, offline fallback for navigation
self.addEventListener('fetch', (e) => {
  // Exclude Firebase Firestore/Auth calls from simple caching
  if (e.request.url.includes('firestore.googleapis') || e.request.url.includes('identitytoolkit')) {
    return;
  }

  if (e.request.mode === 'navigate') {
    // Navigation fallback
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/webapp/pages/login.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request).then((networkResponse) => {
        // Optionally cache new requests here
        return networkResponse;
      });
    })
  );
});
