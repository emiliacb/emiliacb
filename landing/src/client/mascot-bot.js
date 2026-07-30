// Floating "mascot" button, pinned top-left: always available on desktop (it
// still fades out on scroll-down like the language switcher does), and on
// click asks the backend for a one-sentence comment addressed to the visitor
// about something they just did on the page.
//
// Nothing is shown while the request is in flight: the button swaps its own
// icon for a spinner, and that is the entire waiting state. The bubble only
// appears once there is something to read, so its enter transition and its
// growth are one continuous motion instead of two stages around an empty box.
//
// The reply is streamed, so the bubble can't be laid out once and be done: it
// opens holding the first word, then grows as the rest arrive. Growing a box
// whose text reflows on every frame looks like a jitter, so the box is sized in
// px from pretext's off-DOM measurements (see sizeFor) and the text is absolutely
// positioned at its final wrap width from the start. The box animates toward
// that size while the words fade in behind it, and nothing ever re-wraps.
import { Sparkles, LoaderCircle, X } from "lucide-static";

(function () {
  "use strict";

  var TOAST_DURATION_MS = 4000;
  var PAGE_TEXT_MAX_CHARS = 4000;
  var SENT_LOGS_MAX = 10;

  var COPY = {
    en: {
      error: "Couldn't come up with anything to say, try again in a bit.",
      ask: "Emilia's comment",
      dismiss: "Dismiss Emilia's comment",
    },
    es: {
      error: "No se me ocurrió nada que decir, probá de nuevo en un rato.",
      ask: "Comentario de Emilia",
      dismiss: "Cerrar el comentario de Emilia",
    },
  };

  function lang() {
    var l = (document.documentElement.lang || "en").slice(0, 2);
    return COPY[l] ? l : "en";
  }

  // Pinned to the top-left corner, mirroring the 1rem gap the language
  // switcher keeps from the bottom-left one. 2rem tall, so the bubble it
  // opens hangs below it with a .5rem gap.
  var BTN_SIZE_REM = 2;
  var EDGE_REM = 1;
  var BUBBLE_GAP_REM = 0.5;
  var BUBBLE_TOP_REM = EDGE_REM + BTN_SIZE_REM + BUBBLE_GAP_REM;

  // Desktop-only, same as the language switcher (`hidden lg:block`, Tailwind's
  // lg breakpoint). Button and bubble share the constant because they have to
  // appear and disappear together: the button is the bubble's only dismiss
  // control, so a viewport that hides one has to hide the other.
  var DESKTOP_MIN_PX = 1024;

  // The bubble is sized as a content box, so these are the bounds of the text
  // area itself, padding excluded. MIN is a floor under every measured width,
  // which matters most at the open: the box opens at the width of its first
  // word, and a two-letter one would otherwise open a box barely wider than its
  // own padding. Still small enough that growing into a full sentence is a
  // visible change.
  var MAX_TEXT_REM = 20;
  var MIN_TEXT_REM = 3.25;
  var PAD_X_REM = 1;
  var PAD_Y_REM = 0.75;

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
      // fades out on scroll-down, back in on scroll-up.
      ".mascot-bot-btn.mascot-bot-visible.mascot-bot-scrolling{opacity:0;pointer-events:none;" +
      "transition:opacity 150ms ease-in;}" +
      ".mascot-bot-btn:hover,.mascot-bot-btn:focus-visible{background:#000;color:#fff;}" +
      ".mascot-bot-btn svg{width:1rem;height:1rem;}" +
      ".mascot-bot-btn .mascot-bot-spin{animation:mascot-bot-spin 800ms linear infinite;}" +
      "@keyframes mascot-bot-spin{to{transform:rotate(360deg);}}" +
      "@media (prefers-color-scheme: dark){" +
      ".mascot-bot-btn{color:#f5f5f4;}" +
      ".mascot-bot-btn:hover,.mascot-bot-btn:focus-visible{background:#fff;color:#000;}}" +
      // Hangs below the button, so it grows down and to the right, away from
      // the corner it's anchored to: transform-origin at the top-left corner
      // means the open/close scale reads as coming out of the button rather
      // than out of thin air.
      //
      // content-box, so the width/height set from JS are exactly the measured
      // text box and the padding is added on top. overflow:hidden is what lets
      // the box lead the text: words that haven't been uncovered yet are
      // clipped instead of spilling out.
      //
      // Gated behind the same breakpoint as the button above, and starting from
      // display:none, so the bubble can never outlive the only control that
      // dismisses it.
      ".mascot-bot-bubble{display:none;position:fixed;left:" + EDGE_REM + "rem;" +
      "top:" + BUBBLE_TOP_REM + "rem;z-index:50;" +
      "box-sizing:content-box;padding:" + PAD_Y_REM + "rem " + PAD_X_REM + "rem;" +
      "max-width:" + MAX_TEXT_REM + "rem;" +
      "background:#fff;color:#1c1917;border-radius:.75rem;" +
      "box-shadow:0 6px 20px -4px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.06);" +
      // An explicit family, not the inherited stack: pretext measures through
      // a canvas, where `system-ui` doesn't resolve to the same face the DOM
      // picks, and every measurement would be off by a hair.
      "font-family:Montserrat,'Segoe UI',Helvetica,Arial,sans-serif;" +
      "font-size:.875rem;line-height:1.45;" +
      "overflow:hidden;transform-origin:top left;" +
      // visibility, not just opacity: an opacity:0 bubble is still in the
      // accessibility tree, so the last comment would keep being readable by a
      // screen reader long after it was dismissed. Transitioning it with a
      // delay as long as the fade means it only goes away once the exit has
      // played, and the .mascot-bot-visible rule below zeroes the delay so
      // opening is not held back by it.
      "opacity:0;visibility:hidden;transform:scale(.94);filter:blur(3px);pointer-events:none;" +
      // Transitions, not keyframes, on every one of these: the bubble can be
      // dismissed mid-open and resized mid-growth, and a transition retargets
      // from wherever it currently is instead of restarting.
      "transition:opacity 150ms ease-out," +
      "transform 280ms cubic-bezier(.32,.72,0,1)," +
      "filter 200ms ease-out," +
      "width 300ms cubic-bezier(.32,.72,0,1)," +
      "height 300ms cubic-bezier(.32,.72,0,1)," +
      "visibility 0s linear 150ms;}" +
      "@media (min-width:" + DESKTOP_MIN_PX + "px){.mascot-bot-bubble{display:block;}}" +
      // Fallback for browsers pretext can't run in (no Intl.Segmenter) or when
      // its bundle failed to load: drop the measured px sizing and let CSS wrap
      // the text normally. The bubble still fades and scales, it just can't
      // animate its own growth.
      ".mascot-bot-bubble.mascot-bot-auto{width:auto;height:auto;transition:opacity 150ms ease-out," +
      "transform 280ms cubic-bezier(.32,.72,0,1),filter 200ms ease-out,visibility 0s linear 150ms;}" +
      ".mascot-bot-bubble.mascot-bot-auto .mascot-bot-text{position:static;width:auto;}" +
      // After the fallback rule on purpose: its transition-delay has to win over
      // both transition shorthands above so that opening is immediate while
      // closing waits out the fade.
      ".mascot-bot-bubble.mascot-bot-visible{opacity:1;visibility:visible;transform:scale(1);" +
      "filter:blur(0);pointer-events:auto;transition-delay:0s;}" +
      "@media (prefers-color-scheme: dark){.mascot-bot-bubble{background:#292524;color:#f5f5f4;" +
      "box-shadow:0 6px 20px -4px rgba(0,0,0,.5),0 1px 2px rgba(0,0,0,.3);}}" +
      // Taken out of flow so the box can be smaller than the text it holds
      // while it catches up. Its width is pinned to the final wrap width the
      // moment it's known, which is what keeps the text from re-wrapping on
      // every frame of the growth animation.
      // break-word is not cosmetic here: pretext breaks a word longer than the
      // box across lines, while CSS with the default overflow-wrap lets it
      // spill instead. Verified in Chromium against every other wrapping case,
      // this is the one where the DOM and the measurement disagreed, and with
      // overflow:hidden above the disagreement would have clipped a URL or a
      // long compound word clean off the bubble.
      ".mascot-bot-text{position:absolute;left:" + PAD_X_REM + "rem;top:" + PAD_Y_REM + "rem;" +
      "overflow-wrap:break-word;}" +
      // Words fade and sharpen in as they arrive. opacity and filter only, no
      // transform: transforms don't apply to non-replaced inline elements, and
      // making these inline-block to get one would hand line-breaking to a
      // different code path than the one pretext measured.
      ".mascot-bot-word{opacity:0;filter:blur(5px);" +
      "transition:opacity 300ms ease-out,filter 300ms ease-out;}" +
      ".mascot-bot-word.mascot-bot-word-in{opacity:1;filter:blur(0);}" +
      // The announcement region: never painted, never gated behind the
      // breakpoint. Clipped rather than display:none or visibility:hidden,
      // because either of those takes it out of the accessibility tree and a
      // live region that isn't in the tree announces nothing.
      ".mascot-bot-live{position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;" +
      "clip-path:inset(50%);white-space:nowrap;pointer-events:none;}" +
      ".mascot-bot-toast{position:fixed;bottom:1rem;left:50%;transform:translateX(-50%) translateY(6px);" +
      "z-index:60;background:#1c1917;color:#fff;padding:.6rem 1rem;border-radius:.5rem;" +
      "font-size:.8rem;opacity:0;pointer-events:none;transition:opacity 180ms ease-out,transform 180ms ease-out;}" +
      ".mascot-bot-toast.mascot-bot-visible{opacity:1;transform:translateX(-50%) translateY(0);}" +
      // Motion is the whole point of the growing bubble, so reduced-motion
      // gets the plain version: no growth animation, no per-word reveal.
      "@media (prefers-reduced-motion: reduce){" +
      ".mascot-bot-bubble{transition:opacity 120ms linear,visibility 0s linear 120ms;" +
      "transform:none;filter:none;}" +
      ".mascot-bot-bubble.mascot-bot-visible{transform:none;}" +
      ".mascot-bot-word{opacity:1;filter:none;transition:none;}}";
    document.head.appendChild(style);
  }

  function createButton() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mascot-bot-btn";
    // Label and expanded state are both set per state by setButtonState; this
    // is only the closed one it starts in.
    btn.setAttribute("aria-label", COPY[lang()].ask);
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = Sparkles;
    document.body.appendChild(btn);
    return btn;
  }

  function createBubble() {
    var bubble = document.createElement("div");
    bubble.className = "mascot-bot-bubble";

    var text = document.createElement("div");
    text.className = "mascot-bot-text";

    // The live region is a separate, off-screen node rather than the bubble
    // itself: the bubble's text grows a word at a time, and a live region over
    // it re-announces the whole sentence from the top on every one of those
    // ~30 mutations. This one is written to exactly once, when the sentence is
    // finished, and emptied again when the bubble closes.
    var live = document.createElement("div");
    live.className = "mascot-bot-live";
    live.setAttribute("role", "status");

    bubble.appendChild(text);
    document.body.appendChild(bubble);
    document.body.appendChild(live);
    return { bubble: bubble, text: text, live: live };
  }

  // One toast at a time, reusing the node: two of them share the same fixed
  // position (two failures in a row is easy to reach with the server's per-IP
  // cooldown) and would stack into an illegible pile.
  var toastEl = null;
  var toastTimer = null;

  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "mascot-bot-toast";
      document.body.appendChild(toastEl);
    }
    var el = toastEl;
    el.textContent = message;
    requestAnimationFrame(function () {
      el.classList.add("mascot-bot-visible");
    });
    toastTimer = setTimeout(function () {
      el.classList.remove("mascot-bot-visible");
      toastTimer = setTimeout(function () {
        toastTimer = null;
        toastEl = null;
        el.remove();
      }, 200);
    }, TOAST_DURATION_MS);
  }

  // ---- pretext, loaded on demand ----
  // Calling this is what injects the script tag, so nothing on the init path
  // may call it: the whole reason the measurement tables are a separate bundle
  // is that most visitors never click. The pointer entering the button (or
  // focusing it) is the first honest signal of intent, and it lands early
  // enough that the click after it usually finds the measurements ready and
  // takes the animated path rather than the auto-sizing fallback.
  var pretextPromise = null;

  function loadPretext() {
    if (pretextPromise) return pretextPromise;
    pretextPromise = new Promise(function (resolve) {
      if (window.__pretext) {
        resolve(window.__pretext);
        return;
      }
      // Intl.Segmenter is pretext's hard requirement; without it there's no
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
      // Resolving null rather than rejecting: a missing measurement library is
      // a downgrade to CSS sizing, not a failed comment.
      script.onerror = function () {
        resolve(null);
      };
      document.head.appendChild(script);
    });
    return pretextPromise;
  }

  function readActivityLogs() {
    try {
      // The logger debounces writes to localStorage, so the most recent
      // events may still be sitting in its in-memory buffer, flush first
      // or the LLM sees a stale, incomplete picture of what just happened.
      if (window.__activityLogger && typeof window.__activityLogger.flush === "function") {
        window.__activityLogger.flush();
      }
      var raw = localStorage.getItem("activity_logs");
      var stored = raw ? JSON.parse(raw) : null;
      var events = (stored && stored.events) || [];
      return events.slice(-SENT_LOGS_MAX);
    } catch (e) {
      return [];
    }
  }

  // So the LLM can see what it already told this visitor and build on it
  // instead of repeating itself, this session's mascot replies become part
  // of the same activity log sent back on the next click.
  function logMascotSaid(message) {
    try {
      if (window.__activityLogger && typeof window.__activityLogger.log === "function") {
        window.__activityLogger.log({ event: "mascot_said", on: message, from: location.href });
      }
    } catch (e) {
      // non-critical, skip
    }
  }

  function pageText() {
    var content = document.getElementById("content");
    var text = content ? content.innerText : document.body.innerText;
    return (text || "").slice(0, PAGE_TEXT_MAX_CHARS);
  }

  function init() {
    injectStyles();
    var btn = createButton();
    var parts = createBubble();
    var bubble = parts.bubble;
    var textEl = parts.text;
    var liveEl = parts.live;

    // idle | loading | streaming | showing. The two middle ones are worth
    // keeping apart now that the dots are gone, because they are exactly the
    // "no bubble yet" and "bubble on screen" halves of a request: "loading" is
    // the window where nothing is up but the button's spinner, and the move to
    // "streaming" on the first committed word is what opens the bubble.
    // Everything that dismisses (click, Escape, scroll-down, breakpoint) only
    // asks whether this is "idle", so both halves cancel the same way.
    var state = "idle";
    var pretext = null; // measurement API for the message currently open, or null
    var pretextReady = null; // the API once its bundle has landed, or null
    var fullText = ""; // everything committed to the DOM so far
    var pending = ""; // trailing fragment of the stream, not a whole word yet
    var boxW = 0; // measured px size of the text box, monotonic within a message
    var boxH = 0;
    var metrics = null; // font metrics of the message currently open, or null
    var openSeq = 0; // bumped on every open and every close, see openBubble
    var abort = null;
    var fontHooked = false;

    // Injects the bundle, so only intent (hover, focus, click) may call it.
    // Everything that has to happen once it lands hangs off here rather than
    // off init, which would make every page load pay for the download.
    function warmPretext() {
      loadPretext().then(function (api) {
        pretextReady = api;
        if (!api || fontHooked || !document.fonts) return;
        fontHooked = true;
        // Both signals on purpose. document.fonts.ready only covers the loads
        // that were already in flight when it was read, and this can be reached
        // before the bubble's own face has started downloading at all;
        // loadingdone fires for every batch that lands afterwards, which is
        // exactly when a box measured against the old face goes stale.
        if (document.fonts.addEventListener) {
          document.fonts.addEventListener("loadingdone", function () {
            onFontsReady(api);
          });
        }
        if (document.fonts.ready) {
          document.fonts.ready.then(function () {
            onFontsReady(api);
          });
        }
      });
    }

    // Montserrat arrives over the network with font-display:swap, so anything
    // measured before it lands was measured against the fallback face: pretext
    // caches by font string, and the box a message already grew to is a box for
    // a face that is no longer being rendered.
    function onFontsReady(api) {
      api.clearCache();
      if (!pretext || state === "idle" || !measurable()) return;
      metrics = readMetrics();
      if (!fullText) return;
      // The only place the monotonic maxima are thrown away: the same sentence
      // in the real face can need a taller box than the fallback did, and with
      // overflow:hidden a box that stayed at the old height clips the last line
      // off without a trace. Growing is the rule, but not against a face that
      // no longer exists.
      boxW = 0;
      boxH = 0;
      resizeToText();
    }

    // Below the breakpoint the bubble is display:none, and a display:none
    // element reports computed values the renderer never used, so anything
    // measured off it would be fiction.
    function measurable() {
      return getComputedStyle(bubble).display !== "none";
    }

    // Read back off the element that will actually render the text, so the
    // measurement and the DOM can't drift apart. Read once per message instead
    // of once per committed word: these are forced style recalcs, and a reply
    // commits ~30 words. The font swapping in is the only thing that can
    // invalidate them mid-message, and onFontsReady re-reads them there.
    function readMetrics() {
      var cs = getComputedStyle(textEl);
      var lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) || 14) * 1.45;
      return {
        // No line-height component in the shorthand: canvas ignores it, and the
        // line height travels separately.
        font: cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily,
        lineHeight: lh,
        rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      };
    }

    function remToPx(rem) {
      return rem * metrics.rootPx;
    }

    // The text box this string wants, measured entirely off-DOM. Width is the
    // longest line rather than the wrap width, so the bubble hugs a short
    // message instead of always sitting at its maximum: pretext guarantees
    // some line reaches maxLineWidth and none exceeds it, so re-wrapping at
    // that width reproduces the same lines. The +1px absorbs the subpixel
    // disagreement between canvas measurement and DOM wrapping.
    function sizeFor(str) {
      try {
        var font = metrics.font;
        var lh = metrics.lineHeight;
        var maxW = remToPx(MAX_TEXT_REM);
        var prepared = pretext.prepareWithSegments(str, font);
        var wrapW = Math.min(Math.ceil(pretext.measureNaturalWidth(prepared)) + 1, maxW);
        var stats = pretext.measureLineStats(prepared, wrapW);
        var width = Math.min(Math.ceil(stats.maxLineWidth) + 1, maxW);
        var result = pretext.layout(prepared, width, lh);
        return {
          width: Math.max(width, remToPx(MIN_TEXT_REM)),
          height: Math.max(result.height, lh),
        };
      } catch (e) {
        // Any measurement failure downgrades this message to CSS sizing
        // instead of losing it.
        return null;
      }
    }

    // Grows the box toward the text, never back: a bubble that shrank because
    // a long word moved to the next line would read as a glitch, and the
    // measured width is the longest line so far either way.
    function resizeToText() {
      if (!pretext || !metrics) return;
      var size = sizeFor(fullText);
      if (!size) {
        useAutoSizing();
        return;
      }
      boxW = Math.max(boxW, size.width);
      boxH = Math.max(boxH, size.height);
      // The text wraps at the final width immediately while the box animates
      // toward it. That's the one thing keeping the words still: if this
      // followed the animated width, every frame would re-wrap the sentence.
      textEl.style.width = boxW + "px";
      bubble.style.width = boxW + "px";
      bubble.style.height = boxH + "px";
    }

    // Jumps to a size instead of animating to it. Needed exactly once per
    // message, at open: the element still carries the previous reply's width
    // and height, and letting the transition run from there means the bubble
    // fades in while visibly shrinking from the last comment's size down to the
    // first word's. Suppressing the transition for one flushed frame makes the
    // open start from small, which is what the growth is supposed to read as,
    // and the flush is also what the growth's first step transitions *from*.
    function setSizeInstant(width, height) {
      bubble.style.transition = "none";
      bubble.style.width = width + "px";
      bubble.style.height = height + "px";
      textEl.style.width = width + "px";
      void bubble.offsetWidth;
      bubble.style.transition = "";
    }

    function useAutoSizing() {
      pretext = null;
      metrics = null;
      bubble.classList.add("mascot-bot-auto");
      bubble.style.width = "";
      bubble.style.height = "";
      textEl.style.width = "";
    }

    // The icon carries the whole meaning of this button, so the name has to
    // follow it: sparkles asks for a comment, the X dismisses the one on screen.
    function setButtonState(isOpen) {
      var copy = COPY[lang()];
      btn.setAttribute("aria-label", isOpen ? copy.dismiss : copy.ask);
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    function setIdle() {
      state = "idle";
      btn.innerHTML = Sparkles;
      btn.removeAttribute("aria-busy");
      setButtonState(false);
    }

    function setLoading() {
      state = "loading";
      btn.innerHTML = LoaderCircle;
      var svg = btn.querySelector("svg");
      if (svg) svg.classList.add("mascot-bot-spin");
      // Not dismissable-looking yet, and not expanded either: there is nothing
      // on screen in this window to call expanded or to offer to dismiss. The
      // spinning icon is the whole visual feedback and aria-busy is its
      // equivalent for a screen reader. Pressing the button here still cancels
      // the request, through the same "not idle" branch that closes a bubble.
      btn.setAttribute("aria-busy", "true");
      setButtonState(false);
    }

    function setDismissable() {
      btn.innerHTML = X;
      btn.removeAttribute("aria-busy");
      setButtonState(true);
    }

    // Everything a message has to start from zero, reset at the click rather
    // than at the open: the stream commits into these, and the bubble is not
    // open yet when the first chunk lands. Nothing here touches the DOM, so the
    // previous comment stays in the (hidden) bubble until a word replaces it.
    function resetMessage() {
      fullText = "";
      pending = "";
      boxW = 0;
      boxH = 0;
      metrics = null;
    }

    // Called from the first committed word, never from the click. A bubble
    // opened on click has nothing in it to read: the enter transition is spent
    // on an empty box, and whatever is put inside it to fill the wait only
    // repeats the spinner the button is already showing. Opening here instead
    // makes the enter and the growth one motion -- it scales and fades in
    // already holding `firstWord`, and is already growing past it by the time
    // it is legible.
    function openBubble(firstWord) {
      textEl.textContent = "";
      liveEl.textContent = "";
      bubble.classList.remove("mascot-bot-auto");

      if (pretext && measurable()) {
        metrics = readMetrics();
        // The first word alone, not the chunk it arrived in: a short reply can
        // land in a single chunk, and sizing the open to all of it would put the
        // bubble at its final width before it is even visible, with nothing left
        // to grow. A failure here downgrades the message to CSS sizing, same as
        // any other measurement failure.
        var size = sizeFor(firstWord);
        if (size) {
          boxW = size.width;
          boxH = size.height;
          setSizeInstant(boxW, boxH);
        } else {
          useAutoSizing();
        }
      } else {
        useAutoSizing();
      }

      // Next frame, so the enter transition has an initial state to run from.
      // Guarded by the sequence number because a scroll-down dispatches before
      // animation-frame callbacks in the same frame: the first token can land in
      // the same frame the visitor keeps scrolling in, and without this the
      // scroll would close the bubble and then this would make it visible
      // anyway, leaving a bubble with no request behind it that no further
      // scroll will close. closeBubble bumps the same counter from every path
      // that can run in that gap -- scroll, Escape, click, breakpoint.
      var seq = ++openSeq;
      requestAnimationFrame(function () {
        if (seq !== openSeq) return;
        bubble.classList.add("mascot-bot-visible");
        // In here rather than next to the state change, so the X and the
        // aria-expanded that comes with it land on the same frame the bubble
        // does: there is no frame where the button offers to dismiss something
        // that isn't on screen, and if this frame never comes because the
        // message was closed first, the icon is left as closeBubble set it.
        setDismissable();
      });
    }

    // Also the cancel path for a message that never got as far as a bubble:
    // during "loading" the class removal is a no-op and the abort is the point.
    function closeBubble() {
      openSeq++;
      bubble.classList.remove("mascot-bot-visible");
      liveEl.textContent = "";
      if (abort) {
        abort.abort();
        abort = null;
      }
      setIdle();
    }

    // Whitespace becomes a plain text node and words become spans, so each
    // word can fade in on its own. The split keeps the separators, which
    // matters: collapsing them would change where the line breaks and pull the
    // DOM out of agreement with what pretext measured.
    function appendPieces(pieces) {
      var fresh = [];
      pieces.forEach(function (piece) {
        if (!piece) return;
        if (/^\s+$/.test(piece)) {
          textEl.appendChild(document.createTextNode(piece));
          return;
        }
        var span = document.createElement("span");
        span.className = "mascot-bot-word";
        span.textContent = piece;
        textEl.appendChild(span);
        fresh.push(span);
      });
      if (!fresh.length) return;
      // Next frame, so the transition has an initial state to run from
      // instead of the span painting straight at its final opacity.
      requestAnimationFrame(function () {
        fresh.forEach(function (span) {
          span.classList.add("mascot-bot-word-in");
        });
      });
    }

    // Commits as much of the stream as forms whole words. A half-arrived word
    // is held back in `pending`: rendering it and then extending it would make
    // the text twitch, and would make every measurement a measurement of a
    // string that never existed.
    // Also where the bubble is opened, on the first word and no earlier.
    function commit(chunk, final) {
      // The message was dismissed, so there is nowhere for this to go: a chunk
      // that was already in flight must not paint itself into a closed bubble,
      // re-open one, or turn the button back into an X over nothing.
      if (state === "idle") return;
      pending += chunk || "";
      // The server streams the model's raw output, so unlike the old
      // await-then-trim version a leading newline arrives verbatim. Inside an
      // absolutely positioned fixed-width box it would push the first line
      // down past the padding, and it would be measured as a line that the
      // DOM then collapses.
      if (!fullText) pending = pending.replace(/^\s+/, "");
      if (!pending && !final) return;

      var pieces = pending.split(/(\s+)/);
      pending = final ? "" : pieces.pop() || "";
      if (!pieces.length) return;

      if (state === "loading") {
        // pieces[0] is a word, not whitespace: while fullText is empty the strip
        // above has already eaten any leading space. It can still be empty, from
        // a final flush with nothing left in it -- an empty 200 body, or a reply
        // that was only whitespace. Those are about to become an error toast, so
        // returning here is what keeps them from flashing the empty bubble this
        // whole path exists to avoid.
        if (!pieces[0]) return;
        // State first and synchronously, as everywhere else: openBubble only
        // schedules the frame that reveals the bubble, and a second click or a
        // scroll landing before that frame has to find a state it can close.
        state = "streaming";
        openBubble(pieces[0]);
      }

      fullText += pieces.join("");
      appendPieces(pieces);
      resizeToText();
    }

    function readStream(res) {
      // No streaming reader (or a proxy that buffered the whole body): fall
      // back to the complete text, which still renders, just all at once.
      if (!res.body || typeof res.body.getReader !== "function") {
        return res.text().then(function (text) {
          commit(text, true);
        });
      }
      var reader = res.body.getReader();
      var decoder = new TextDecoder();

      function pump() {
        return reader.read().then(function (result) {
          if (result.done) {
            commit(decoder.decode(), true);
            return;
          }
          commit(decoder.decode(result.value, { stream: true }), false);
          return pump();
        });
      }

      return pump();
    }

    function requestComment() {
      // Synchronous, all of it, and nothing may be awaited before it: `state`
      // leaving "idle" is the only thing that stops the next click from
      // starting a second request, and two requests would share fullText,
      // pending, boxW and abort. A gap here is also a gap with no feedback in
      // it, which is exactly what makes someone click again: the spinner going
      // up is now the only thing that happens at click time.
      setLoading();
      resetMessage();
      // Which sizing strategy this message uses is decided here and never
      // revisited, even though the bubble it applies to won't exist until the
      // first word: a bundle that lands mid-stream can only help the next
      // message, because switching from CSS wrapping to measured px sizing
      // halfway through is a visible jump. Starting the download anyway, since
      // a click without a hover before it is the same signal of intent.
      pretext = pretextReady;
      warmPretext();

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
        }),
      })
        .then(function (res) {
          if (!res.ok) {
            // Errors raised before the stream starts are still JSON, so the
            // real reason can reach the toast. Flagged, because it is the only
            // failure whose message is fit to read: once the body has started,
            // the server ends it abnormally rather than let a truncated
            // half-sentence look finished, and what surfaces then is the
            // transport's own wording ("terminated", "network error").
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
          state = "showing";
          // No setDismissable() here: reaching this means a word was committed,
          // so openBubble has already scheduled the frame that puts the X up
          // with the bubble. Doing it again from here would only matter for a
          // reply that arrived in one chunk, and then it would be doing it a
          // frame early -- an X over a bubble that isn't on screen yet.
          //
          // The one and only announcement for this message: the sentence is
          // finished, so a screen reader reads it whole instead of re-reading a
          // growing fragment after every committed word.
          liveEl.textContent = fullText.trim();
          logMascotSaid(fullText.trim());
        })
        .catch(function (err) {
          if (signal.aborted || (err && err.name === "AbortError")) return;
          closeBubble();
          showToast(err && err.fromServer ? err.message : COPY[lang()].error);
        });
    }

    btn.addEventListener("click", function () {
      if (state !== "idle") {
        closeBubble();
        return;
      }
      requestComment();
    });

    // Warms the measurement bundle on intent, well before the click needs it.
    btn.addEventListener("pointerenter", warmPretext);
    btn.addEventListener("focus", warmPretext);

    // The bubble isn't focusable and the button is its only dismiss control, so
    // without this a keyboard user has no way out of an open comment.
    document.addEventListener("keydown", function (e) {
      if (state === "idle") return;
      if (e.key !== "Escape" && e.key !== "Esc") return;
      closeBubble();
    });

    // Next frame so the scale/fade-in transition actually plays instead of
    // the button popping in already at its final state.
    requestAnimationFrame(function () {
      btn.classList.add("mascot-bot-visible");
    });

    // Same hide-on-scroll behavior as dropdown-trigger[hide-on-scroll]:
    // fade out on scroll-down (closing the bubble if it's open), back in
    // on scroll-up.
    var lastScrollY = window.scrollY;
    window.addEventListener(
      "scroll",
      function () {
        var scrollY = window.scrollY;
        var scrollingDown = scrollY > lastScrollY;
        lastScrollY = scrollY;

        if (scrollingDown) {
          if (state !== "idle") closeBubble();
          btn.classList.add("mascot-bot-scrolling");
        } else {
          btn.classList.remove("mascot-bot-scrolling");
        }
      },
      { passive: true }
    );

    // The stylesheet already hides the bubble below the breakpoint, which is
    // the part that holds even if this script is mid-load. This is the other
    // half: a rotated tablet or a resized window would otherwise leave the
    // request behind the bubble running with nothing left to cancel it, since
    // the button that cancels it is hidden by the same query.
    var desktop = window.matchMedia("(min-width:" + DESKTOP_MIN_PX + "px)");
    function onBreakpointChange() {
      if (!desktop.matches && state !== "idle") closeBubble();
    }
    if (desktop.addEventListener) {
      desktop.addEventListener("change", onBreakpointChange);
    } else if (desktop.addListener) {
      desktop.addListener(onBreakpointChange);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
