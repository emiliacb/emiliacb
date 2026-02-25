// Scroll restoration condicional:
// - Si la página tiene data-reset-scroll="true", siempre va al top
// - Si el scroll guardado es menor a 100px, no restaurar (quedarse arriba)
// - Si el scroll guardado es >= 100px, restaurar la posición
(function () {
  var resetScroll =
    document.body &&
    document.body.getAttribute("data-reset-scroll") === "true";
  var savedPos = parseInt(sessionStorage.getItem("__scrollPos") || "0", 10);

  if (resetScroll || savedPos < 100) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } else {
    window.scrollTo({ top: savedPos, left: 0, behavior: "auto" });
  }

  sessionStorage.removeItem("__scrollPos");

  window.addEventListener("beforeunload", function () {
    sessionStorage.setItem("__scrollPos", String(window.scrollY));
  });
})();

// Overlay-content scroll effect (siempre)
if (
  window.matchMedia("(prefers-reduced-motion: no-preference)").matches
) {
  const overlayContent = document.getElementById("overlay-content");
  if (overlayContent) {
    let timeout;
    let ticking = false;

    function checkIfOverlayScrolled() {
      const overlayContentHeight = overlayContent.offsetHeight;
      const isScrolled =
        window.scrollY >
        overlayContentHeight - window.innerHeight + 1;
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

    window.addEventListener("scroll", () => {
      const isScrolled = checkIfOverlayScrolled();

      // Wait for requestAnimationFrame if not scrolled
      if (!ticking && !isScrolled) {
        ticking = requestAnimationFrame(tick);
      }

      // Don't wait for requestAnimationFrame if scrolled, to avoid waiting for the animation to finish
      if (isScrolled && !overlayContent.classList.contains("scrolled")) {
        forcedTick();
      }

      // Modern browsers: scrollend event
      window.addEventListener("scrollend", forcedTick);

      // Debounce scroll handler to handle inertial scrolling animations
      clearTimeout(timeout);
      timeout = setTimeout(forcedTick, 200);
    });
  }
}
