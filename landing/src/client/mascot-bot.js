// Floating "mascot" button, pinned top-left: switches the AI layout on and off (it
// still fades out on scroll-down like the language switcher does). While the layout
// is on, every three distinct logged actions ask the backend for a one-sentence
// comment addressed to the visitor about what they have been doing.
//
// The comment is not delivered here. It goes to the activity panel, the same
// transcript the actions land in, through window.__activityPanel. This file owns
// the button, the trigger and the request; the panel owns everything drawn.
import { Sparkles, LoaderCircle } from "lucide-static";

(function () {
  "use strict";

  // A comment every AUTO_EVERY distinct actions. The interval stays above the
  // server's 8s per-IP cooldown, so an auto-fired request is never the one that
  // gets 429'd; a batch that completes inside it waits for the remainder instead
  // of being dropped.
  var AUTO_EVERY = 3;
  var AUTO_MIN_INTERVAL_MS = 10000;
  var PAGE_TEXT_MAX_CHARS = 4000;
  var SENT_LOGS_MAX = 10;

  // activity-logger describes a click by its accessible name, so this is also the
  // line the button writes into the transcript the prompt reads back.
  var LABEL = "AI layout";
  var COPY = {
    en: { error: "Couldn't come up with anything to say, try again in a bit." },
    es: { error: "No se me ocurrió nada que decir, probá de nuevo en un rato." },
  };

  function lang() {
    var l = (document.documentElement.lang || "en").slice(0, 2);
    return COPY[l] ? l : "en";
  }

  // Pinned to the top-left corner, mirroring the 1rem gap the language switcher
  // keeps from the bottom-left one.
  var BTN_SIZE_REM = 2;
  var EDGE_REM = 1;

  // Same as the language switcher (`hidden lg:block`, Tailwind's lg breakpoint).
  // Below it there is no room for a framed page with a side panel.
  var DESKTOP_MIN_PX = 1024;

  function injectStyles() {
    var style = document.createElement("style");
    style.textContent =
      // Same visual language as dropdown-trigger[variant="icon-only"]:
      // transparent, text-stone-800/dark:text-stone-100, invert on hover.
      ".mascot-bot-btn{display:none;position:fixed;left:" + EDGE_REM + "rem;" +
      "top:" + EDGE_REM + "rem;z-index:50;" +
      "width:" + BTN_SIZE_REM + "rem;height:" + BTN_SIZE_REM + "rem;padding:0;border:none;cursor:pointer;" +
      "align-items:center;justify-content:center;" +
      "background:transparent;color:#292524;" +
      "opacity:0;transform:scale(.6);pointer-events:none;" +
      "transition:opacity 200ms cubic-bezier(.23,1,.32,1),transform 200ms cubic-bezier(.23,1,.32,1)," +
      "background-color 150ms ease-out,color 150ms ease-out;}" +
      "@media (min-width:" + DESKTOP_MIN_PX + "px){.mascot-bot-btn{display:flex;}}" +
      ".mascot-bot-btn.mascot-bot-visible{opacity:1;transform:scale(1);pointer-events:auto;}" +
      // Same hide-on-scroll behavior as dropdown-trigger[hide-on-scroll]:
      // fades out on scroll-down, back in on scroll-up. clip-path collapses
      // the button's own hit-testable area to nothing on top of the opacity
      // fade and pointer-events:none, so scrolling leaves no trace of it:
      // not just invisible, but out of the way.
      ".mascot-bot-btn.mascot-bot-visible.mascot-bot-scrolling{opacity:0;pointer-events:none;" +
      "clip-path:inset(50%);transition:opacity 150ms ease-in;}" +
      ".mascot-bot-btn:hover,.mascot-bot-btn:focus-visible{background:#000;color:#fff;}" +
      ".mascot-bot-btn svg{width:1rem;height:1rem;}" +
      ".mascot-bot-btn .mascot-bot-spin{animation:mascot-bot-spin 800ms linear infinite;}" +
      "@keyframes mascot-bot-spin{to{transform:rotate(360deg);}}" +
      "@media (prefers-reduced-motion: reduce){" +
      ".mascot-bot-btn .mascot-bot-spin{animation-duration:2s;}}" +
      "@media (prefers-color-scheme: dark){" +
      ".mascot-bot-btn{color:#f5f5f4;}" +
      ".mascot-bot-btn:hover,.mascot-bot-btn:focus-visible{background:#fff;color:#000;}}";
    document.head.appendChild(style);
  }

  function createButton() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mascot-bot-btn";
    btn.setAttribute("aria-label", LABEL);
    document.body.appendChild(btn);
    return btn;
  }

  // Absent if the panel's bundle failed to load, and then the reply still reaches
  // the transcript through logMascotSaid, it just never animates.
  function panelCall(name, arg) {
    var panel = window.__activityPanel;
    if (panel && typeof panel[name] === "function") panel[name](arg);
  }

  // Flushed once per request and cached for it: readActivityLogs() and
  // readReferrer() both need the same parsed record, and parsing twice would
  // just be reading localStorage twice for the same answer.
  var storedLogsCache;

  function storedLogs() {
    if (storedLogsCache !== undefined) return storedLogsCache;
    try {
      // The logger debounces writes to localStorage, so the most recent
      // events may still be sitting in its in-memory buffer, flush first
      // or the LLM sees a stale, incomplete picture of what just happened.
      if (window.__activityLogger && typeof window.__activityLogger.flush === "function") {
        window.__activityLogger.flush();
      }
      var raw = localStorage.getItem("activity_logs");
      storedLogsCache = raw ? JSON.parse(raw) : null;
    } catch (e) {
      storedLogsCache = null;
    }
    return storedLogsCache;
  }

  function readActivityLogs() {
    var stored = storedLogs();
    var events = (stored && stored.events) || [];
    return events.slice(-SENT_LOGS_MAX);
  }

  // Where this visitor first arrived from, captured once by activity-logger.js
  // for the whole session. LOGS only holds the last SENT_LOGS_MAX events, so an
  // engaged visitor's own `visited` carrying this has usually scrolled out of it
  // by now, so this is the only way the prompt still gets to say "you came from
  // LinkedIn" three pages in.
  function readReferrer() {
    var stored = storedLogs();
    return (stored && stored.origin) || "";
  }

  // The event behind an `activity:event`, which only carries a count. Read fresh
  // every time rather than through storedLogs(), whose cache is scoped to a
  // request and would go stale within a single burst of actions.
  function latestEvent() {
    try {
      if (window.__activityLogger && typeof window.__activityLogger.flush === "function") {
        window.__activityLogger.flush();
      }
      var raw = localStorage.getItem("activity_logs");
      var stored = raw ? JSON.parse(raw) : null;
      var events = (stored && stored.events) || [];
      return events[events.length - 1] || null;
    } catch (e) {
      return null;
    }
  }

  // Held while logging the mascot's own reply: that entry dispatches
  // `activity:event` like any other, and auto-commenting on it would have the
  // mascot answering itself forever.
  var suppressAuto = false;

  // So the LLM can see what it already told this visitor and build on it instead of
  // repeating itself, this session's replies go into the same activity log sent back
  // on the next request. It is also what puts the reply in the transcript for good:
  // the streamed bubble is a preview of this entry. A failure is logged the same way,
  // because it is what the mascot answered with, and `failed` is what the panel
  // styles it by.
  function logMascotSaid(message, failed) {
    try {
      if (window.__activityLogger && typeof window.__activityLogger.log === "function") {
        var fields = { event: "mascot_said", on: message, from: location.href };
        if (failed) fields.failed = true;
        suppressAuto = true;
        window.__activityLogger.log(fields);
      }
    } catch (e) {
      // non-critical, skip
    }
    suppressAuto = false;
  }

  function pageText() {
    var content = document.getElementById("content");
    var text = content ? content.innerText : document.body.innerText;
    return (text || "").slice(0, PAGE_TEXT_MAX_CHARS);
  }

  function init() {
    injectStyles();
    var btn = createButton();

    // idle | loading | streaming. Everything that cancels only asks whether this
    // is "idle", so both halves of a request cancel the same way.
    var state = "idle";
    var fullText = "";
    // The reply ends with follow-up lines after a `[[OPTIONS]]` delimiter, which are
    // not part of the sentence. `[` cannot occur inside the comment itself (the
    // prompt forbids it), so its first appearance is unambiguously the end, with no
    // need to buffer looking for the whole token.
    var commentDone = false;
    var abort = null;
    var lastRequestAt = 0;
    var autoTimer = null;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function setIdle() {
      state = "idle";
      btn.innerHTML = Sparkles;
      btn.removeAttribute("aria-busy");
    }

    function setLoading() {
      state = "loading";
      btn.innerHTML = LoaderCircle;
      var svg = btn.querySelector("svg");
      if (svg) svg.classList.add("mascot-bot-spin");
      btn.setAttribute("aria-busy", "true");
    }

    function cancel() {
      if (abort) {
        abort.abort();
        abort = null;
      }
      panelCall("drop");
      setIdle();
    }

    function commit(chunk) {
      if (state === "idle" || commentDone) return;
      var text = chunk || "";
      var bracket = text.indexOf("[");
      if (bracket !== -1) {
        commentDone = true;
        text = text.slice(0, bracket);
      }
      // A leading newline arrives verbatim from the model and would open the
      // bubble with an empty first line.
      if (!fullText) text = text.replace(/^\s+/, "");
      if (!text) return;
      fullText += text;
      state = "streaming";
      panelCall("stream", fullText);
    }

    function readStream(res) {
      // No streaming reader (or a proxy that buffered the whole body): fall
      // back to the complete text, which still renders, just all at once.
      if (!res.body || typeof res.body.getReader !== "function") {
        return res.text().then(function (text) {
          commit(text);
        });
      }
      var reader = res.body.getReader();
      var decoder = new TextDecoder();

      function pump() {
        return reader.read().then(function (result) {
          if (result.done) {
            commit(decoder.decode());
            return;
          }
          commit(decoder.decode(result.value, { stream: true }));
          return pump();
        });
      }

      return pump();
    }

    function requestComment() {
      // Synchronous, all of it: `state` leaving "idle" is the only thing that stops
      // a second request from starting, and the two would share fullText and abort.
      setLoading();
      fullText = "";
      commentDone = false;
      lastRequestAt = Date.now();
      panelCall("pending");
      // The actions that triggered this request have to be in its logs, not in a
      // read from before they existed.
      storedLogsCache = undefined;

      abort = new AbortController();
      var signal = abort.signal;

      fetch("/api/mascot-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: signal,
        body: JSON.stringify({
          logs: readActivityLogs(),
          pageText: pageText(),
          lang: lang(),
          referrer: readReferrer(),
        }),
      })
        .then(function (res) {
          if (!res.ok) {
            // Errors raised before the stream starts are still JSON, so the real
            // reason can reach the panel. Flagged, because it is the only failure
            // whose message is fit to read: once the body has started the server
            // ends it abnormally, and what surfaces then is the transport's own
            // wording ("terminated", "network error").
            return res
              .json()
              .catch(function () {
                return null;
              })
              .then(function (data) {
                var err = new Error((data && data.error) || COPY[lang()].error);
                err.fromServer = true;
                throw err;
              });
          }
          return readStream(res);
        })
        .then(function () {
          if (signal.aborted) return;
          if (!fullText.trim()) throw new Error(COPY[lang()].error);
          // Logged before the streamed bubble goes: the log write renders the entry
          // that replaces it, so the reply never blinks out of the transcript.
          logMascotSaid(fullText.trim());
          panelCall("drop");
          setIdle();
        })
        .catch(function (err) {
          if (signal.aborted || (err && err.name === "AbortError")) return;
          // Same two steps as the reply above, in the same order.
          logMascotSaid(err && err.fromServer ? err.message : COPY[lang()].error, true);
          panelCall("drop");
          setIdle();
        });
    }

    // Going ON needs no help: #scroll-wrapper is `height: 100%` of a body that is
    // viewport-tall from the frame the class lands, so it tracks the animating
    // padding down on its own. Going OFF those rules disappear in one frame and the
    // box jumps to its content height, a length against `auto`, which no browser
    // interpolates, so .ai-layout-animating holds the framed geometry (see
    // styles.css) and the box tracks the padding back out instead.
    var LAYOUT_ANIM_MS = 800;
    var animTimer = null;

    function animateWrapper(toggle) {
      var root = document.documentElement;
      var enabling = !root.classList.contains("ai-layout-enabled");
      // Dropped before the toggle, so a close interrupted halfway hands the box
      // straight back to the enabled rules, which describe the same geometry it is
      // already at. Nothing to jump.
      if (animTimer) clearTimeout(animTimer);
      root.classList.remove("ai-layout-animating");

      toggle();

      if (enabling || reducedMotion.matches || !desktop.matches) return;
      root.classList.add("ai-layout-animating");
      animTimer = setTimeout(function () {
        animTimer = null;
        root.classList.remove("ai-layout-animating");
      }, LAYOUT_ANIM_MS);
    }

    // The button only switches the AI layout on and off. What asks for a comment is
    // the visitor doing things while it is on, this very click included: the logger
    // records it like any other. A request in flight is cancelled, because the panel
    // it was going to write into is what just left the screen.
    btn.addEventListener("click", function () {
      animateWrapper(function () {
        var enabled = document.documentElement.classList.toggle("ai-layout-enabled");
        localStorage.setItem("ai-layout-enabled", String(enabled));
        // The panel's measurements are a separate bundle, and this is the earliest
        // signal that a comment is coming.
        if (enabled) panelCall("warm");
      });

      if (state !== "idle") cancel();
    });

    // Next frame so the scale/fade-in transition plays instead of the button popping
    // in at its final state.
    requestAnimationFrame(function () {
      btn.classList.add("mascot-bot-visible");
    });

    // Same hide-on-scroll behavior as dropdown-trigger[hide-on-scroll]: fades out
    // on scroll-down and back in on scroll-up, matching the language switcher.
    var lastScrollY = window.scrollY;
    window.addEventListener(
      "scroll",
      function () {
        var scrollY = window.scrollY;
        var scrollingDown = scrollY > lastScrollY;
        lastScrollY = scrollY;

        if (scrollingDown) {
          btn.classList.add("mascot-bot-scrolling");
        } else {
          btn.classList.remove("mascot-bot-scrolling");
        }
      },
      { passive: true }
    );

    // A rotated tablet or a resized window hides the button and the panel with it,
    // which would otherwise leave a request running with nowhere to land and
    // nothing left to cancel it.
    var desktop = window.matchMedia("(min-width:" + DESKTOP_MIN_PX + "px)");
    function onBreakpointChange() {
      if (!desktop.matches && state !== "idle") cancel();
    }
    if (desktop.addEventListener) {
      desktop.addEventListener("change", onBreakpointChange);
    } else if (desktop.addListener) {
      desktop.addListener(onBreakpointChange);
    }

    function scheduleAuto(delay) {
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = setTimeout(runAuto, delay);
    }

    function runAuto() {
      autoTimer = null;
      if (!document.documentElement.classList.contains("ai-layout-enabled")) return;
      if (!desktop.matches) return;
      if (state !== "idle") return;
      // Re-armed rather than dropped, so the batch still gets its comment once the
      // interval is up.
      var wait = AUTO_MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
      if (wait > 0) {
        scheduleAuto(wait);
        return;
      }
      requestComment();
    }

    var distinct = Object.create(null);
    var distinctCount = 0;

    // Keyed by event + subject, so re-reading the same heading or clicking the same
    // link again does not advance the count. The count resets on the AUTO_EVERY-th
    // action rather than when a request goes out, so the trigger stays every three
    // even while one comment is in flight or waiting on the interval.
    function countAction() {
      var evt = latestEvent();
      if (!evt) return false;
      var key = evt.event + "|" + (evt.on || "");
      if (distinct[key]) return false;
      distinct[key] = true;
      if (++distinctCount < AUTO_EVERY) return false;
      distinct = Object.create(null);
      distinctCount = 0;
      return true;
    }

    window.addEventListener("activity:event", function () {
      if (suppressAuto) return;
      if (countAction()) runAuto();
    });

    setIdle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
