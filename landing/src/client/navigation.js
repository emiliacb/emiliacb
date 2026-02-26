// Register Service Worker with cache version as query param
if ('serviceWorker' in navigator) {
  var meta = document.querySelector('meta[name="cache-version"]');
  var v = meta ? meta.content : '';
  navigator.serviceWorker.register('/sw.js?v=' + v);
}

// Prefetch pages on hover via Service Worker
(function () {
  var prefetched = {};

  function getHref(el) {
    var link = el.closest('a[href]');
    if (!link) return null;
    var href = link.getAttribute('href');
    if (
      !href ||
      href.startsWith('http') ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href === window.location.pathname
    )
      return null;
    return href;
  }

  document.addEventListener(
    'pointerenter',
    function (e) {
      var href = getHref(e.target);
      if (!href || prefetched[href]) return;
      prefetched[href] = true;

      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'prefetch',
          url: href,
        });
      }
    },
    true
  );
})();

// Loading bar on navigation
(function () {
  var bar = document.getElementById('loading-bar');
  if (!bar) return;

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (
      !href ||
      href.startsWith('http') ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')
    )
      return;

    bar.classList.add('loading');
  });
})();
