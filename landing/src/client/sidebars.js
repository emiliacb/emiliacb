// Opens the contact sidebars (src/site/components/*-sidebar.ts) from the links
// marked data-sidebar="<the sidebar's id>". The drawer itself is ui-sdk's,
// about 50 KB gzipped, so it is not on the page's init path: it loads the
// first time a pointer, a finger or the focus comes near one of those links,
// and a click that beats it waits for it. Until it has upgraded, the links are
// plain links (to GitHub, LinkedIn, Cal.com, or mailto:), which is also what
// they stay without JavaScript, and what a middle click or a modifier click
// still opens.
import { isDark, onTokensChange } from "./lib/theme.js";
import { rgbOf } from "./lib/color.js";

(function () {
  "use strict";

  const TRIGGER = "a[data-sidebar]";
  // A sidebar on a desktop, a bottom sheet on a phone. Same breakpoint as md:.
  const wide = matchMedia("(min-width: 768px)");

  const drawers = Array.from(document.querySelectorAll("ui-drawer.sidebar"));
  if (drawers.length === 0) return;

  // An untouched copy of the first sidebar's shell (backdrop, sheet, grip,
  // title, close button), taken now because after the drawer upgrades the
  // elements carry its state. openCustom builds its sidebar from it, so a
  // sheet made at runtime is the site's own markup and not a lookalike.
  const shell = drawers[0].cloneNode(true);
  const CUSTOM_ID = "custom-sidebar";

  // Set while closed only: moving an open sheet to another edge would make it
  // jump. It catches up on the next opening.
  // A sidebar can be pinned to one edge (data-side-pinned, set by openCustom).
  function placeSide() {
    for (const drawer of drawers) {
      if (drawer.open) continue;
      const pinned = drawer.dataset.sidePinned;
      drawer.setAttribute("side", pinned || (wide.matches ? "right" : "bottom"));
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
  // The booker's colours, read from the tokens so that it sits in the sheet
  // however the page was restyled. Cal.com's own greys are cool (Tailwind's
  // gray) and its accent a saturated brand colour; here every grey is the
  // sheet's warm stone, and the accent is the ink, as on the sheet's own
  // buttons: a picked day or time inverts, black on paper, white in the dark.
  function styleCalendar() {
    if (!window.Cal) return;
    const cs = getComputedStyle(document.documentElement);
    const hex = (name) => {
      const [r, g, b] = rgbOf(cs.getPropertyValue(name).trim());
      return "#" + [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");
    };
    // A stone step, mirrored in the dark: 200 on paper is 700 on the dark ground.
    const stone = (light, dark) => hex(`--color-stone-${isDark() ? dark : light}`);
    const vars = {
      "cal-bg": hex("--color-paper"),
      // The booker's own card, a shade darker in Cal.com's dark theme.
      "cal-bg-muted": hex("--color-paper"),
      "cal-bg-subtle": stone(100, 800),
      // Days with free times.
      "cal-bg-emphasis": stone(200, 700),
      "cal-border": stone(300, 600),
      "cal-border-muted": stone(200, 700),
      "cal-border-subtle": stone(400, 500),
      "cal-border-booker": stone(400, 500),
      "cal-border-emphasis": stone(400, 500),
      "cal-text": hex("--color-ink"),
      "cal-text-emphasis": hex("--color-ink"),
      "cal-text-subtle": stone(500, 400),
      "cal-text-muted": stone(400, 500),
      "cal-brand": hex("--color-ink"),
      "cal-brand-emphasis": stone(700, 300),
      "cal-brand-subtle": stone(300, 600),
      "cal-brand-text": hex("--color-paper"),
      "cal-brand-accent": hex("--color-paper"),
    };
    window.Cal("ui", {
      theme: isDark() ? "dark" : "light",
      layout: "month_view",
      hideEventTypeDetails: true,
      cssVarsPerTheme: { light: vars, dark: vars },
    });
  }

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

    const Cal = window.Cal;
    Cal("init", { origin: "https://cal.com" });
    // useSlotsViewOnSmallScreen: the month alone, and a day's times on a page
    // of their own once it is picked, instead of both stacked in the sheet.
    Cal("inline", {
      elementOrSelector: "#calendar-embed",
      calLink: box.dataset.calLink,
      config: { layout: "month_view", useSlotsViewOnSmallScreen: "true", theme: isDark() ? "dark" : "light" },
    });
    styleCalendar();
    // The booker follows the page when its mode is changed (the visitor's
    // system, or setThemeMode), as the sheet around it does.
    onTokensChange(styleCalendar);
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
  function restoreFocus(drawer) {
    drawer.addEventListener("openchangecomplete", function () {
      if (drawer.open || !opener) return;
      const active = document.activeElement;
      if (!active || active === document.body || drawer.contains(active)) {
        opener.focus({ preventScroll: true });
      }
      opener = null;
    });
  }
  for (const drawer of drawers) restoreFocus(drawer);

  // The shell of the sidebar openCustom builds, made on first use.
  function customDrawer() {
    const existing = document.getElementById(CUSTOM_ID);
    if (existing) return existing;
    const drawer = shell.cloneNode(true);
    drawer.id = CUSTOM_ID;
    // No footer, and no aside next to the title (GitHub's handle): the shell
    // is the first sidebar's, and there is no note, button or handle to put in.
    for (const part of drawer.querySelectorAll(".sidebar-actions, header span.truncate")) part.remove();
    drawers[0].after(drawer);
    drawers.push(drawer);
    restoreFocus(drawer);
    return drawer;
  }

  // The API for code that is not a link on the page (the WebMCP tools use it,
  // src/webmcp/client/tools/dom.js; it is a site feature on its own, so it
  // stays here when they go). Both return a promise of a small description of
  // what happened.
  //   openCustom({ title, content, side }): opens a sidebar with the shell of
  //     the contact ones around `content` (a Node; the caller sanitizes it).
  //     Calling it again replaces the title and content. `side` is "auto"
  //     (right on a desktop, bottom on a phone), "right" or "bottom"; an open
  //     sheet is not moved, the new edge applies from its next opening.
  //   close(): closes whichever sidebar is open.
  window.siteSidebars = {
    openCustom: function (options) {
      const drawer = customDrawer();
      const side = options.side === "right" || options.side === "bottom" ? options.side : "";
      if (side) drawer.dataset.sidePinned = side;
      else delete drawer.dataset.sidePinned;

      const title = drawer.querySelector("ui-drawer-title");
      if (title) title.textContent = options.title;
      const scroll = drawer.querySelector(".sidebar-scroll");
      if (scroll) {
        scroll.replaceChildren(options.content);
        scroll.scrollTop = 0;
      }
      const wasOpen = drawer.open === true;

      return load().then(function () {
        placeSide();
        if (!wasOpen) {
          const active = document.activeElement;
          opener = active && active !== document.body ? active : null;
          drawer.open = true;
        }
        return { id: CUSTOM_ID, replaced: wasOpen, side: drawer.getAttribute("side") };
      });
    },
    close: function () {
      const drawer = drawers.find(function (d) {
        return d.open;
      });
      if (!drawer) return Promise.resolve(null);
      drawer.open = false;
      return Promise.resolve({ id: drawer.id });
    },
  };
})();
