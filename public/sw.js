// This Service Worker is deactivated to prevent local caching.
// It immediately claims clients and bypasses caching to ensure real-time online updates.

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map(key => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

// Clean pass-through fetch with no cache matching
self.addEventListener('fetch', (e) => {
  // Let browser make standard network requests directly
  return;
});
