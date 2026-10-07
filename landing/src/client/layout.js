// Conditional scroll restoration:
// - URLs with query params or hash skip restoration (fresh navigation)
// - Landing on a different path than the one scrolled from: stay at top
// - Saved position < 100px: stay at top
// - Saved position >= 100px on the same path (e.g. back navigation): restore position
(function () {
  var hasQueryParams = window.location.search.length > 0;
  var hasHash = window.location.hash.length > 0;
  var savedPath = sessionStorage.getItem("__scrollPath");
  var savedPos = parseInt(sessionStorage.getItem("__scrollPos") || "0", 10);
  var isSamePath = savedPath === window.location.pathname;

  if (hasQueryParams || hasHash || !isSamePath || savedPos < 100) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } else {
    window.scrollTo({ top: savedPos, left: 0, behavior: "auto" });
  }

  sessionStorage.removeItem("__scrollPos");
  sessionStorage.removeItem("__scrollPath");

  window.addEventListener("beforeunload", function () {
    sessionStorage.setItem("__scrollPos", String(window.scrollY));
    sessionStorage.setItem("__scrollPath", window.location.pathname);
  });
})();

// Overlay-content scroll effect (siempre)
//
// .scrolled rounds the overlay's bottom corners once its bottom edge has come
// up into view. A 1px sentinel pinned to that edge is watched instead of
// listening to scroll: the observer reports when it comes into view, with no
// layout reads per scroll event and no cached height to go stale on resize.
// It also needs no idea of which element scrolls: with the AI layout on that is
// #scroll-wrapper, not the window, and the implicit root still clips the
// sentinel by every scrolling ancestor on the way up to the viewport.
if (
  window.matchMedia("(prefers-reduced-motion: no-preference)").matches
) {
  const overlayContent = document.getElementById("overlay-content");

  if (overlayContent) {
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    // Centred, not at the left edge: the rounded corner it switches on would
    // otherwise clip it out of its own trigger.
    sentinel.style.cssText =
      "position:absolute;bottom:0;left:50%;width:1px;height:1px;pointer-events:none;";
    overlayContent.appendChild(sentinel);

    // The bottom margin keeps the old threshold, an edge more than a pixel
    // above the viewport's bottom: the sentinel spans the overlay's last pixel,
    // and a target that only touches the root's edge still counts.
    new IntersectionObserver(
      ([entry]) => {
        overlayContent.classList.toggle("scrolled", entry.isIntersecting);
      },
      { rootMargin: "0px 0px -3px 0px" }
    ).observe(sentinel);
  }
}
