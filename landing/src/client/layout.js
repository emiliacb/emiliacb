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
if (
  window.matchMedia("(prefers-reduced-motion: no-preference)").matches
) {
  const overlayContent = document.getElementById("overlay-content");
  const scrollWrapper = document.getElementById("scroll-wrapper");

  // The mascot button can flip .ai-layout-enabled on <html> at any time,
  // which changes which element actually scrolls, so this is re-checked on
  // every read instead of cached once at load.
  function usesWrapperScroll() {
    return document.documentElement.classList.contains("ai-layout-enabled");
  }

  if (overlayContent) {
    let timeout;
    let ticking = false;
    let cachedOverlayHeight = overlayContent.offsetHeight;

    window.addEventListener("resize", () => {
      cachedOverlayHeight = overlayContent.offsetHeight;
    });

    function checkIfOverlayScrolled() {
      const wrapperScroll = usesWrapperScroll();
      const scrollY = wrapperScroll ? scrollWrapper.scrollTop : window.scrollY;
      const viewportHeight = wrapperScroll
        ? scrollWrapper.clientHeight
        : window.innerHeight;
      const isScrolled = scrollY > cachedOverlayHeight - viewportHeight + 1;
      return isScrolled;
    }

    function tick() {
      const isScrolled = checkIfOverlayScrolled();
      overlayContent.classList.toggle("scrolled", isScrolled);

      return !isScrolled;
    }

    function forcedTick() {
      //Cancel any requested animation
      const animationFrameId = requestAnimationFrame(tick);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Now, force the tick and reset the ticking flag
      tick();
      ticking = false;
    }

    function onScroll() {
      const isScrolled = checkIfOverlayScrolled();

      // Wait for requestAnimationFrame if not scrolled
      if (!ticking && !isScrolled) {
        ticking = requestAnimationFrame(tick);
      }

      // Don't wait for requestAnimationFrame if scrolled, to avoid waiting for the animation to finish
      if (isScrolled && !overlayContent.classList.contains("scrolled")) {
        forcedTick();
      }

      // Debounce scroll handler to handle inertial scrolling animations
      clearTimeout(timeout);
      timeout = setTimeout(forcedTick, 200);
    }

    // Both targets are wired up unconditionally: only one of them actually
    // scrolls at a time, depending on .ai-layout-enabled, and that can
    // flip live (mascot button), so neither can be picked once and cached.
    window.addEventListener("scrollend", forcedTick);
    window.addEventListener("scroll", onScroll);
    if (scrollWrapper) {
      scrollWrapper.addEventListener("scrollend", forcedTick);
      scrollWrapper.addEventListener("scroll", onScroll);
    }
  }
}
