document.addEventListener("click", async (e) => {
  const button = e.target.closest("[data-copy-value]");
  if (!button) return;

  const value = button.dataset.copyValue;
  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
  } catch {
    return;
  }

  const copyIcon = button.querySelector(".copy-icon");
  const checkIcon = button.querySelector(".check-icon");
  const label = button.querySelector(".copy-label");
  if (!copyIcon || !checkIcon || !label) return;

  const originalLabel = label.dataset.originalLabel || label.textContent;
  label.dataset.originalLabel = originalLabel;
  const copiedLabel = button.dataset.copiedLabel || originalLabel;

  clearTimeout(button._copyResetTimeout);
  copyIcon.classList.add("!hidden");
  copyIcon.classList.remove("!inline-flex");
  checkIcon.classList.remove("!hidden");
  checkIcon.classList.add("!inline-flex");
  label.textContent = copiedLabel;

  button._copyResetTimeout = setTimeout(() => {
    copyIcon.classList.remove("!hidden");
    copyIcon.classList.add("!inline-flex");
    checkIcon.classList.add("!hidden");
    checkIcon.classList.remove("!inline-flex");
    label.textContent = originalLabel;
  }, 1500);
});
