// Activity logger: captures clicks, text selection and reading (dwell time
// normalized by word count, not raw scroll velocity), and persists it in
// localStorage under a per-tab session id, to feed the AI agent. Events carry
// the actual text involved (truncated and sanitized) since the point of the
// log is to be handed to an LLM — structural metadata alone isn't enough
// for the agent to react to *what* the visitor read or selected.
//
// Reading is recorded at two different resolutions, because the two signals
// behind it know different things. Cursor dwell over a block knows *where*
// the visitor was looking, so it can quote the passage: that's the per-block
// `read` event. Dwell that comes from a block merely sitting on screen while
// the page scrolls slowly enough to be readable knows only that the page went
// by at a readable pace — it cannot point at a passage, so it rolls up into a
// single page-level `read_page` event that reports coverage and quotes
// nothing.
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

  var STORAGE_KEY = "activity_logs";
  var SESSION_KEY = "activity_session_id";
  var PREVIOUS_PAGE_KEY = "activity_previous_page";
  var MAX_EVENTS = 500;
  var FLUSH_DEBOUNCE_MS = 2000;
  var FLUSH_MAX_BUFFER = 50;
  var SNIPPET_MAX_CHARS = 240;
  var SELECTION_MAX_CHARS = 400;

  var CONTENT_SELECTOR =
    ".markdown-content p, .markdown-content li, .markdown-content h1, " +
    ".markdown-content h2, .markdown-content h3, .markdown-content h4, " +
    ".markdown-content blockquote, main p, main li";

  var WPM = 240; // reference reading speed, drives the per-block reading-pace threshold below
  var FALLBACK_MAX_READING_PX_S = 20; // used only if a block's line-height can't be read
  var IDLE_MS = 45000; // no interaction for this long = AFK, stop accruing dwell
  var MIN_DWELL_MS_TO_REPORT = 300;
  var RAGE_CLICK_WINDOW_MS = 1000;
  var RAGE_CLICK_COUNT = 3;
  var SELECTION_DEBOUNCE_MS = 400;
  var REPORT_INTERVAL_MS = 5000;

  // Half the expected reading time is the bar for calling something read at
  // all. Nobody reads a paragraph at exactly WPM pace, and a skim that still
  // takes half of it went over most of the words — demanding the full time
  // would only log the slowest readers. The same bar is applied twice with
  // different dwell behind it (hover alone for a per-block `read`, hover +
  // scroll for page coverage) because the question is the same one; what
  // differs is how much the evidence knows about *where*.
  var HOVER_READ_RATIO = 0.5;
  var COVERED_RATIO = 0.5;
  // Past this multiple of the expected time the dwell stops being evidence of
  // pace and starts being evidence of *something*, deep focus or a walked-away
  // tab — labelled ambiguously on purpose rather than guessed at.
  var LINGER_RATIO = 2.5;
  // Coverage is a slow-moving number; re-logging it every REPORT_INTERVAL_MS
  // would bury every other event in near-duplicate rows. A fifth of the page
  // is roughly the smallest jump worth a sentence from the mascot.
  var PAGE_COVERAGE_STEP = 0.2;
  // On the way out a smaller jump is still worth reporting, since there's no
  // later interval left to accumulate into a full step — but not a jump so
  // small that a couple of paragraphs drifting past counts as reading.
  var PAGE_COVERAGE_EXIT_FLOOR = 0.05;

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

  // The chain always terminates in the page URL instead of null — a dead
  // end that's still useful context beats an opaque null.
  function pageRootNode() {
    return { on: pageTitle(), from: location.href };
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
          // h1 IS the page title itself — its own location is just the URL,
          // not another {on: pageTitle} node (that would repeat its own text).
          sectionIndex.set(el, location.href);
          return;
        }

        // This heading's own location is its parent's chain — never itself,
        // that's what was producing the same text twice in one event.
        sectionIndex.set(el, parent);
        stack.push({ level: level, node: { on: headingText(el), from: parent } });
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

  // Session id: one per tab per browsing session, not per page load — the
  // site navigates via full page reloads, so sessionStorage (survives those,
  // resets when the tab closes) is exactly the right lifetime. Replaces an
  // earlier localStorage-based visitorId that persisted across separate
  // visits — session_id is the only identifier now.
  function getSessionId() {
    try {
      var id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id =
          window.crypto && window.crypto.randomUUID
            ? window.crypto.randomUUID()
            : String(Date.now()) + "-" + Math.random().toString(36).slice(2);
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return null;
    }
  }

  var sessionId = getSessionId();

  // The site navigates via full page reloads, so "where did they come from"
  // has to be handed off between page loads through sessionStorage — read
  // it before overwriting it with the current page, so the NEXT page load
  // sees this one as its predecessor.
  function previousPage() {
    try {
      return sessionStorage.getItem(PREVIOUS_PAGE_KEY) || document.referrer || null;
    } catch (e) {
      return document.referrer || null;
    }
  }

  var cameFrom = previousPage();

  try {
    sessionStorage.setItem(PREVIOUS_PAGE_KEY, location.href);
  } catch (e) {
    // sessionStorage unavailable: cameFrom still works for this page, just
    // won't chain to the next one.
  }

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

  function emptyStore() {
    // origin is the referrer that first brought this visitor in — captured
    // once, not overwritten by internal navigation on later page loads.
    return {
      origin: document.referrer || null,
      session_id: sessionId,
      version: getSiteVersion(),
      events: [],
    };
  }

  function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!buffer.length) return;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var stored = raw ? JSON.parse(raw) : null;
      // A schema/version mismatch means old events may not match the
      // current shape — start fresh rather than mixing shapes.
      if (!stored || stored.version !== getSiteVersion()) {
        stored = emptyStore();
      }
      stored.session_id = sessionId;
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

  // Seeds the running event count from whatever's already in localStorage
  // for this schema version, so a page reload mid-session doesn't reset the
  // count the mascot button's 5-event threshold is watching.
  function readStoredEventCount() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var stored = raw ? JSON.parse(raw) : null;
      if (stored && stored.version === getSiteVersion() && stored.events) {
        return stored.events.length;
      }
    } catch (e) {
      // ignore, fall through to 0
    }
    return 0;
  }

  var totalEventCount = readStoredEventCount();

  // Every event is { event, on, from }: `event` names the action (read /
  // read_page / click / selected / clicked_repeatedly), `on` is its subject,
  // and `from` is always a parent-chain node (see locationOf) or, at the end
  // of the chain, the page URL — never a flattened string.
  function log(fields) {
    var evt = { id: Math.random().toString(36).slice(2), ts: Date.now() };
    for (var key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) evt[key] = fields[key];
    }
    buffer.push(evt);
    debugLog(evt);
    scheduleFlush();
    totalEventCount++;
    window.dispatchEvent(new CustomEvent("activity:event", { detail: { count: totalEventCount } }));
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });

  // One "left" event per page visit, fired on the way out with however many
  // seconds the visitor was actually engaged here (see activeMs) — that's
  // the difference between "read this page" and "had it open while doing
  // something else". pagehide, not visibilitychange: this should fire once,
  // on actually leaving, not on every tab switch.
  var navigationLogged = false;

  function logNavigationLeft() {
    if (navigationLogged) return;
    navigationLogged = true;
    reportBlocks(true);
    // Before the navigate event, not after: read_page describes what happened
    // on *this* page, and an agent reading the tail of the log in order should
    // see the reading and then the departure, not a departure it has to
    // backtrack from.
    reportPageReading(true);
    log({
      event: "navigate",
      on: pageTitle(),
      activeSeconds: Math.round(activeMs / 1000),
      from: cameFrom,
    });
    flush();
  }

  window.addEventListener("pagehide", logNavigationLeft);

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
          event: "clicked_repeatedly",
          on: label,
          count: sameTargetClicks.length,
          from: locationOf(target),
        });
        clickHistory = [];
        return;
      }

      log({ event: "click", on: label, from: locationOf(target) });
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

      log({
        event: "selected",
        on: sanitizeText(text, SELECTION_MAX_CHARS),
        from: locationOf(block),
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

  // ---- Hover over content text: the only reading signal that identifies
  // *which* text, which is what makes it the only one allowed to quote a
  // passage. Delegated on mouseover/mouseout (they bubble, mouseenter/
  // mouseleave don't) with a relatedTarget check so moving between child
  // nodes of the same block doesn't flicker it off ----
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

  // ---- Per-block dwell: accrued while the block is on screen, normalized
  // against the block's expected reading time (words / WPM), not against raw
  // scroll velocity ----
  var blocks = new Map();
  // The threshold list isn't a classification, it's a refresh cadence: the
  // observer is the only thing that keeps b.rect current, so a few crossings
  // spread over the block's height keep the geometry roughly fresh while it
  // travels through the viewport without a per-frame getBoundingClientRect.
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        var b = blocks.get(entry.target);
        if (!b) return;
        b.visible = entry.isIntersecting;
        b.rect = entry.boundingClientRect;
      });
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] }
  );

  function wordCount(el) {
    var text = (el.textContent || "").trim();
    return text ? text.split(/\s+/).length : 0;
  }

  // The yardstick every dwell measurement is divided by: how long this much
  // text takes at the reference pace. Absolute milliseconds say nothing about
  // reading — 4s over a one-line heading and 4s over a long paragraph are
  // opposite events.
  function expectedReadingMs(words) {
    return (words / WPM) * 60000;
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
      // The two dwell accumulators are deliberately never summed into one
      // number, because they are not the same kind of evidence and only one of
      // them can be attributed to a passage. hoverDwell means the cursor was
      // over *this* text while moving — the visitor was pointing at it, so
      // quoting it back is honest. scrollDwell only means this block was on
      // screen while the page moved slowly enough that its text *could* have
      // been read; on a viewport showing a dozen blocks at once it accrues for
      // all of them equally, and attributing a read to any one of them would be
      // inventing a location the signal never had. So scrollDwell is only ever
      // aggregated over the whole page (see reportPageReading), never quoted.
      blocks.set(el, {
        el: el,
        words: words,
        hoverDwell: 0, // ms with the cursor moving over this block — knows *where*
        scrollDwell: 0, // ms on screen under the readable-pace gate, weighted by visible fraction
        lastHoverTs: 0, // last frame that added hover dwell — tells "closed" from "still open"
        reportedDwell: 0, // hoverDwell at the last time this block was logged
        visible: false,
        rect: null,
        maxReadingPxPerSec: maxReadingPxPerSec(el, words),
      });
      observer.observe(el);
    });
  }

  // How close to the expected reading time the block's dwell landed. The
  // plateau between ratio 1.0-2.5 barely penalizes on purpose: WPM=240 is a
  // brisk reference for technical prose, and 1.3-1.6x isn't an anomaly, it's
  // attentive reading — punishing it would punish exactly the case that
  // matters most.
  function paceFit(ratio) {
    if (ratio < 1) return 0.5 + (ratio - 0.5);
    if (ratio <= 2.5) return 1 - (0.1 * (ratio - 1)) / 1.5;
    return Math.max(0.3, (0.9 * 2.5) / ratio);
  }

  // Confidence composes its factors multiplicatively, not as a weighted
  // average: a weighted average would let one strong factor mask a fatal one,
  // and here there are only two factors left, both of which matter absolutely.
  // Length is one of them because a five-word block is cheap to hover for
  // "long enough" by accident while a thirty-word one isn't — the ratio alone
  // can't tell those apart, so short blocks are discounted no matter how well
  // their pace fits. The floor keeps a weak score from collapsing to zero:
  // hover is a real signal even at its worst, it just isn't a certainty.
  function scoreHoverRead(b, ratio) {
    var length = 0.7 + 0.3 * Math.min(1, b.words / 30);
    var confidence = Math.max(0.15, Math.min(1, paceFit(ratio) * length));
    return Math.round(confidence * 100) / 100;
  }

  // Same "engaged" condition already used to gate dwell, reused as a running
  // total for the whole page visit — how long the visitor was actually here,
  // not just how long the tab was open, logged on the way out.
  var activeMs = 0;

  function tick(now) {
    sampleScroll(now);

    var idle = Date.now() - lastInteraction > IDLE_MS;
    var focused = document.visibilityState === "visible" && document.hasFocus();

    if (focused && !idle) {
      activeMs += 16;
      var vh = window.innerHeight;
      var dt = 16; // one frame, good enough for this signal
      // Date.now(), not the rAF timestamp — lastMouseMoveTs is wall-clock time.
      var cursorMoving = Date.now() - lastMouseMoveTs < CURSOR_MOVING_WINDOW_MS;

      blocks.forEach(function (b) {
        if (!b.visible || !b.rect) return;

        // Hovering the text WHILE the cursor is moving is the only signal here
        // that identifies a passage: the visitor is pointing at these exact
        // words. It's also the only one worth trusting regardless of scroll
        // speed — someone tracking a line with the mouse is reading it.
        if (b.el === hoveredBlock && cursorMoving) {
          b.hoverDwell += dt;
          b.lastHoverTs = Date.now();
          return;
        }

        // Scrolling faster than this block's text could plausibly be read at
        // WPM pace means the visitor scrolled past it, not read it — a slow
        // scroll over dense small text can fail this just as a fast scroll
        // over big headings can pass it.
        if (Math.abs(vSmooth) > b.maxReadingPxPerSec) return;

        // The whole viewport is the band. Restricting this to an upper slice
        // pretended to know where in the window the visitor's eyes were, which
        // it never did — it just systematically credited whatever happened to
        // be near the top of the scroll window and starved everything else.
        // Since this dwell no longer claims to name a passage, there's nothing
        // left for a band to buy: on-screen at a readable pace is the entire
        // claim being made. The visible-fraction weight stays, because a block
        // half off the edge genuinely contributed half as much page exposure.
        var overlap = Math.min(b.rect.bottom, vh) - Math.max(b.rect.top, 0);
        if (overlap <= 0) return;
        var weight = Math.max(0, Math.min(1, overlap / Math.min(b.rect.height, vh)));
        b.scrollDwell += dt * weight;
      });
    }

    requestAnimationFrame(tick);
  }

  // Reports on CLOSE, not on crossing the threshold — reportBlocks() used to
  // latch the first moment a block passed MIN_DWELL_MS_TO_REPORT and never
  // look again, which meant the ratio it logged was always ~0.5 regardless
  // of how much longer the visitor actually stayed. Any score built on the
  // ratio would've been flat for everyone. Now a block only reports once its
  // hover dwell has stopped growing for CLOSE_GAP_MS (the cursor left, or the
  // visitor moved on) — force (used from pagehide) skips that wait since the
  // page is closing anyway.
  var CLOSE_GAP_MS = 2000;

  // Per-block reads are hover-only. Anything quoting a specific passage back
  // at the visitor has to be able to defend that quote, and only the cursor
  // can: scroll dwell would let the mascot say "I see you reading X" about a
  // paragraph that merely shared a viewport with wherever the visitor was
  // actually looking. Being confidently wrong about that is far worse than
  // staying quiet, so the threshold is hover dwell alone against the full
  // expected reading time.
  function reportBlocks(force) {
    var now = Date.now();
    blocks.forEach(function (b) {
      var grown = b.hoverDwell - b.reportedDwell;
      if (grown < MIN_DWELL_MS_TO_REPORT) return;
      if (!force && now - b.lastHoverTs < CLOSE_GAP_MS) return; // still actively accumulating

      var ratio = b.hoverDwell / expectedReadingMs(b.words);
      if (ratio < HOVER_READ_RATIO) return;

      var wasReportedBefore = b.reportedDwell > 0;
      var manner = ratio > LINGER_RATIO ? "lingered" : "tracked";
      var snippet = sanitizeText(b.el.textContent, SNIPPET_MAX_CHARS);
      log({
        event: "read",
        on: snippet,
        confidence: scoreHoverRead(b, ratio),
        // Coming back to something already reported is one of the strongest
        // interest signals there is — worth its own label instead of
        // logging the same block as a fresh "read" a second time.
        manner: wasReportedBefore ? "revisited" : manner,
        from: locationOf(b.el),
      });
      b.reportedDwell = b.hoverDwell;
    });
  }

  // ---- Page-level reading: where scroll dwell ends up ----
  // Scroll dwell can't say which passage, but summed over every block it does
  // answer a question worth answering: how much of this page went past at a
  // pace that could have been read. That's reported as a fraction with no
  // snippet at all — there is no honest text to quote for it, and handing the
  // LLM a sample paragraph would invite exactly the false specificity the
  // per-block path is being kept clean of. Words are the unit rather than
  // block count so a long paragraph weighs more than a heading.
  var reportedCoverage = 0;

  function pageCoverage() {
    var total = 0;
    var covered = 0;
    blocks.forEach(function (b) {
      total += b.words;
      // Both accumulators count here: for "how much of the page", cursor time
      // and on-screen time are equally good evidence, since the answer isn't
      // attributed to any one block anyway.
      if ((b.hoverDwell + b.scrollDwell) / expectedReadingMs(b.words) >= COVERED_RATIO) {
        covered += b.words;
      }
    });
    return { coverage: total ? covered / total : 0, words: covered };
  }

  function reportPageReading(force) {
    var current = pageCoverage();
    // Zero coverage is not news — it's the state every page starts in.
    if (current.coverage <= 0) return;
    var grown = current.coverage - reportedCoverage;
    if (grown < (force ? PAGE_COVERAGE_EXIT_FLOOR : PAGE_COVERAGE_STEP)) return;

    log({
      event: "read_page",
      on: pageTitle(),
      coverage: Math.round(current.coverage * 100) / 100,
      words: current.words,
      from: location.href,
    });
    reportedCoverage = current.coverage;
  }

  setInterval(function () {
    reportBlocks();
    reportPageReading(false);
  }, REPORT_INTERVAL_MS);

  // ---- Init ----
  registerBlocks();
  requestAnimationFrame(tick);
  log({ event: "visited", on: pageTitle(), from: cameFrom });

  // Pick up new blocks if content changes without a full page reload. Scoped
  // to the content root rather than document.body, and coalesced: every
  // registerBlocks() rebuilds the section index with a querySelectorAll over
  // the whole page, and body-wide observation meant anything else on the page
  // mutating paid for that. The mascot bubble in particular streams its reply
  // into the DOM one word at a time, which on body scope was a full content
  // rescan per token, landing right on top of that bubble's growth animation.
  var registerTimer = null;
  var mutationObserver = new MutationObserver(function () {
    if (registerTimer) return;
    registerTimer = setTimeout(function () {
      registerTimer = null;
      registerBlocks();
    }, 200);
  });
  mutationObserver.observe(contentRoot(), { childList: true, subtree: true });

  // Exposed for debugging from devtools regardless of DEBUG_LOG, since
  // toggling the flag live is only useful if there's something to inspect.
  window.__activityLogger = {
    flush: flush,
    blocks: blocks,
    sessionId: sessionId,
    log: log,
    getEventCount: function () {
      return totalEventCount;
    },
  };
})();
