// Service Worker for emiliacabral.com
// Version passed via query param: sw.js?v=VERSION
var VERSION = new URL(self.location).searchParams.get('v') || '0';
var PREFETCH_CACHE = 'prefetch-' + VERSION;
var PAGES_CACHE = 'pages-' + VERSION;
var OWN_CACHES = [PREFETCH_CACHE, PAGES_CACHE];
var OFFLINE_URL = '/public/offline.html';

// Install: cache offline fallback page
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(PAGES_CACHE).then(function (cache) {
      return cache.add(OFFLINE_URL);
    })
  );
  self.skipWaiting();
});

// Activate: delete old version caches
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return !OWN_CACHES.includes(key); })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: intercept navigation requests only
self.addEventListener('fetch', function (event) {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(handleNavigation(event.request));
});

function handleNavigation(request) {
  // 1. Check prefetch cache (from hover preloading)
  return caches.open(PREFETCH_CACHE).then(function (prefetchCache) {
    return prefetchCache.match(request).then(function (prefetched) {
      if (prefetched) {
        // Move to pages cache for offline support, remove from prefetch
        caches.open(PAGES_CACHE).then(function (pagesCache) {
          pagesCache.put(request, prefetched.clone());
        });
        prefetchCache.delete(request);
        return prefetched;
      }

      // 2. Try network
      return fetch(request)
        .then(function (response) {
          if (response.ok) {
            caches.open(PAGES_CACHE).then(function (pagesCache) {
              pagesCache.put(request, response.clone());
            });
          }
          return response;
        })
        .catch(function () {
          // 3. Offline: try pages cache for previously visited pages
          return caches.open(PAGES_CACHE).then(function (pagesCache) {
            return pagesCache.match(request).then(function (cached) {
              if (cached) return cached;

              // 4. Last resort: offline fallback page
              return caches.match(OFFLINE_URL).then(function (offline) {
                return offline || new Response('Offline', { status: 503 });
              });
            });
          });
        });
    });
  });
}

// Message: handle prefetch requests from client
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'prefetch') {
    event.waitUntil(prefetchPage(event.data.url));
  }
});

function prefetchPage(url) {
  return caches.open(PREFETCH_CACHE).then(function (cache) {
    return cache.match(url).then(function (existing) {
      if (existing) return;
      return fetch(url).then(function (response) {
        if (response.ok) {
          return cache.put(url, response);
        }
      }).catch(function () {
        // Ignore prefetch failures silently
      });
    });
  });
}
