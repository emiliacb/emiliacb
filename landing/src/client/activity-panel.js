// Renders activity-logger's events into a chat-style transcript inside the
// #activity-panel card. Visible only in the AI layout, but kept populated
// regardless, so the panel already has history the moment the mascot button
// turns it on. Reads localStorage directly rather than hooking activity-logger's
// internals: `activity:event` only carries a count, not the event itself, and the
// logger already exposes flush() to force its debounced write, the same trick
// mascot-bot.js relies on.
(function () {
  "use strict";

  function truncate(text, max) {
    if (!text) return "";
    return text.length > max ? text.slice(0, max).trim() + "…" : text;
  }

  // One line of transcript text per event. Anything this doesn't recognize
  // still gets a line (the raw event name) rather than being dropped silently.
  function describe(evt) {
    switch (evt.event) {
      case "visited":
        return "Visited " + evt.on;
      case "navigate":
        return "Left " + evt.on + " (" + (evt.activeSeconds || 0) + "s)";
      case "click":
        return "Clicked “" + truncate(evt.on, 60) + "”";
      case "clicked_repeatedly":
        return "Rage-clicked “" + truncate(evt.on, 60) + "” x" + evt.count;
      case "selected":
        return "Selected “" + truncate(evt.on, 80) + "”";
      case "read":
        return (evt.manner === "lingered" ? "Lingered on " : "Read ") +
          "“" + truncate(evt.on, 80) + "”";
      case "read_page":
        return "Read " + Math.round((evt.coverage || 0) * 100) + "% of " + evt.on;
      case "mascot_said":
        return evt.on;
      case "said":
        return "Asked: “" + truncate(evt.on, 80) + "”";
      default:
        return evt.event + (evt.on ? ": " + truncate(evt.on, 80) : "");
    }
  }

  function isMascotSide(evt) {
    return evt.event === "mascot_said";
  }

  // Has to match .activity-msg's `max-width` in styles.css: pretext needs the cap
  // in px, and the CSS one is a percentage of the list's content box.
  var BUBBLE_MAX_FRACTION = 0.88;
  // Three .activity-dot of .3rem with .25rem gaps, also from styles.css.
  var DOTS_W_REM = 1.4;

  function rootPx() {
    return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  }

  // ---- pretext, loaded on demand ----
  // Injecting the script is the cost, so it happens when the AI layout goes on and
  // never on the init path of a visitor who leaves it off.
  var pretextPromise = null;

  function loadPretext() {
    if (pretextPromise) return pretextPromise;
    pretextPromise = new Promise(function (resolve) {
      if (window.__pretext) {
        resolve(window.__pretext);
        return;
      }
      // Intl.Segmenter is pretext's hard requirement; without it there is no
      // point downloading the bundle at all.
      if (typeof Intl === "undefined" || !Intl.Segmenter) {
        resolve(null);
        return;
      }
      var meta = document.querySelector('meta[name="cache-version"]');
      var version = meta && meta.getAttribute("content");
      var script = document.createElement("script");
      script.src = version
        ? "/public/" + version + "/_pretext-bundle.js"
        : "/public/_pretext-bundle.js";
      script.onload = function () {
        resolve(window.__pretext || null);
      };
      // Resolving null rather than rejecting: a missing measurement library is a
      // downgrade to CSS sizing, not a failed message.
      script.onerror = function () {
        resolve(null);
      };
      document.head.appendChild(script);
    });
    return pretextPromise;
  }

  function init() {
    var list = document.getElementById("activity-panel-messages");
    if (!list) return;

    var rendered = Object.create(null);

    function renderEvent(evt) {
      if (rendered[evt.id]) return;
      rendered[evt.id] = true;
      var msg = document.createElement("div");
      // `failed` rides on a mascot_said whose text is an error, not a comment.
      msg.className =
        "activity-msg" +
        (isMascotSide(evt) ? " activity-msg-mascot" : "") +
        (evt.failed ? " activity-msg-error" : "");
      msg.textContent = describe(evt);
      list.appendChild(msg);
    }

    function renderAll() {
      try {
        if (window.__activityLogger && typeof window.__activityLogger.flush === "function") {
          window.__activityLogger.flush();
        }
        var raw = localStorage.getItem("activity_logs");
        var stored = raw ? JSON.parse(raw) : null;
        var events = (stored && stored.events) || [];
        if (!events.length) return false;
        events.forEach(renderEvent);
        return true;
      } catch (e) {
        return false;
      }
    }

    function scrollToBottom() {
      list.scrollTop = list.scrollHeight;
    }

    // The mascot's turn, not backed by a logged event yet. Moved back to the end of
    // the list on every render: events logged mid-request are appended after it, and
    // the reply has to stay the last line.
    var pendingEl = null;
    var pretext = null;
    var metrics = null;
    var boxW = 0;
    var boxH = 0;
    var fontHooked = false;

    function warmPretext() {
      loadPretext().then(function (api) {
        pretext = api;
        if (!api || fontHooked || !document.fonts) return;
        fontHooked = true;
        // Montserrat arrives with font-display:swap, so anything measured before it
        // lands was measured against the fallback face. Both signals: fonts.ready
        // only covers loads already in flight, loadingdone fires for later batches.
        var stale = function () {
          api.clearCache();
          metrics = null;
        };
        if (document.fonts.addEventListener) {
          document.fonts.addEventListener("loadingdone", stale);
        }
        if (document.fonts.ready) document.fonts.ready.then(stale);
      });
    }

    // Read off the bubble that will render the text, so measurement and DOM cannot
    // drift apart, and once per message rather than per chunk: these are forced
    // style recalcs.
    function readMetrics() {
      var cs = getComputedStyle(pendingEl);
      var lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) || 12) * 1.35;
      var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      var listCs = getComputedStyle(list);
      var inner =
        list.clientWidth -
        parseFloat(listCs.paddingLeft) -
        parseFloat(listCs.paddingRight);
      var maxText = inner * BUBBLE_MAX_FRACTION - padX;
      if (!(maxText > 0)) return null;
      return {
        // No line-height in the shorthand: canvas ignores it, and it travels
        // separately below.
        font: cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily,
        lineHeight: lh,
        maxText: maxText,
        padX: padX,
        padY: padY,
      };
    }

    // Width is the longest line rather than the wrap width, so the bubble hugs a
    // short reply: pretext guarantees some line reaches maxLineWidth and none
    // exceeds it, so re-wrapping there reproduces the same lines. The +1px absorbs
    // the subpixel disagreement between canvas and DOM wrapping.
    function measure(text) {
      try {
        var prepared = pretext.prepareWithSegments(text, metrics.font);
        var wrapW = Math.min(
          Math.ceil(pretext.measureNaturalWidth(prepared)) + 1,
          metrics.maxText
        );
        var stats = pretext.measureLineStats(prepared, wrapW);
        var width = Math.min(Math.ceil(stats.maxLineWidth) + 1, metrics.maxText);
        var laid = pretext.layout(prepared, width, metrics.lineHeight);
        return { width: width, height: Math.max(laid.height, metrics.lineHeight) };
      } catch (e) {
        // Any measurement failure downgrades this message to CSS sizing instead of
        // losing it.
        return null;
      }
    }

    // box-sizing is border-box, so the padding goes back on top of the measured box.
    function applyBox(width, height) {
      pendingEl.classList.add("activity-msg-sized");
      pendingEl.style.width = width + metrics.padX + "px";
      pendingEl.style.height = height + metrics.padY + "px";
    }

    function autoSize() {
      pendingEl.classList.remove("activity-msg-sized");
      pendingEl.style.width = "";
      pendingEl.style.height = "";
    }

    // Grows toward the text, never back: a bubble that shrank because a long word
    // moved to the next line would read as a glitch.
    function sizeTo(text) {
      if (!pretext) return autoSize();
      if (!metrics) metrics = readMetrics();
      if (!metrics) return autoSize();
      var size = measure(text);
      if (!size) return autoSize();
      boxW = Math.max(boxW, size.width);
      boxH = Math.max(boxH, size.height);
      applyBox(boxW, boxH);
    }

    function pending() {
      warmPretext();
      if (!pendingEl) {
        pendingEl = document.createElement("div");
        pendingEl.className = "activity-msg activity-msg-mascot activity-msg-pending";
        pendingEl.innerHTML =
          '<span class="activity-dot"></span><span class="activity-dot"></span>' +
          '<span class="activity-dot"></span>';
        list.appendChild(pendingEl);
      }
      metrics = null;
      boxW = 0;
      boxH = 0;
      // The dots get a measured box too, so every later size is a px to px change
      // the transition can run. From CSS sizing the first word would have to animate
      // out of `auto`, which does not interpolate, and the bubble would jump.
      if (pretext) {
        metrics = readMetrics();
        if (metrics) applyBox(DOTS_W_REM * rootPx(), metrics.lineHeight);
      }
      scrollToBottom();
    }

    // The text wraps at the width pretext measured, so it does not re-wrap while
    // the box eases toward it.
    function stream(text) {
      if (!pendingEl) pending();
      pendingEl.classList.remove("activity-msg-pending");
      pendingEl.textContent = text;
      sizeTo(text);
      scrollToBottom();
    }

    // Both endings come through here: the streamed bubble was only ever a preview of
    // the logged entry, reply or error.
    function drop() {
      if (!pendingEl) return;
      pendingEl.remove();
      pendingEl = null;
    }

    window.__activityPanel = { warm: warmPretext, pending: pending, stream: stream, drop: drop };

    // The first bubble is too late to start the download, so this and mascot-bot.js
    // calling warm on the toggle are what give it a head start. Without one the
    // first reply of a session falls back to CSS sizing.
    if (document.documentElement.classList.contains("ai-layout-enabled")) warmPretext();

    if (renderAll()) scrollToBottom();

    window.addEventListener("activity:event", function () {
      if (!renderAll()) return;
      if (pendingEl) list.appendChild(pendingEl);
      scrollToBottom();
    });

    var clearBtn = document.getElementById("activity-panel-clear");
    if (clearBtn) {
      // Deliberately does not stop the event: the logger's click handler sits on
      // document and runs after this one, so the press that empties the log lands
      // back in it as the only line left, the way `clear` leaves its own command.
      clearBtn.addEventListener("click", function () {
        try {
          // flush() first, then drop: the logger's buffer is written out by it, so
          // clearing afterwards leaves nothing behind to reappear on the next write.
          if (window.__activityLogger && typeof window.__activityLogger.flush === "function") {
            window.__activityLogger.flush();
          }
          localStorage.removeItem("activity_logs");
        } catch (err) {
          // storage unavailable: the transcript still clears
        }
        rendered = Object.create(null);
        list.innerHTML = "";
        pendingEl = null;
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
