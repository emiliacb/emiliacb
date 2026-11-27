// Opens the GitHub sidebar (src/site/components/github-sidebar.ts) from the
// links marked data-github-sidebar. The drawer itself is ui-sdk's, about 50 KB
// gzipped, so it is not on the page's init path: it loads the first time a
// pointer, a finger or the focus comes near one of those links, and a click
// that beats it waits for it. Until it has upgraded, the links are plain links
// to GitHub, which is also what they stay without JavaScript, and what a
// middle click or a modifier click still opens.
(function () {
  "use strict";

  var ID = "github-sidebar";
  var TRIGGER = "a[data-github-sidebar]";
  // A sidebar on a desktop, a bottom sheet on a phone. Same breakpoint as md:.
  var wide = matchMedia("(min-width: 768px)");

  var drawer = document.getElementById(ID);
  if (!drawer) return;

  // Set while closed only: moving an open sheet to another edge would make it
  // jump. It catches up on the next opening.
  function placeSide() {
    if (drawer.open) return;
    drawer.setAttribute("side", wide.matches ? "right" : "bottom");
  }
  placeSide();
  if (wide.addEventListener) wide.addEventListener("change", placeSide);

  var loading = null;
  function load() {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      // The bundle's hashed URL is rendered into <meta name="asset:ui-drawer">.
      var meta = document.querySelector('meta[name="asset:ui-drawer"]');
      var src = meta && meta.getAttribute("content");
      if (!src || !window.customElements) {
        reject(new Error("ui-drawer unavailable"));
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.onload = function () {
        customElements.whenDefined("ui-drawer").then(resolve);
      };
      script.onerror = function () {
        // Lets a later approach try again.
        loading = null;
        reject(new Error("ui-drawer failed to load"));
      };
      document.head.appendChild(script);
    });
    return loading;
  }

  function warm(e) {
    if (e.target.closest && e.target.closest(TRIGGER)) load().catch(function () {});
  }
  document.addEventListener("pointerover", warm, { passive: true });
  document.addEventListener("touchstart", warm, { passive: true });
  document.addEventListener("focusin", warm);

  var opener = null;

  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest(TRIGGER);
    if (!link || e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    opener = link;
    // Dims the link while the drawer downloads. Once it is loaded the promise
    // settles before the next frame, so this never shows.
    link.setAttribute("aria-busy", "true");
    var done = function () {
      link.removeAttribute("aria-busy");
    };
    load().then(
      function () {
        done();
        placeSide();
        drawer.open = true;
      },
      function () {
        done();
        // No drawer: the link does what it would have done.
        window.open(link.href, "_blank", "noopener");
      }
    );
  });

  // Opened from code, not from a ui-drawer-trigger, so focus is handed back to
  // the link that opened it by hand. Only when it was inside the sheet: a
  // press outside that closed it may have put it somewhere on purpose.
  drawer.addEventListener("openchangecomplete", function () {
    if (drawer.open || !opener) return;
    var active = document.activeElement;
    if (!active || active === document.body || drawer.contains(active)) {
      opener.focus({ preventScroll: true });
    }
    opener = null;
  });
})();
