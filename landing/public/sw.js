// Version passed via query param: sw.js?v=VERSION
var VERSION = new URL(self.location).searchParams.get('v') || '0';
var PREFETCH_CACHE = 'prefetch-' + VERSION;
var PAGES_CACHE = 'pages-' + VERSION;
var OWN_CACHES = [PREFETCH_CACHE, PAGES_CACHE];
var OFFLINE_URL = '/public/offline.html';
// How long a prefetched page stays usable. Must match PREFETCH_TTL in
// src/client/navigation.js.
var PREFETCH_TTL = 60000;
var PREFETCHED_AT_HEADER = 'x-prefetched-at';
// Prefetches still running, by absolute URL.
var inflight = {};

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
  // 1. A page prefetched moments ago (see src/client/navigation.js). A
  //    prefetch still on its way is waited for instead of fetched twice.
  return (inflight[request.url] || Promise.resolve())
    .then(function () {
      return takePrefetched(request);
    })
    .then(function (prefetched) {
      if (prefetched) return prefetched;

      // 2. Try network
      return fetch(request)
        .then(function (response) {
          if (response.ok) {
            // Clone synchronously before body is consumed
            var responseClone = response.clone();
            caches.open(PAGES_CACHE).then(function (pagesCache) {
              pagesCache.put(request, responseClone);
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
}

// The prefetched copy of a page, or undefined. A copy is used once: it moves
// to the pages cache for offline support. One older than PREFETCH_TTL is
// dropped, so a page prefetched and never opened cannot come back stale later.
function takePrefetched(request) {
  return caches.open(PREFETCH_CACHE).then(function (prefetchCache) {
    return prefetchCache.match(request).then(function (prefetched) {
      if (!prefetched) return;
      prefetchCache.delete(request);
      if (!isFresh(prefetched)) return;

      // Clone synchronously before body is consumed
      var prefetchedClone = prefetched.clone();
      caches.open(PAGES_CACHE).then(function (pagesCache) {
        pagesCache.put(request, prefetchedClone);
      });
      return prefetched;
    });
  });
}

function isFresh(prefetched) {
  var at = Number(prefetched.headers.get(PREFETCHED_AT_HEADER));
  return Date.now() - at < PREFETCH_TTL;
}

// Message: handle prefetch requests from client
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'prefetch') {
    event.waitUntil(prefetchPage(event.data.url));
  }
});

function prefetchPage(url) {
  var key = new URL(url, self.location).href;
  if (inflight[key]) return inflight[key];

  var done = function () {
    delete inflight[key];
  };
  inflight[key] = caches
    .open(PREFETCH_CACHE)
    .then(function (cache) {
      return cache.match(key).then(function (existing) {
        if (existing && isFresh(existing)) return;
        return fetch(key).then(function (response) {
          // A redirected response cannot answer a navigation, so it is skipped.
          if (!response.ok || response.redirected) return;
          var headers = new Headers(response.headers);
          headers.set(PREFETCHED_AT_HEADER, String(Date.now()));
          return response.blob().then(function (body) {
            return cache.put(
              key,
              new Response(body, {
                status: response.status,
                statusText: response.statusText,
                headers: headers,
              })
            );
          });
        });
      });
    })
    .catch(function () {
      // Ignore prefetch failures silently
    })
    .then(done);
  return inflight[key];
}
