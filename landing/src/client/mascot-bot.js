// Floating "mascot" button, pinned top-left: always available on desktop (it
// still fades out on scroll-down like the language switcher does), and on
// click asks the backend for a one-sentence comment addressed to the visitor
// about something they just did on the page.
//
// The reply is streamed, so the bubble can't be laid out once and be done: it
// opens small, then grows as words arrive. Growing a box whose text reflows on
// every frame looks like a jitter, so the box is sized in px from pretext's
// off-DOM measurements (see sizeFor) and the text element inside is absolutely
// positioned at its final wrap width from the start. The box animates toward
// that size while the words fade in behind it, and nothing ever re-wraps.
import { Sparkles, LoaderCircle, X } from "lucide-static";

(function () {
  "use strict";

  var TOAST_DURATION_MS = 4000;
  var PAGE_TEXT_MAX_CHARS = 4000;
  var SENT_LOGS_MAX = 10;

  var COPY = {
    en: { error: "Couldn't come up with anything to say, try again in a bit." },
    es: { error: "No se me ocurrió nada que decir, probá de nuevo en un rato." },
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

  // The bubble is sized as a content box, so these are the bounds of the text
  // area itself, padding excluded. MIN is what it opens at while waiting for
  // the first token: wide enough for the three thinking dots and no wider.
  var MAX_TEXT_REM = 20;
  var MIN_TEXT_REM = 3.25;
  var PAD_X_REM = 1;
  var PAD_Y_REM = 0.75;

  function remToPx(rem) {
    var root = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return rem * (root || 16);
  }

  function injectStyles() {
    var style = document.createElement("style");
    style.textContent =
      // Same visual language as dropdown-trigger[variant="icon-only"]:
      // transparent, text-stone-800/dark:text-stone-100, invert on hover.
      // Desktop-only, same as the language switcher
      // (`hidden lg:block`, Tailwind's lg breakpoint = 1024px).
      ".mascot-bot-btn{display:none;position:fixed;left:" + EDGE_REM + "rem;" +
      "top:" + EDGE_REM + "rem;z-index:50;" +
      "width:" + BTN_SIZE_REM + "rem;height:" + BTN_SIZE_REM + "rem;padding:0;border:none;cursor:pointer;" +
      "align-items:center;justify-content:center;" +
      "background:transparent;color:#292524;" +
      "opacity:0;transform:scale(.6);pointer-events:none;" +
      "transition:opacity 200ms cubic-bezier(.23,1,.32,1),transform 200ms cubic-bezier(.23,1,.32,1)," +
      "background-color 150ms ease-out,color 150ms ease-out;}" +
      "@media (min-width: 1024px){.mascot-bot-btn{display:flex;}}" +
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
      ".mascot-bot-bubble{position:fixed;left:" + EDGE_REM + "rem;" +
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
      "opacity:0;transform:scale(.94);filter:blur(3px);pointer-events:none;" +
      // Transitions, not keyframes, on every one of these: the bubble can be
      // dismissed mid-open and resized mid-growth, and a transition retargets
      // from wherever it currently is instead of restarting.
      "transition:opacity 150ms ease-out," +
      "transform 280ms cubic-bezier(.32,.72,0,1)," +
      "filter 200ms ease-out," +
      "width 300ms cubic-bezier(.32,.72,0,1)," +
      "height 300ms cubic-bezier(.32,.72,0,1);}" +
      ".mascot-bot-bubble.mascot-bot-visible{opacity:1;transform:scale(1);filter:blur(0);pointer-events:auto;}" +
      // Fallback for browsers pretext can't run in (no Intl.Segmenter) or when
      // its bundle failed to load: drop the measured px sizing and let CSS wrap
      // the text normally. The bubble still fades and scales, it just can't
      // animate its own growth.
      ".mascot-bot-bubble.mascot-bot-auto{width:auto;height:auto;transition:opacity 150ms ease-out," +
      "transform 280ms cubic-bezier(.32,.72,0,1),filter 200ms ease-out;}" +
      ".mascot-bot-bubble.mascot-bot-auto .mascot-bot-text{position:static;width:auto;}" +
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
      // Thinking dots, shown from the click until the first token lands.
      ".mascot-bot-dots{position:absolute;left:" + PAD_X_REM + "rem;top:" + PAD_Y_REM + "rem;" +
      "display:flex;align-items:center;gap:.25rem;height:1.45em;" +
      "opacity:1;transition:opacity 150ms ease-out;}" +
      ".mascot-bot-dots.mascot-bot-dots-out{opacity:0;}" +
      ".mascot-bot-dots span{width:.3rem;height:.3rem;border-radius:9999px;background:currentColor;" +
      "opacity:.35;animation:mascot-bot-pulse 1200ms ease-in-out infinite;}" +
      ".mascot-bot-dots span:nth-child(2){animation-delay:150ms;}" +
      ".mascot-bot-dots span:nth-child(3){animation-delay:300ms;}" +
      "@keyframes mascot-bot-pulse{0%,100%{opacity:.25;}50%{opacity:.9;}}" +
      ".mascot-bot-toast{position:fixed;bottom:1rem;left:50%;transform:translateX(-50%) translateY(6px);" +
      "z-index:60;background:#1c1917;color:#fff;padding:.6rem 1rem;border-radius:.5rem;" +
      "font-size:.8rem;opacity:0;pointer-events:none;transition:opacity 180ms ease-out,transform 180ms ease-out;}" +
      ".mascot-bot-toast.mascot-bot-visible{opacity:1;transform:translateX(-50%) translateY(0);}" +
      // Motion is the whole point of the growing bubble, so reduced-motion
      // gets the plain version: no growth animation, no per-word reveal.
      "@media (prefers-reduced-motion: reduce){" +
      ".mascot-bot-bubble{transition:opacity 120ms linear;transform:none;filter:none;}" +
      ".mascot-bot-bubble.mascot-bot-visible{transform:none;}" +
      ".mascot-bot-word{opacity:1;filter:none;transition:none;}" +
      ".mascot-bot-dots span{animation:none;}}";
    document.head.appendChild(style);
  }

  function createButton() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mascot-bot-btn";
    btn.setAttribute("aria-label", "Emilia's comment");
    btn.innerHTML = Sparkles;
    document.body.appendChild(btn);
    return btn;
  }

  function createBubble() {
    var bubble = document.createElement("div");
    bubble.className = "mascot-bot-bubble";
    // aria-live, not role="status" alone: the text arrives in pieces after the
    // bubble is already in the DOM, and polite+atomic makes a screen reader
    // announce the finished sentence instead of every token.
    bubble.setAttribute("role", "status");
    bubble.setAttribute("aria-live", "polite");
    bubble.setAttribute("aria-atomic", "true");

    var dots = document.createElement("div");
    dots.className = "mascot-bot-dots";
    dots.setAttribute("aria-hidden", "true");
    dots.innerHTML = "<span></span><span></span><span></span>";

    var text = document.createElement("div");
    text.className = "mascot-bot-text";

    bubble.appendChild(dots);
    bubble.appendChild(text);
    document.body.appendChild(bubble);
    return { bubble: bubble, dots: dots, text: text };
  }

  function showToast(message) {
    var toast = document.createElement("div");
    toast.className = "mascot-bot-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add("mascot-bot-visible");
    });
    setTimeout(function () {
      toast.classList.remove("mascot-bot-visible");
      setTimeout(function () {
        toast.remove();
      }, 200);
    }, TOAST_DURATION_MS);
  }

  // ---- pretext, loaded on demand ----
  // Prefetched when the pointer enters the button, so by the time the click
  // lands the measurements are available and the bubble takes the animated
  // path rather than the auto-sizing fallback.
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
    var dots = parts.dots;
    var textEl = parts.text;

    var state = "idle"; // idle | loading | streaming | showing
    var pretext = null; // measurement API for the message currently open, or null
    var fullText = ""; // everything committed to the DOM so far
    var pending = ""; // trailing fragment of the stream, not a whole word yet
    var boxW = 0; // measured px size of the text box, monotonic within a message
    var boxH = 0;
    var abort = null;

    loadPretext().then(function (api) {
      // Montserrat arrives over the network with font-display:swap, so
      // anything measured before it lands was measured against the fallback
      // face. Nothing has been measured this early, but pretext caches by
      // font string, so clear it rather than trust a cache built pre-swap.
      if (api && document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          api.clearCache();
        });
      }
    });

    // The canvas font shorthand pretext measures with, read back off the
    // element that will actually render the text so the two can't drift apart.
    // No line-height component: canvas ignores it, and the line height comes
    // from lineHeightPx below instead.
    function fontString() {
      var cs = getComputedStyle(textEl);
      return cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    }

    function lineHeightPx() {
      var cs = getComputedStyle(textEl);
      var lh = parseFloat(cs.lineHeight);
      if (lh) return lh;
      return (parseFloat(cs.fontSize) || 14) * 1.45;
    }

    // The text box this string wants, measured entirely off-DOM. Width is the
    // longest line rather than the wrap width, so the bubble hugs a short
    // message instead of always sitting at its maximum: pretext guarantees
    // some line reaches maxLineWidth and none exceeds it, so re-wrapping at
    // that width reproduces the same lines. The +1px absorbs the subpixel
    // disagreement between canvas measurement and DOM wrapping.
    function sizeFor(str) {
      try {
        var font = fontString();
        var lh = lineHeightPx();
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
      if (!pretext) return;
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
    // fades in while visibly shrinking from the last comment's size down to
    // the minimum. Suppressing the transition for one flushed frame makes the
    // open start from small, which is what the growth is supposed to read as.
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
      bubble.classList.add("mascot-bot-auto");
      bubble.style.width = "";
      bubble.style.height = "";
      textEl.style.width = "";
    }

    function setIdle() {
      state = "idle";
      btn.innerHTML = Sparkles;
      btn.disabled = false;
    }

    function setLoading() {
      state = "loading";
      btn.disabled = false; // clicking again cancels, so it stays live
      btn.innerHTML = LoaderCircle;
      var svg = btn.querySelector("svg");
      if (svg) svg.classList.add("mascot-bot-spin");
    }

    function setDismissable() {
      btn.innerHTML = X;
      btn.disabled = false;
    }

    // Opens at the minimum size with the thinking dots, before a single token
    // exists. The growth animation needs somewhere to grow from, and an empty
    // bubble that appears the instant it's clicked is also the honest signal
    // that the click registered.
    function openBubble() {
      fullText = "";
      pending = "";
      boxW = 0;
      boxH = 0;
      textEl.textContent = "";
      dots.classList.remove("mascot-bot-dots-out");
      bubble.classList.remove("mascot-bot-auto");

      if (pretext) {
        boxW = remToPx(MIN_TEXT_REM);
        boxH = lineHeightPx();
        setSizeInstant(boxW, boxH);
      } else {
        useAutoSizing();
      }

      requestAnimationFrame(function () {
        bubble.classList.add("mascot-bot-visible");
      });
    }

    function closeBubble() {
      bubble.classList.remove("mascot-bot-visible");
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
    function commit(chunk, final) {
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
        state = "streaming";
        dots.classList.add("mascot-bot-dots-out");
        setDismissable();
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
      // Measurements are needed before the bubble opens, not after: switching
      // sizing strategies halfway through a message would be a visible jump.
      loadPretext().then(function (api) {
        pretext = api;
        setLoading();
        openBubble();

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
              // real reason can reach the toast.
              return res
                .json()
                .catch(function () {
                  return null;
                })
                .then(function (data) {
                  throw new Error((data && data.error) || "Request failed (" + res.status + ")");
                });
            }
            return readStream(res);
          })
          .then(function () {
            if (signal.aborted) return;
            if (!fullText.trim()) throw new Error(COPY[lang()].error);
            state = "showing";
            setDismissable();
            logMascotSaid(fullText.trim());
          })
          .catch(function (err) {
            if (signal.aborted || (err && err.name === "AbortError")) return;
            closeBubble();
            showToast((err && err.message) || COPY[lang()].error);
          });
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
    btn.addEventListener("pointerenter", loadPretext);
    btn.addEventListener("focus", loadPretext);

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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
