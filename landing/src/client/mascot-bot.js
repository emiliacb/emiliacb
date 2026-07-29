// Floating "mascot" button, pinned top-left: always available on desktop (it
// still fades out on scroll-down like the language switcher does), and on
// click asks the backend for a one-sentence, playful comment about what the
// visitor's been looking at.
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
      // Hangs below the button, so it slides down into place instead of up.
      ".mascot-bot-bubble{position:fixed;left:" + EDGE_REM + "rem;" +
      "top:" + BUBBLE_TOP_REM + "rem;z-index:50;max-width:16rem;" +
      "background:#fff;color:#1c1917;padding:.75rem 1rem;border-radius:.75rem;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.2);font-size:.875rem;line-height:1.4;" +
      "opacity:0;transform:translateY(-6px) scale(.96);pointer-events:none;" +
      "transition:opacity 180ms cubic-bezier(.23,1,.32,1),transform 180ms cubic-bezier(.23,1,.32,1);}" +
      ".mascot-bot-bubble.mascot-bot-visible{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}" +
      "@media (prefers-color-scheme: dark){.mascot-bot-bubble{background:#292524;color:#f5f5f4;}}" +
      ".mascot-bot-toast{position:fixed;bottom:1rem;left:50%;transform:translateX(-50%) translateY(6px);" +
      "z-index:60;background:#1c1917;color:#fff;padding:.6rem 1rem;border-radius:.5rem;" +
      "font-size:.8rem;opacity:0;pointer-events:none;transition:opacity 180ms ease-out,transform 180ms ease-out;}" +
      ".mascot-bot-toast.mascot-bot-visible{opacity:1;transform:translateX(-50%) translateY(0);}";
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
    bubble.setAttribute("role", "status");
    document.body.appendChild(bubble);
    return bubble;
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
    var bubble = createBubble();
    var state = "idle"; // idle | loading | showing

    function setIdle() {
      state = "idle";
      btn.innerHTML = Sparkles;
      btn.disabled = false;
    }

    function setLoading() {
      state = "loading";
      btn.disabled = true;
      btn.innerHTML = LoaderCircle;
      var svg = btn.querySelector("svg");
      if (svg) svg.classList.add("mascot-bot-spin");
    }

    function closeBubble() {
      bubble.classList.remove("mascot-bot-visible");
      setIdle();
    }

    function showBubble(message) {
      bubble.textContent = message;
      bubble.classList.add("mascot-bot-visible");
      btn.innerHTML = X;
      btn.disabled = false;
      state = "showing";
      logMascotSaid(message);
    }

    function requestComment() {
      setLoading();
      fetch("/api/mascot-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logs: readActivityLogs(),
          pageText: pageText(),
          lang: lang(),
        }),
      })
        .then(function (res) {
          return res.json().catch(function () {
            return null;
          }).then(function (data) {
            if (!res.ok) throw new Error((data && data.error) || "Request failed (" + res.status + ")");
            return data;
          });
        })
        .then(function (data) {
          setIdle();
          if (!data || !data.message) throw new Error("Empty response");
          showBubble(data.message);
        })
        .catch(function (err) {
          setIdle();
          showToast((err && err.message) || COPY[lang()].error);
        });
    }

    btn.addEventListener("click", function () {
      if (state === "loading") return;
      if (state === "showing") {
        closeBubble();
        return;
      }
      requestComment();
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
          if (state === "showing") closeBubble();
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
