// Register Service Worker with build id as query param
if ('serviceWorker' in navigator) {
  var meta = document.querySelector('meta[name="build-id"]');
  var v = meta ? meta.content : '';
  navigator.serviceWorker.register('/sw.js?v=' + v);
}

// Prefetch pages before the click, into the Service Worker's prefetch cache.
// Two triggers:
//  - intent: the mouse's path is projected ahead and the link it is about to
//    reach is fetched before the pointer gets there (every browser)
//  - hover: only where Speculation Rules are missing; browsers that have them
//    prerender on hover from the rules in the layout, and that prerender is
//    served from the prefetch cache
(function () {
  if (navigator.connection && navigator.connection.saveData) return;

  // Must match PREFETCH_TTL in public/sw.js: after this the Service Worker
  // drops the copy, so the page may be asked for again.
  var PREFETCH_TTL = 60000;
  var requestedAt = {};

  // The page a link leads to ("/en/about"), or null when it should not be
  // prefetched. Same exclusions as the speculation rules in the layout.
  function pageOf(link) {
    if (
      link.origin !== window.location.origin ||
      link.target === '_blank' ||
      link.hasAttribute('download') ||
      link.hasAttribute('data-no-prerender') ||
      link.relList.contains('nofollow') ||
      link.pathname.startsWith('/public/')
    )
      return null;
    var page = link.pathname + link.search;
    if (page === window.location.pathname + window.location.search) return null;
    return page;
  }

  function prefetch(page) {
    var now = Date.now();
    if (now - (requestedAt[page] || -PREFETCH_TTL) < PREFETCH_TTL) return;
    // On a first visit the Service Worker is not in control yet. The page is
    // left unmarked so the next signal tries again.
    var sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!sw) return;
    requestedAt[page] = now;
    sw.postMessage({ type: 'prefetch', url: page });
  }

  // --- Hover ---
  var hasSpeculationRules =
    window.HTMLScriptElement &&
    typeof window.HTMLScriptElement.supports === 'function' &&
    window.HTMLScriptElement.supports('speculationrules');

  if (!hasSpeculationRules) {
    document.addEventListener(
      'pointerenter',
      function (e) {
        var link = e.target.closest && e.target.closest('a[href]');
        var page = link && pageOf(link);
        if (page) prefetch(page);
      },
      true
    );
  }

  // --- Intent ---
  var HORIZON = 250; // ms the current velocity is projected ahead
  var MIN_SPEED = 0.2; // px/ms; slower than this the hover gets there in time
  var SLOP = 10; // px of tolerance around each link
  var CONFIRM = 40; // ms a link must stay the predicted target
  var SMOOTHING = 0.5; // weight of the newest sample in the velocity
  var RECTS_MAX_AGE = 500; // ms the measured link positions are trusted

  var targets = []; // on-screen links: { page, left, top, right, bottom }
  var targetsAt = -RECTS_MAX_AGE;
  var latest = null; // newest pointer sample: { x, y, t }
  var previous = null; // the sample the last frame used
  var vx = 0;
  var vy = 0;
  var predicted = null;
  var predictedSince = 0;
  var frame = 0;

  function measureTargets(now) {
    targets = [];
    targetsAt = now;
    var links = document.links;
    for (var i = 0; i < links.length; i++) {
      var page = pageOf(links[i]);
      if (!page) continue;
      // Links inside closed menus keep their box, so the box alone would make
      // an invisible link a target.
      if (
        links[i].checkVisibility &&
        !links[i].checkVisibility({ opacityProperty: true, visibilityProperty: true })
      )
        continue;
      var rect = links[i].getBoundingClientRect();
      if (
        !rect.width ||
        !rect.height ||
        rect.bottom < 0 ||
        rect.right < 0 ||
        rect.top > window.innerHeight ||
        rect.left > window.innerWidth
      )
        continue;
      targets.push({
        page: page,
        left: rect.left - SLOP,
        top: rect.top - SLOP,
        right: rect.right + SLOP,
        bottom: rect.bottom + SLOP,
      });
    }
  }

  // How far along the path from (x, y) to (x + dx, y + dy) it enters the box,
  // from 0 (already inside) to 1 (at the very end), or -1 when it misses.
  function entry(x, y, dx, dy, box) {
    var start = 0;
    var end = 1;
    var axes = [
      [x, dx, box.left, box.right],
      [y, dy, box.top, box.bottom],
    ];
    for (var i = 0; i < 2; i++) {
      var pos = axes[i][0];
      var delta = axes[i][1];
      var min = axes[i][2];
      var max = axes[i][3];
      if (delta === 0) {
        if (pos < min || pos > max) return -1;
        continue;
      }
      var a = (min - pos) / delta;
      var b = (max - pos) / delta;
      start = Math.max(start, Math.min(a, b));
      end = Math.min(end, Math.max(a, b));
      if (start > end) return -1;
    }
    return start;
  }

  function forget() {
    predicted = null;
  }

  function onFrame() {
    frame = 0;
    var sample = latest;
    var last = previous;
    previous = sample;
    if (!last) return;

    var dt = sample.t - last.t;
    if (dt <= 0) return;
    if (dt > 100) {
      // The mouse rested: what it did before says nothing about where it goes.
      vx = vy = 0;
      return forget();
    }
    vx += SMOOTHING * ((sample.x - last.x) / dt - vx);
    vy += SMOOTHING * ((sample.y - last.y) / dt - vy);
    if (Math.sqrt(vx * vx + vy * vy) < MIN_SPEED) return forget();

    if (sample.t - targetsAt > RECTS_MAX_AGE) measureTargets(sample.t);

    // The first link the projected path runs into.
    var hit = null;
    var hitAt = 2;
    for (var i = 0; i < targets.length; i++) {
      var at = entry(sample.x, sample.y, vx * HORIZON, vy * HORIZON, targets[i]);
      if (at >= 0 && at < hitAt) {
        hit = targets[i].page;
        hitAt = at;
      }
    }
    if (!hit) return forget();

    if (hit !== predicted) {
      predicted = hit;
      predictedSince = sample.t;
    }
    if (sample.t - predictedSince >= CONFIRM) prefetch(hit);
  }

  document.addEventListener(
    'pointermove',
    function (e) {
      // Touch has no path to read, and a drag is not a walk towards a link.
      if (e.pointerType !== 'mouse' || e.buttons) return;
      latest = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      if (!frame) frame = requestAnimationFrame(onFrame);
    },
    { passive: true }
  );

  function invalidateTargets() {
    targetsAt = -RECTS_MAX_AGE;
  }
  window.addEventListener('scroll', invalidateTargets, { passive: true, capture: true });
  window.addEventListener('resize', invalidateTargets, { passive: true });
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
