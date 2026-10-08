// Register Service Worker with build id as query param
if ('serviceWorker' in navigator) {
  var meta = document.querySelector('meta[name="build-id"]');
  var v = meta ? meta.content : '';
  navigator.serviceWorker.register('/sw.js?v=' + v);
}

// Prefetch pages on hover via Service Worker
(function () {
  if (
    window.HTMLScriptElement &&
    typeof window.HTMLScriptElement.supports === 'function' &&
    window.HTMLScriptElement.supports('speculationrules')
  ) {
    return;
  }

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

// Language switcher: remember an explicit choice in a cookie. "/" picks the
// language from this cookie before Accept-Language, so the choice sticks.
(function () {
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[data-set-lang]');
    if (!link) return;
    var lang = link.getAttribute('data-set-lang');
    document.cookie = 'lang=' + lang + '; path=/; max-age=31536000; samesite=lax';
  });
})();
