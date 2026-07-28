// Activity logger: captures clicks, text selection and reading (dwell time
// normalized by word count, not raw scroll velocity), and persists it in
// localStorage under a stable visitorId, to feed the AI agent. Never
// captures input values or selected text itself, only metadata (which
// block, how long, how many words).
(function () {
  "use strict";

  // Debug flag: when true, also prints every captured event to the console
  // in addition to storing it. Not an env var — toggle it live from devtools
  // with `window.DEBUG_LOG = true`, or flip the default below.
  if (typeof window.DEBUG_LOG === "undefined") {
    window.DEBUG_LOG = false;
  }

  var STORAGE_KEY = "activity_log_v1";
  var VISITOR_KEY = "activity_visitor_id";
  var MAX_EVENTS = 500;
  var FLUSH_DEBOUNCE_MS = 2000;
  var FLUSH_MAX_BUFFER = 50;

  var CONTENT_SELECTOR =
    ".markdown-content p, .markdown-content li, .markdown-content h1, " +
    ".markdown-content h2, .markdown-content h3, .markdown-content h4, " +
    ".markdown-content blockquote, main p, main li";

  var READ_BAND = [0.15, 0.75]; // viewport band where people actually read, not the whole viewport
  var WPM = 240; // reference reading speed
  var STATIONARY_PX_S = 20; // below this, scroll is considered "stationary"
  var IDLE_MS = 45000; // no interaction for this long = AFK, stop accruing dwell
  var MIN_DWELL_MS_TO_REPORT = 300;
  var RAGE_CLICK_WINDOW_MS = 1000;
  var RAGE_CLICK_COUNT = 3;
  var SELECTION_DEBOUNCE_MS = 400;
  var REREAD_WINDOW_MS = 10000;
  var REREAD_BACKTRACK_THRESHOLD = 0.15;
  var REPORT_INTERVAL_MS = 5000;

  function debugLog(type, evt) {
    if (window.DEBUG_LOG) {
      console.log("[activity]", type, evt);
    }
  }

  // ---- Visitor id, persisted across visits ----
  function getVisitorId() {
    try {
      var id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id =
          window.crypto && window.crypto.randomUUID
            ? window.crypto.randomUUID()
            : String(Date.now()) + "-" + Math.random().toString(36).slice(2);
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch (e) {
      return null;
    }
  }

  var visitorId = getVisitorId();

  // ---- In-memory buffer + flush to localStorage ----
  var buffer = [];
  var flushTimer = null;

  function scheduleFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    if (buffer.length >= FLUSH_MAX_BUFFER) {
      flush();
      return;
    }
    flushTimer = setTimeout(flush, FLUSH_DEBOUNCE_MS);
  }

  function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!buffer.length || !visitorId) return;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var stored = raw ? JSON.parse(raw) : { visitorId: visitorId, events: [] };
      stored.visitorId = visitorId;
      stored.events = stored.events.concat(buffer);
      if (stored.events.length > MAX_EVENTS) {
        stored.events = stored.events.slice(stored.events.length - MAX_EVENTS);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      buffer = [];
    } catch (e) {
      // Quota exceeded or storage unavailable: drop the buffer instead of
      // retrying in a loop against a full localStorage.
      buffer = [];
    }
  }

  function log(type, data) {
    var evt = {
      id: Math.random().toString(36).slice(2),
      type: type,
      ts: Date.now(),
      path: location.pathname,
      data: data || {},
    };
    buffer.push(evt);
    debugLog(type, evt);
    scheduleFlush();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);

  // ---- Clicks + rage click ----
  var clickHistory = [];

  document.addEventListener(
    "click",
    function (e) {
      var target = e.target.closest
        ? e.target.closest("[data-track-id], a, button")
        : null;
      var trackId = target
        ? target.getAttribute("data-track-id") || target.tagName.toLowerCase()
        : "unknown";
      var now = Date.now();

      clickHistory.push({ id: trackId, ts: now });
      clickHistory = clickHistory.filter(function (c) {
        return now - c.ts < RAGE_CLICK_WINDOW_MS;
      });

      var sameTargetClicks = clickHistory.filter(function (c) {
        return c.id === trackId;
      });

      if (sameTargetClicks.length >= RAGE_CLICK_COUNT) {
        log("rage_click", { target: trackId, count: sameTargetClicks.length });
        clickHistory = [];
        return;
      }

      log("click", { target: trackId, x: e.clientX, y: e.clientY });
    },
    { passive: true }
  );

  // ---- Text selection: only over content, never over inputs, and the
  // selected text itself is never stored, only the block and its length ----
  var selectionTimer = null;

  document.addEventListener("selectionchange", function () {
    if (selectionTimer) clearTimeout(selectionTimer);
    selectionTimer = setTimeout(function () {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      var text = sel.toString();
      if (!text || text.trim().length < 3) return;

      var anchorNode = sel.anchorNode;
      var container =
        anchorNode && anchorNode.nodeType === 3
          ? anchorNode.parentElement
          : anchorNode;
      var block = container ? container.closest(CONTENT_SELECTOR) : null;
      if (!block) return;

      log("select", {
        target: block.getAttribute("data-track-id") || block.tagName.toLowerCase(),
        length: text.length,
      });
    }, SELECTION_DEBOUNCE_MS);
  });

  // ---- Scroll velocity: a single rAF loop, smoothed with median + EMA ----
  var lastY = window.scrollY;
  var lastT = performance.now();
  var vSmooth = 0;
  var velocitySamples = [];
  var lastInteraction = Date.now();

  ["scroll", "keydown", "pointerdown", "wheel"].forEach(function (evtName) {
    window.addEventListener(
      evtName,
      function () {
        lastInteraction = Date.now();
      },
      { passive: true }
    );
  });

  function sampleScroll(now) {
    var dt = Math.max(1, now - lastT);
    var y = window.scrollY;
    var vInst = ((y - lastY) / dt) * 1000;

    velocitySamples.push(vInst);
    if (velocitySamples.length > 5) velocitySamples.shift();

    var sorted = velocitySamples.slice().sort(function (a, b) {
      return a - b;
    });
    var median = sorted[Math.floor(sorted.length / 2)];
    var alpha = 1 - Math.exp(-dt / 70);
    vSmooth = vSmooth + alpha * (median - vSmooth);

    lastT = now;
    lastY = y;
  }

  // ---- Backtrack / re-reading over a sliding window ----
  var scrollWindow = [];

  window.addEventListener(
    "scroll",
    function () {
      var now = Date.now();
      var delta = window.scrollY - lastY;
      scrollWindow.push({ t: now, delta: delta });
      scrollWindow = scrollWindow.filter(function (s) {
        return now - s.t < REREAD_WINDOW_MS;
      });
    },
    { passive: true }
  );

  function backtrackRatio() {
    var neg = 0;
    var total = 0;
    scrollWindow.forEach(function (s) {
      total += Math.abs(s.delta);
      if (s.delta < 0) neg += Math.abs(s.delta);
    });
    return total > 0 ? neg / total : 0;
  }

  // ---- Per-block reading classification: dwell weighted by presence in the
  // read band, normalized against the block's expected reading time
  // (words / WPM), not against raw scroll velocity ----
  var blocks = new Map();
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        var b = blocks.get(entry.target);
        if (!b) return;
        b.visible = entry.isIntersecting;
        b.rect = entry.boundingClientRect;
      });
    },
    { threshold: [0, 0.15, 0.5, 0.75, 1] }
  );

  function wordCount(el) {
    var text = (el.textContent || "").trim();
    return text ? text.split(/\s+/).length : 0;
  }

  function registerBlocks() {
    var els = document.querySelectorAll(CONTENT_SELECTOR);
    els.forEach(function (el) {
      if (blocks.has(el)) return;
      var words = wordCount(el);
      if (words < 5) return; // skip trivial blocks
      blocks.set(el, {
        el: el,
        words: words,
        qualifiedDwell: 0,
        visible: false,
        rect: null,
        reported: false,
      });
      observer.observe(el);
    });
  }

  function classify(b) {
    var expectedMs = (b.words / WPM) * 60000;
    var ratio = b.qualifiedDwell / expectedMs;
    if (ratio < 0.15) return "skipped";
    if (ratio < 0.5) return "skimmed";
    if (ratio <= 2.5) return "read";
    return "parked";
  }

  function tick(now) {
    sampleScroll(now);

    var idle = Date.now() - lastInteraction > IDLE_MS;
    var moving = Math.abs(vSmooth) > STATIONARY_PX_S;
    var focused = document.visibilityState === "visible" && document.hasFocus();

    if (focused && !idle && !moving) {
      var vh = window.innerHeight;
      var bandTop = vh * READ_BAND[0];
      var bandBottom = vh * READ_BAND[1];
      var dt = 16; // one frame, good enough for this signal

      blocks.forEach(function (b) {
        if (!b.visible || !b.rect) return;
        var overlap = Math.min(b.rect.bottom, bandBottom) - Math.max(b.rect.top, bandTop);
        if (overlap <= 0) return;
        var weight = overlap / Math.min(b.rect.height, bandBottom - bandTop);
        b.qualifiedDwell += dt * Math.max(0, Math.min(1, weight));
      });
    }

    requestAnimationFrame(tick);
  }

  function reportBlocks() {
    blocks.forEach(function (b) {
      if (b.reported || b.qualifiedDwell < MIN_DWELL_MS_TO_REPORT) return;
      var cls = classify(b);
      if (cls === "read" || cls === "parked") {
        b.reported = true;
        log("read_block", {
          target: b.el.getAttribute("data-track-id") || b.el.tagName.toLowerCase(),
          classification: cls,
          dwellMs: Math.round(b.qualifiedDwell),
          words: b.words,
        });
      }
    });

    var bt = backtrackRatio();
    if (bt > REREAD_BACKTRACK_THRESHOLD) {
      log("reread", { backtrackRatio: Number(bt.toFixed(2)) });
    }
  }

  setInterval(reportBlocks, REPORT_INTERVAL_MS);
  window.addEventListener("pagehide", reportBlocks);

  // ---- Init ----
  registerBlocks();
  requestAnimationFrame(tick);

  // Pick up new blocks if content changes without a full page reload
  var mutationObserver = new MutationObserver(function () {
    registerBlocks();
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  // Exposed for debugging from devtools regardless of DEBUG_LOG, since
  // toggling the flag live is only useful if there's something to inspect.
  window.__activityLogger = { flush: flush, blocks: blocks, visitorId: visitorId };
})();
