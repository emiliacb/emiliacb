// Activity logger: captures clicks, text selection and reading (dwell time
// normalized by word count, not raw scroll velocity), and persists it in
// localStorage under a stable visitorId, to feed the AI agent. Events carry
// the actual text involved (truncated and sanitized) since the point of the
// log is to be handed to an LLM — structural metadata alone isn't enough
// for the agent to react to *what* the visitor read or selected.
(function () {
  "use strict";

  // Debug flag: when true, also prints every captured event to the console
  // in addition to storing it. Not an env var — toggle it live from devtools
  // with `window.DEBUG_LOG = true`, or flip the default below.
  if (typeof window.DEBUG_LOG === "undefined") {
    window.DEBUG_LOG = false;
  }

  // Reuse the same cache-busting version the rest of the site already uses
  // (rendered server-side into <meta name="cache-version">) instead of a
  // separate ad hoc "_v1" suffix, so the log schema versions in lockstep
  // with everything else.
  function getSiteVersion() {
    var meta = document.querySelector('meta[name="cache-version"]');
    return (meta && meta.getAttribute("content")) || "unversioned";
  }

  var STORAGE_KEY = "activity_log_" + getSiteVersion();
  var VISITOR_KEY = "activity_visitor_id";
  var MAX_EVENTS = 500;
  var FLUSH_DEBOUNCE_MS = 2000;
  var FLUSH_MAX_BUFFER = 50;
  var SNIPPET_MAX_CHARS = 240;
  var SELECTION_MAX_CHARS = 400;

  var CONTENT_SELECTOR =
    ".markdown-content p, .markdown-content li, .markdown-content h1, " +
    ".markdown-content h2, .markdown-content h3, .markdown-content h4, " +
    ".markdown-content blockquote, main p, main li";

  var READ_BAND = [0.15, 0.75]; // viewport band where people actually read, not the whole viewport
  var WPM = 240; // reference reading speed, drives the per-block reading-pace threshold below
  var FALLBACK_MAX_READING_PX_S = 20; // used only if a block's line-height can't be read
  var IDLE_MS = 45000; // no interaction for this long = AFK, stop accruing dwell
  var MIN_DWELL_MS_TO_REPORT = 300;
  var RAGE_CLICK_WINDOW_MS = 1000;
  var RAGE_CLICK_COUNT = 3;
  var SELECTION_DEBOUNCE_MS = 400;
  var REPORT_INTERVAL_MS = 5000;

  // Collapses whitespace, strips control characters and hard-truncates —
  // this text eventually lands in an LLM prompt, so it's kept short and
  // clean at the source rather than trusted as-is downstream.
  function sanitizeText(text, maxChars) {
    var clean = (text || "").replace(/\s+/g, " ").trim();
    clean = clean.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    if (clean.length > maxChars) {
      clean = clean.slice(0, maxChars).trim() + "…";
    }
    return clean;
  }

  // "Where" for every event. document.title is NOT reliable here: the layout
  // appends a stylized-unicode brand mark to it, and on the homepage that
  // mark is the entire title — meaningless to an LLM. The rendered <h1> is
  // legible on every route, so it wins; title is only a fallback.
  var HEADING_SELECTOR = "h1, h2, h3, h4";

  function contentRoot() {
    return document.getElementById("content") || document.body;
  }

  // The markdown renderer injects a permalink link+icon inside h2-h4, so
  // textContent would carry that noise — strip it off a clone first.
  function headingText(h) {
    var clone = h.cloneNode(true);
    var anchors = clone.querySelectorAll("a");
    for (var i = 0; i < anchors.length; i++) {
      anchors[i].parentNode.removeChild(anchors[i]);
    }
    return sanitizeText(clone.textContent, 80);
  }

  function pageTitle() {
    var h1 = contentRoot().querySelector("h1");
    var fromH1 = h1 ? headingText(h1) : "";
    if (fromH1) return fromH1;
    var fromTitle = sanitizeText((document.title || "").split("|")[0], 80);
    return /[a-z0-9]/i.test(fromTitle) ? fromTitle : location.pathname;
  }

  // Location is a graph, not a string: each node is { read, from }, where
  // `from` is that node's own parent (or null at the page root). A block's
  // location is its nearest enclosing heading; that heading's own location
  // is *its* parent heading; and so on up to the page title. Built once per
  // content scan, walking the document in order with a stack of open
  // headings — marked renders headings as flat siblings of paragraphs, no
  // <section> wrappers, so a single pass is enough.
  var sectionIndex = new WeakMap();

  function pageRootNode() {
    return { read: pageTitle(), from: null };
  }

  function buildSectionIndex() {
    var nodes = contentRoot().querySelectorAll(HEADING_SELECTOR + ", " + CONTENT_SELECTOR);
    var stack = []; // { level, node }
    var root = pageRootNode();

    nodes.forEach(function (el) {
      var match = /^h([1-4])$/.exec(el.tagName.toLowerCase());
      var parent = stack.length ? stack[stack.length - 1].node : root;

      if (match) {
        var level = Number(match[1]);
        while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
        parent = stack.length ? stack[stack.length - 1].node : root;

        if (level === 1) {
          // h1 IS the page title (root already covers it) — no parent of its own.
          sectionIndex.set(el, null);
          return;
        }

        // This heading's own location is its parent's chain — never itself,
        // that's what was producing the same text twice in one event.
        sectionIndex.set(el, parent);
        stack.push({ level: level, node: { read: headingText(el), from: parent } });
        return;
      }

      sectionIndex.set(el, parent);
    });
  }

  // The parent-chain node for a given element, or the page root if the
  // element isn't under any heading (or isn't content at all, e.g. a nav
  // link) — every event still gets at least the page as its `from`.
  function locationOf(el) {
    var loc = el ? sectionIndex.get(el) : undefined;
    return loc !== undefined ? loc : pageRootNode();
  }

  function debugLog(evt) {
    if (window.DEBUG_LOG) {
      console.log("[activity]", evt);
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
      var stored = raw ? JSON.parse(raw) : { events: [] };
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

  // Every event is a small object whose key names the action itself (read /
  // click / selected / clicked_repeatedly) — no separate `type` field, the
  // key already says what happened, so there's nothing to duplicate. `from`
  // is always a parent-chain node (see locationOf), never a flattened string.
  function log(fields) {
    var evt = { id: Math.random().toString(36).slice(2), ts: Date.now() };
    for (var key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) evt[key] = fields[key];
    }
    buffer.push(evt);
    debugLog(evt);
    scheduleFlush();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);

  // ---- Clicks + rage click. Only interactive elements are logged, and only
  // by their semantic label (link/button text) — no tag names, ids, classes
  // or pixel coordinates, none of that means anything to an LLM ----
  var clickHistory = [];

  document.addEventListener(
    "click",
    function (e) {
      var target = e.target.closest ? e.target.closest("a, button, [role='button']") : null;
      if (!target) return;

      var label = sanitizeText(
        target.getAttribute("aria-label") || target.getAttribute("title") || target.textContent,
        80
      );
      if (!label) return;

      var now = Date.now();

      clickHistory.push({ id: label, ts: now });
      clickHistory = clickHistory.filter(function (c) {
        return now - c.ts < RAGE_CLICK_WINDOW_MS;
      });

      var sameTargetClicks = clickHistory.filter(function (c) {
        return c.id === label;
      });

      if (sameTargetClicks.length >= RAGE_CLICK_COUNT) {
        log({
          clicked_repeatedly: label,
          count: sameTargetClicks.length,
          from: locationOf(target),
        });
        clickHistory = [];
        return;
      }

      log({ click: label, from: locationOf(target) });
    },
    { passive: true }
  );

  // ---- Text selection: only over content, never over inputs. The selected
  // text is stored (sanitized + truncated) since it's the whole point of the
  // signal for the LLM — which words the visitor deliberately picked out ----
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

      log({ selected: sanitizeText(text, SELECTION_MAX_CHARS), from: locationOf(block) });
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

  // mousemove feeds both timestamps from one listener: lastInteraction (long
  // window, IDLE_MS) says the visitor is still here at all; lastMouseMoveTs
  // (short window, CURSOR_MOVING_WINDOW_MS) says the cursor is moving right
  // now, to tell "tracking the text while reading" apart from "parked the
  // mouse on a paragraph and looked away".
  var CURSOR_MOVING_WINDOW_MS = 400;
  var lastMouseMoveTs = 0;
  window.addEventListener(
    "mousemove",
    function () {
      var now = Date.now();
      lastInteraction = now;
      lastMouseMoveTs = now;
    },
    { passive: true }
  );

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

  // ---- Hover over content text: a stronger, more direct reading signal
  // than viewport position alone. Delegated on mouseover/mouseout (they
  // bubble, mouseenter/mouseleave don't) with a relatedTarget check so
  // moving between child nodes of the same block doesn't flicker it off ----
  var hoveredBlock = null;

  document.addEventListener(
    "mouseover",
    function (e) {
      hoveredBlock = e.target.closest ? e.target.closest(CONTENT_SELECTOR) : null;
    },
    { passive: true }
  );

  document.addEventListener(
    "mouseout",
    function (e) {
      if (!hoveredBlock) return;
      var to = e.relatedTarget;
      if (!to || !hoveredBlock.contains(to)) hoveredBlock = null;
    },
    { passive: true }
  );

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

  // How fast this specific block could scroll past while still being
  // readable at WPM pace — depends on its actual line height and word
  // density, not a flat guess. A block with bigger text tolerates a faster
  // scroll and still counts as "read"; dense small text doesn't.
  function maxReadingPxPerSec(el, words) {
    var cs = window.getComputedStyle(el);
    var lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || 24;
    var lines = Math.max(1, el.getBoundingClientRect().height / lineHeight);
    var wordsPerLine = words / lines;
    if (!wordsPerLine || !isFinite(wordsPerLine)) return FALLBACK_MAX_READING_PX_S;
    return (WPM / 60 / wordsPerLine) * lineHeight;
  }

  function registerBlocks() {
    buildSectionIndex();
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
        maxReadingPxPerSec: maxReadingPxPerSec(el, words),
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
    var focused = document.visibilityState === "visible" && document.hasFocus();

    if (focused && !idle) {
      var vh = window.innerHeight;
      var bandTop = vh * READ_BAND[0];
      var bandBottom = vh * READ_BAND[1];
      var dt = 16; // one frame, good enough for this signal
      // Date.now(), not the rAF timestamp — lastMouseMoveTs is wall-clock time.
      var cursorMoving = Date.now() - lastMouseMoveTs < CURSOR_MOVING_WINDOW_MS;

      blocks.forEach(function (b) {
        if (!b.visible || !b.rect) return;

        // Hovering the text WHILE the cursor is moving is a stronger signal
        // than mere position in the viewport band — tracking text with the
        // mouse means it's actually being read, regardless of scroll speed.
        if (b.el === hoveredBlock && cursorMoving) {
          b.qualifiedDwell += dt;
          return;
        }

        // Scrolling faster than this block's text could plausibly be read at
        // WPM pace means the visitor scrolled past it, not read it — a slow
        // scroll over dense small text can fail this just as a fast scroll
        // over big headings can pass it.
        if (Math.abs(vSmooth) > b.maxReadingPxPerSec) return;

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
        var snippet = sanitizeText(b.el.textContent, SNIPPET_MAX_CHARS);
        log({ read: snippet, from: locationOf(b.el) });
      }
    });
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
