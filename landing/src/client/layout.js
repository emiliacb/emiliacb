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
    window.addEventListener("scroll", () => {
      const overlayContentHeight = overlayContent.offsetHeight;
      const scrolled =
        window.scrollY >
        overlayContentHeight - window.innerHeight + 1;
      overlayContent.classList.toggle("scrolled", scrolled);

      // Debounce scroll handler to handle inertial scrolling animations
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const scrolledPast =
          window.scrollY >
          overlayContentHeight - window.innerHeight + 1;
        overlayContent.classList.toggle("scrolled", scrolledPast);
      }, 1000);
    });
  }
}
