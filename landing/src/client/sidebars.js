// Opens the contact sidebars (src/site/components/*-sidebar.ts) from the links
// marked data-sidebar="<the sidebar's id>". The drawer itself is ui-sdk's,
// about 50 KB gzipped, so it is not on the page's init path: it loads the
// first time a pointer, a finger or the focus comes near one of those links,
// and a click that beats it waits for it. Until it has upgraded, the links are
// plain links (to GitHub, LinkedIn, Cal.com, or mailto:), which is also what
// they stay without JavaScript, and what a middle click or a modifier click
// still opens.
(function () {
  "use strict";

  const TRIGGER = "a[data-sidebar]";
  // A sidebar on a desktop, a bottom sheet on a phone. Same breakpoint as md:.
  const wide = matchMedia("(min-width: 768px)");
  const dark = matchMedia("(prefers-color-scheme: dark)");

  const drawers = Array.from(document.querySelectorAll("ui-drawer.sidebar"));
  if (drawers.length === 0) return;

  // Set while closed only: moving an open sheet to another edge would make it
  // jump. It catches up on the next opening.
  function placeSide() {
    for (const drawer of drawers) {
      if (!drawer.open) drawer.setAttribute("side", wide.matches ? "right" : "bottom");
    }
  }
  placeSide();
  if (wide.addEventListener) wide.addEventListener("change", placeSide);

  let loading = null;
  function load() {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      // The bundle's hashed URL is rendered into <meta name="asset:ui-drawer">.
      const meta = document.querySelector('meta[name="asset:ui-drawer"]');
      const src = meta && meta.getAttribute("content");
      if (!src || !window.customElements) {
        reject(new Error("ui-drawer unavailable"));
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.addEventListener("load", function () {
        customElements.whenDefined("ui-drawer").then(resolve);
      });
      script.addEventListener("error", function () {
        // Lets a later approach try again.
        loading = null;
        reject(new Error("ui-drawer failed to load"));
      });
      document.head.appendChild(script);
    });
    return loading;
  }

  // Cal.com's booker, in the calendar sidebar: its embed script loads the
  // first time that sidebar opens, never with the page. Cal.com's own snippet
  // queues calls on window.Cal until embed.js arrives and plays them.
  let calendarStarted = false;
  function startCalendar() {
    const box = document.getElementById("calendar-embed");
    if (calendarStarted || !box) return;
    calendarStarted = true;

    const queue = (...args) => queue.q.push(args);
    queue.q = [];
    queue.ns = {};
    queue.loaded = true;
    window.Cal = window.Cal || queue;

    const script = document.createElement("script");
    script.src = "https://app.cal.com/embed/embed.js";
    script.addEventListener("error", function () {
      // Lets the next opening try again; the footer button books meanwhile.
      calendarStarted = false;
      window.Cal = undefined;
      script.remove();
    });
    document.head.appendChild(script);

    const theme = dark.matches ? "dark" : "light";
    const Cal = window.Cal;
    Cal("init", { origin: "https://cal.com" });
    Cal("inline", { elementOrSelector: "#calendar-embed", calLink: box.dataset.calLink, config: { layout: "month_view", theme } });
    Cal("ui", {
      theme,
      layout: "month_view",
      hideEventTypeDetails: true,
      // The sheet's ground, ink and rules (stone), so the booker sits in it
      // instead of on a card of its own; the accent is the nav rule's green,
      // blue in the dark.
      cssVarsPerTheme: {
        light: {
          "cal-bg": "#f5f5f4",
          "cal-bg-emphasis": "#e7e5e4",
          "cal-border-subtle": "#a8a29e",
          "cal-text": "#292524",
          "cal-text-emphasis": "#292524",
          "cal-brand": "#4ade80",
        },
        dark: {
          "cal-bg": "#292524",
          "cal-bg-emphasis": "#44403c",
          "cal-border-subtle": "#78716c",
          "cal-text": "#f5f5f4",
          "cal-text-emphasis": "#f5f5f4",
          "cal-brand": "#2563eb",
        },
      },
    });
    Cal("on", {
      action: "linkReady",
      callback: function () {
        const wait = box.querySelector(".calendar-embed-wait");
        if (wait) wait.remove();
      },
    });
  }

  function warm(e) {
    if (e.target.closest && e.target.closest(TRIGGER)) load().catch(function () {});
  }
  document.addEventListener("pointerover", warm, { passive: true });
  document.addEventListener("touchstart", warm, { passive: true });
  document.addEventListener("focusin", warm);

  let opener = null;

  function open(link, drawer) {
    opener = link;
    // Dims the link while the drawer downloads. Once it is loaded the promise
    // settles before the next frame, so this never shows.
    link.setAttribute("aria-busy", "true");
    const clearBusy = function () {
      link.removeAttribute("aria-busy");
    };
    load().then(
      function () {
        clearBusy();
        placeSide();
        drawer.open = true;
        if (drawer.querySelector("#calendar-embed")) startCalendar();
      },
      function () {
        clearBusy();
        // No drawer: the link does what it would have done.
        if (link.target === "_blank") window.open(link.href, "_blank", "noopener");
        else window.location.href = link.href;
      }
    );
  }

  document.addEventListener("click", function (e) {
    const link = e.target.closest && e.target.closest(TRIGGER);
    if (!link || e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const drawer = document.getElementById(link.dataset.sidebar);
    if (!drawer) return;
    e.preventDefault();
    open(link, drawer);
  });

  // Opened from code, not from a ui-drawer-trigger, so focus is handed back to
  // the link that opened it by hand. Only when it was inside the sheet: a
  // press outside that closed it may have put it somewhere on purpose.
  for (const drawer of drawers) {
    drawer.addEventListener("openchangecomplete", function () {
      if (drawer.open || !opener) return;
      const active = document.activeElement;
      if (!active || active === document.body || drawer.contains(active)) {
        opener.focus({ preventScroll: true });
      }
      opener = null;
    });
  }
})();
