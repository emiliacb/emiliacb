// Scroll restoration (condicional)
if (
  document.body &&
  document.body.getAttribute("data-reset-scroll") === "true" &&
  "scrollRestoration" in history
) {
  history.scrollRestoration = "manual";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

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
